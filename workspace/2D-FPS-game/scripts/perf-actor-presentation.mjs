import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { workspaceFingerprint } from "../../../plugins/hermes-ssot/scripts/harness-controller.mjs";
import {
  evaluatePerformanceQualification,
  PERFORMANCE_QUALIFICATION_LIMITS
} from "./performance-qualification.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORKSPACE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.html");
const VITE_ENTRY = path.join(PROJECT_ROOT, "node_modules", "vite", "bin", "vite.js");
const PORT = Number(process.env.PHASE11_PERF_PORT ?? 4191);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WARMUP_MS = 5_000;
const SAMPLE_MS = 30_000;
const FRAME_P95_LIMIT_MS = 16.7;
const REGRESSION_LIMIT_MS = 1;
const MAX_BUILD_AGE_MS = 10 * 60 * 1_000;
const MIN_SAMPLE_COUNT = Math.floor(SAMPLE_MS / FRAME_P95_LIMIT_MS * 0.95);
const OUTPUT_PATH = path.resolve(
  PROJECT_ROOT,
  process.env.PHASE11_PERF_OUTPUT ?? "docs/reports/phase11-t4-evidence/phase11-t4-performance-cadence.json"
);
const ACTOR_PATHS = [
  "/assets/runtime/actors/actor-blue.webp",
  "/assets/runtime/actors/actor-blue.json",
  "/assets/runtime/actors/actor-red.webp",
  "/assets/runtime/actors/actor-red.json",
  "/assets/runtime/actors/manifest.json"
];
const CAPTURE_ORDERS = [
  ["legacy", "animated"],
  ["animated", "legacy"],
  ["legacy", "animated"]
];

const round = (value, digits = 3) => Number(value.toFixed(digits));

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? Number.POSITIVE_INFINITY;
};

const summarize = (rawFrameDeltasMs) => ({
  sampleCount: rawFrameDeltasMs.length,
  p50Ms: round(percentile(rawFrameDeltasMs, 0.5)),
  p95Ms: round(percentile(rawFrameDeltasMs, 0.95)),
  maxMs: round(Math.max(...rawFrameDeltasMs))
});

const waitForServer = async (server, output) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite preview exited before readiness (${server.exitCode}).\n${output.join("")}`);
    }
    try {
      const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The bounded retry loop owns readiness; individual connection failures are expected.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview did not become ready at ${BASE_URL}.\n${output.join("")}`);
};

const stopServer = async (server) => {
  if (server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

const collectActorPayloads = async (page) => page.evaluate(async (paths) => {
  return Promise.all(paths.map(async (actorPath) => {
    const response = await fetch(actorPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`${actorPath} returned HTTP ${response.status}.`);
    return { path: actorPath, bytes: (await response.arrayBuffer()).byteLength };
  }));
}, ACTOR_PATHS);

const collectTextureMetadata = async (page) => page.evaluate(async () => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");
  const definitions = [
    ["BLUE", "actor-animated-blue", "/assets/runtime/actors/actor-blue.json"],
    ["RED", "actor-animated-red", "/assets/runtime/actors/actor-red.json"]
  ];
  return Promise.all(definitions.map(async ([team, textureKey, atlasPath]) => {
    if (!scene.textures.exists(textureKey)) throw new Error(`Missing ${team} runtime texture.`);
    const source = scene.textures.get(textureKey).getSourceImage();
    const atlasResponse = await fetch(atlasPath, { cache: "no-store" });
    if (!atlasResponse.ok) throw new Error(`${atlasPath} returned HTTP ${atlasResponse.status}.`);
    const atlas = await atlasResponse.json();
    return {
      team,
      textureKey,
      width: source?.width ?? 0,
      height: source?.height ?? 0,
      mipmaps: atlas.meta?.mipmaps,
      rgbaBytes: (source?.width ?? 0) * (source?.height ?? 0) * 4
    };
  }));
});

const prepareFixedScene = async (page, route) => page.evaluate((requestedRoute) => {
  const game = window.__FPS_GAME__;
  const scene = game?.scene.keys.MainScene;
  if (game === undefined || scene === undefined) throw new Error("Missing MainScene test handle.");
  scene.debugEnterStage();
  scene.debugSetWeather("storm");
  scene.debugMovePlayerTo(340, 270);
  scene.debugMoveDummyTo(620, 270);
  scene.debugSetPlayerHullAngle(Math.PI);
  scene.debugSetPlayerAimAngle(0);
  scene.debugRestoreActorHealth();
  scene.debugClearActorHitFeedback();
  scene.debugRefreshActorPresentation();
  const debug = scene.getDebugSnapshot();
  const canvas = document.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing game canvas.");
  const renderer = game.renderer;
  const gl = renderer.gl;
  const debugRendererInfo = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    route: requestedRoute,
    presentation: scene.visualController.getDebugState(),
    weather: scene.weatherRenderer.getDebugState(),
    debug: {
      phase: debug.phase,
      stage: debug.stage,
      playerX: debug.playerX,
      playerY: debug.playerY,
      dummyX: debug.dummyX,
      dummyY: debug.dummyY,
      globalWeather: debug.weather.global.type,
      effectiveWeather: debug.weather.effective.type
    },
    canvas: { width: canvas.width, height: canvas.height },
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    visibilityState: document.visibilityState,
    rendererType: renderer.type,
    renderer: gl === undefined ? null : {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      unmaskedVendor: debugRendererInfo === null
        ? null
        : gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL),
      unmaskedRenderer: debugRendererInfo === null
        ? null
        : gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL)
    }
  };
}, route);

const waitAnimationFrames = async (page, durationMs) => page.evaluate((duration) => new Promise((resolve) => {
  let startedAt;
  const step = (timestamp) => {
    startedAt ??= timestamp;
    if (timestamp - startedAt >= duration) {
      resolve();
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), durationMs);

const captureRawFrameDeltas = async (page) => page.evaluate((duration) => new Promise((resolve) => {
  const deltas = [];
  let startedAt;
  let previous;
  const step = (timestamp) => {
    startedAt ??= timestamp;
    if (previous !== undefined) deltas.push(timestamp - previous);
    previous = timestamp;
    if (timestamp - startedAt >= duration) {
      resolve(deltas);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), SAMPLE_MS);

const capture = async (browser, context, route, sequence) => {
  const page = await context.newPage();
  const errors = { console: [], page: [], failedRequests: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("requestfailed", (request) => {
    errors.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.httpErrors.push(`${response.request().method()} ${response.url()}: HTTP ${response.status()}`);
    }
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.__PHASE11_PERF_UNHANDLED__ = [];
    window.__PHASE11_PERF_VISIBILITY__ = [document.visibilityState];
    window.addEventListener("unhandledrejection", (event) => {
      window.__PHASE11_PERF_UNHANDLED__.push(String(event.reason));
    });
    document.addEventListener("visibilitychange", () => {
      window.__PHASE11_PERF_VISIBILITY__.push(document.visibilityState);
    });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  const pathName = route === "animated" ? "/" : "/?actorSkin=legacy-vehicle";
  await page.goto(`${BASE_URL}${pathName}`, { timeout: 120_000 });
  try {
    await page.locator("canvas").waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForFunction(
      () => typeof window.__FPS_GAME__?.scene.keys.MainScene?.visualController?.getDebugState === "function",
      undefined,
      { timeout: 120_000 }
    );
  } catch (error) {
    throw new Error(`Failed to prepare ${route} performance page: ${JSON.stringify(errors)}`, { cause: error });
  }
  const fixedScene = await prepareFixedScene(page, route);
  const payloads = route === "animated" ? await collectActorPayloads(page) : [];
  const textures = route === "animated" ? await collectTextureMetadata(page) : [];
  await waitAnimationFrames(page, WARMUP_MS);
  const rawFrameDeltasMs = await captureRawFrameDeltas(page);
  const pageState = await page.evaluate(() => ({
    unhandledRejections: window.__PHASE11_PERF_UNHANDLED__ ?? [],
    visibilityStates: window.__PHASE11_PERF_VISIBILITY__ ?? [document.visibilityState]
  }));
  const result = {
    sequence,
    route,
    path: pathName,
    fixedScene,
    warmupMs: WARMUP_MS,
    sampleMs: SAMPLE_MS,
    summary: summarize(rawFrameDeltasMs),
    rawFrameDeltasMs,
    payloads,
    textures,
    gpuRgbaBytes: textures.reduce((sum, texture) => sum + texture.rgbaBytes, 0),
    errors: { ...errors, ...pageState }
  };
  await cdp.detach();
  await page.close();
  return result;
};

const validateCapture = (captureResult, failures) => {
  const prefix = `capture ${captureResult.sequence} (${captureResult.route})`;
  if (captureResult.summary.sampleCount < MIN_SAMPLE_COUNT) {
    failures.push(`${prefix}: only ${captureResult.summary.sampleCount} frame samples (minimum ${MIN_SAMPLE_COUNT})`);
  }
  if (captureResult.fixedScene.canvas.width !== 960 || captureResult.fixedScene.canvas.height !== 540) {
    failures.push(`${prefix}: canvas is ${captureResult.fixedScene.canvas.width}x${captureResult.fixedScene.canvas.height}`);
  }
  if (captureResult.fixedScene.viewport.width !== 960 || captureResult.fixedScene.viewport.height !== 540 ||
    captureResult.fixedScene.viewport.devicePixelRatio !== 1) {
    failures.push(`${prefix}: viewport contract mismatch`);
  }
  if (captureResult.fixedScene.visibilityState !== "visible" ||
    captureResult.errors.visibilityStates.some((state) => state !== "visible")) {
    failures.push(`${prefix}: page was not continuously visible`);
  }
  const rendererName = captureResult.fixedScene.renderer?.unmaskedRenderer ?? "";
  if (rendererName.length === 0 || /swiftshader|software/i.test(rendererName)) {
    failures.push(`${prefix}: hardware WebGL renderer was not active (${rendererName || "unknown"})`);
  }
  for (const [kind, values] of Object.entries(captureResult.errors)) {
    if (kind !== "visibilityStates" && values.length > 0) failures.push(`${prefix}: ${kind}=${JSON.stringify(values)}`);
  }
  if (captureResult.fixedScene.weather.type !== "storm") failures.push(`${prefix}: storm state was not active`);
  if (captureResult.fixedScene.debug.phase !== "TEAM SELECT") failures.push(`${prefix}: phase was ${captureResult.fixedScene.debug.phase}`);
  if (captureResult.fixedScene.debug.stage !== "foundry") failures.push(`${prefix}: stage was ${captureResult.fixedScene.debug.stage}`);
  if (captureResult.fixedScene.debug.globalWeather !== "storm" || captureResult.fixedScene.debug.effectiveWeather !== "storm") {
    failures.push(`${prefix}: debug weather was ${captureResult.fixedScene.debug.globalWeather}/${captureResult.fixedScene.debug.effectiveWeather}`);
  }
  const expectedPositions = { playerX: 340, playerY: 270, dummyX: 620, dummyY: 270 };
  for (const [field, expected] of Object.entries(expectedPositions)) {
    if (Math.abs(captureResult.fixedScene.debug[field] - expected) > 0.01) {
      failures.push(`${prefix}: ${field} was ${captureResult.fixedScene.debug[field]}`);
    }
  }
  const expectedSkin = captureResult.route === "animated" ? "quaternius-animated" : "legacy-vehicle";
  if (captureResult.fixedScene.presentation.skinId !== expectedSkin) failures.push(`${prefix}: resolved ${captureResult.fixedScene.presentation.skinId}`);
  if (captureResult.route === "animated") {
    if (captureResult.textures.length !== 2 || captureResult.textures.some((texture) =>
      texture.width !== 2048 || texture.height !== 2048 || texture.mipmaps !== false)) {
      failures.push(`${prefix}: texture metadata mismatch`);
    }
    if (captureResult.gpuRgbaBytes !== 33_554_432) failures.push(`${prefix}: GPU bytes ${captureResult.gpuRgbaBytes}`);
    const atlasBytes = captureResult.payloads
      .filter((payload) => !payload.path.endsWith("manifest.json"))
      .reduce((sum, payload) => sum + payload.bytes, 0);
    const strictBytes = captureResult.payloads.reduce((sum, payload) => sum + payload.bytes, 0);
    if (atlasBytes !== 788_828) failures.push(`${prefix}: actor atlas payload is ${atlasBytes} bytes`);
    if (strictBytes > 8 * 1024 * 1024) failures.push(`${prefix}: strict actor payload is ${strictBytes} bytes`);
  }
};

const main = async () => {
  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65_535) throw new Error(`Invalid PHASE11_PERF_PORT: ${PORT}`);
  if (!existsSync(DIST_INDEX)) throw new Error("Missing dist/index.html. Run npm run build before the performance gate.");
  const distIndexStats = await stat(DIST_INDEX);
  const buildAgeMs = Date.now() - distIndexStats.mtimeMs;
  if (buildAgeMs < 0 || buildAgeMs > MAX_BUILD_AGE_MS) {
    throw new Error(`dist/index.html is not fresh (${Math.round(buildAgeMs / 1_000)}s old). Run npm run build immediately before the performance gate.`);
  }
  const previewOutput = [];
  const server = spawn(process.execPath, [VITE_ENTRY, "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: PROJECT_ROOT,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => previewOutput.push(chunk.toString()));
  server.stderr.on("data", (chunk) => previewOutput.push(chunk.toString()));

  let browser;
  const captures = [];
  try {
    await waitForServer(server, previewOutput);
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: [
        "--enable-gpu",
        "--use-angle=d3d11",
        "--disable-software-rasterizer",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows"
      ]
    });
    const context = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1,
      serviceWorkers: "block"
    });
    let sequence = 0;
    for (const order of CAPTURE_ORDERS) {
      for (const route of order) {
        sequence += 1;
        captures.push(await capture(browser, context, route, sequence));
      }
    }
    await context.close();

    const playwrightPackage = JSON.parse(await readFile(path.join(PROJECT_ROOT, "node_modules", "@playwright", "test", "package.json"), "utf8"));
    const pairs = CAPTURE_ORDERS.map((order, pairIndex) => {
      const pairCaptures = captures.slice(pairIndex * 2, pairIndex * 2 + 2);
      const legacy = pairCaptures.find((entry) => entry.route === "legacy");
      const animated = pairCaptures.find((entry) => entry.route === "animated");
      return {
        pair: pairIndex + 1,
        order,
        legacyP95Ms: legacy.summary.p95Ms,
        animatedP95Ms: animated.summary.p95Ms,
        deltaMs: round(animated.summary.p95Ms - legacy.summary.p95Ms)
      };
    });
    const failures = [];
    for (const captureResult of captures) validateCapture(captureResult, failures);
    for (const pair of pairs) {
      if (pair.deltaMs > REGRESSION_LIMIT_MS) {
        failures.push(`pair ${pair.pair}: animated regression ${pair.deltaMs}ms exceeds ${REGRESSION_LIMIT_MS}ms`);
      }
    }

    const qualification = evaluatePerformanceQualification(captures, pairs, failures);
    const report = {
      schemaVersion: "1.1.0",
      measuredAt: new Date().toISOString(),
      workspaceFingerprint: workspaceFingerprint(WORKSPACE_ROOT),
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim(),
      environment: {
        platform: process.platform,
        release: os.release(),
        architecture: process.arch,
        cpu: os.cpus()[0]?.model ?? "unknown",
        logicalCpuCount: os.cpus().length,
        node: process.version,
        playwright: playwrightPackage.version,
        chromium: browser.version(),
        chromiumChannel: "chrome",
        chromiumExecutable: "system Chrome selected by Playwright channel",
        pid: process.pid
      },
      controls: {
        productionBuild: true,
        distIndexModifiedAt: distIndexStats.mtime.toISOString(),
        distIndexAgeMsAtStart: Math.round(buildAgeMs),
        server: BASE_URL,
        browserMode: "headless-hardware-webgl-d3d11",
        browserContexts: 1,
        concurrentPages: 1,
        cacheDisabled: true,
        serviceWorkers: "blocked",
        viewport: { width: 960, height: 540, deviceScaleFactor: 1 },
        expectedStage: "foundry",
        expectedWeather: "storm",
        expectedActors: { player: { x: 340, y: 270 }, dummy: { x: 620, y: 270 } },
        combatAndAiSideEffects: "disabled by remaining outside COMBAT LIVE",
        warmupMs: WARMUP_MS,
        sampleMs: SAMPLE_MS,
        captureOrders: CAPTURE_ORDERS
      },
      observedScenarios: captures.map((entry) => ({
        sequence: entry.sequence,
        route: entry.route,
        debug: entry.fixedScene.debug,
        weatherRenderer: entry.fixedScene.weather.type,
        presentation: {
          requestedSkinId: entry.fixedScene.presentation.requestedSkinId,
          skinId: entry.fixedScene.presentation.skinId,
          atlasActive: entry.fixedScene.presentation.atlasActive,
          playerState: entry.fixedScene.presentation.playerState,
          dummyState: entry.fixedScene.presentation.dummyState
        }
      })),
      limits: {
        animatedP95Ms: FRAME_P95_LIMIT_MS,
        regressionMs: REGRESSION_LIMIT_MS,
        displayCadence: PERFORMANCE_QUALIFICATION_LIMITS,
        transferBytes: 8 * 1024 * 1024,
        gpuRgbaBytes: 32 * 1024 * 1024
      },
      captures,
      pairs,
      failures,
      absolutePassed: qualification.absolutePassed,
      cadenceQualified: qualification.cadenceQualified,
      qualification: qualification.qualification,
      absoluteFailures: qualification.absoluteFailures,
      cadenceFailures: qualification.cadenceFailures,
      passed: qualification.passed
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      output: OUTPUT_PATH,
      workspaceFingerprint: report.workspaceFingerprint,
      pairs,
      captures: captures.map((entry) => ({ sequence: entry.sequence, route: entry.route, ...entry.summary })),
      absolutePassed: report.absolutePassed,
      cadenceQualified: report.cadenceQualified,
      qualification: report.qualification,
      passed: report.passed,
      failures,
      absoluteFailures: report.absoluteFailures,
      cadenceFailures: report.cadenceFailures
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser?.close();
    await stopServer(server);
  }
};

await main();
