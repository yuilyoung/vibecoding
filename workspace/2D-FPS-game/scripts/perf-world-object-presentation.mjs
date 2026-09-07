import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { workspaceFingerprint } from "../../../plugins/hermes-ssot/scripts/harness-controller.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORKSPACE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DIST_INDEX = path.join(PROJECT_ROOT, "dist", "index.html");
const VITE_ENTRY = path.join(PROJECT_ROOT, "node_modules", "vite", "bin", "vite.js");
const REPORTS_ROOT = path.join(PROJECT_ROOT, "docs", "reports");
const T3_OUTPUT_PATH = path.join(REPORTS_ROOT, "phase12-t3-evidence", "phase12-t3-world-object-performance.json");
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, process.env.PHASE12_PERF_OUTPUT ?? T3_OUTPUT_PATH);
const PORT = Number(process.env.PHASE12_PERF_PORT ?? 4192);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MAX_BUILD_AGE_MS = 10 * 60 * 1_000;
const WARMUP_SAMPLES = 500;
const MEASURED_SAMPLES = 3_000;
const P95_LIMIT_MS = 0.5;
const FRAME_INTERVAL_LIMIT_MS = 16.7;
const CAPTURE_ORDERS = [["legacy", "product"], ["product", "legacy"], ["legacy", "product"]];
const EXPECTED_PRODUCT_FAMILIES = [
  "ammo-pickup", "arena-obstacle", "barrel", "bounce-wall", "cover", "crate",
  "health-pickup", "mine", "service-gate", "teleporter", "vent-hazard"
];

const round = (value, digits = 4) => Number(value.toFixed(digits));
const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? Number.POSITIVE_INFINITY;
};
const summarize = (samples) => ({
  sampleCount: samples.length,
  p50Ms: round(percentile(samples, 0.5)),
  p95Ms: round(percentile(samples, 0.95)),
  maxMs: round(Math.max(...samples)),
  meanMs: round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
  samplesOverFrameInterval: samples.filter((value) => value > FRAME_INTERVAL_LIMIT_MS).length
});

const waitForServer = async (server, output) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited (${server.exitCode}).\n${output.join("")}`);
    try {
      const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The bounded readiness loop owns transient connection failures.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview was not ready at ${BASE_URL}.\n${output.join("")}`);
};

const stopServer = async (server) => {
  if (server.exitCode !== null) return;
  server.kill();
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
};

const capture = async (context, route, sequence) => {
  const page = await context.newPage();
  const errors = { console: [], page: [], failedRequests: [], httpErrors: [] };
  page.on("console", (message) => { if (message.type() === "error") errors.console.push(message.text()); });
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("requestfailed", (request) => errors.failedRequests.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => window.localStorage.clear());
  const pathName = route === "product"
    ? "/?actorSkin=quaternius-animated&worldSkin=product-v1"
    : "/?actorSkin=quaternius-animated&worldSkin=legacy";
  await page.goto(`${BASE_URL}${pathName}`, { timeout: 120_000 });
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene;
    try { return scene?.debugGetWorldObjectPresentation().initialized === true; } catch { return false; }
  });
  const fixedScene = await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene;
    if (game === undefined || scene === undefined) throw new Error("Missing MainScene performance handle.");
    scene.debugEnterStage();
    while (scene.getDebugSnapshot().stage !== "relay-yard") scene.debugRotateStage();
    scene.debugSetWeather("storm");
    scene.debugMovePlayerTo(100, 100);
    scene.debugMoveDummyTo(840, 440);
    const gl = game.renderer.gl;
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      stage: scene.getDebugSnapshot().stage,
      weather: scene.getDebugSnapshot().weather.effective.type,
      presentation: scene.debugGetWorldObjectPresentation(),
      objectCount: scene.debugGetMapObjectStates().length,
      renderer: info === null || gl === undefined ? null : gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    };
  });
  const rawSamplesMs = await page.evaluate(({ warmup, samples }) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene;
    if (scene === undefined) throw new Error("Missing MainScene performance handle.");
    for (let index = 0; index < warmup; index += 1) scene.debugAdvanceMapObjects(100_000 + index);
    const values = [];
    for (let index = 0; index < samples; index += 1) {
      const startedAt = performance.now();
      scene.debugAdvanceMapObjects(200_000 + index);
      values.push(performance.now() - startedAt);
    }
    return values;
  }, { warmup: WARMUP_SAMPLES, samples: MEASURED_SAMPLES });
  await page.close();
  return { sequence, route, path: pathName, fixedScene, summary: summarize(rawSamplesMs), rawSamplesMs, errors };
};

const main = async () => {
  if (OUTPUT_PATH !== T3_OUTPUT_PATH) {
    throw new Error("PHASE12_PERF_OUTPUT must resolve to the Phase 12 T3 performance artifact.");
  }
  if (!existsSync(DIST_INDEX)) throw new Error("Missing dist/index.html. Run npm run build first.");
  const build = await stat(DIST_INDEX);
  const buildAgeMs = Date.now() - build.mtimeMs;
  if (buildAgeMs < 0 || buildAgeMs > MAX_BUILD_AGE_MS) throw new Error("Production build is stale. Run npm run build immediately before this gate.");
  const output = [];
  const server = spawn(process.execPath, [VITE_ENTRY, "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: PROJECT_ROOT,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => output.push(chunk.toString()));
  server.stderr.on("data", (chunk) => output.push(chunk.toString()));
  let browser;
  try {
    await waitForServer(server, output);
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--enable-gpu", "--use-angle=d3d11", "--disable-software-rasterizer"]
    });
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    const captures = [];
    let sequence = 0;
    for (const order of CAPTURE_ORDERS) {
      for (const route of order) captures.push(await capture(context, route, ++sequence));
    }
    await context.close();
    const pairs = CAPTURE_ORDERS.map((order, index) => {
      const entries = captures.slice(index * 2, index * 2 + 2);
      const legacy = entries.find((entry) => entry.route === "legacy");
      const product = entries.find((entry) => entry.route === "product");
      return {
        pair: index + 1,
        order,
        legacyP95Ms: legacy.summary.p95Ms,
        productP95Ms: product.summary.p95Ms,
        regressionP95Ms: round(product.summary.p95Ms - legacy.summary.p95Ms)
      };
    });
    const failures = [];
    for (const entry of captures) {
      if (entry.summary.sampleCount !== MEASURED_SAMPLES) failures.push(`capture ${entry.sequence}: sample count mismatch`);
      if (entry.summary.samplesOverFrameInterval !== 0) failures.push(`capture ${entry.sequence}: samples exceeded ${FRAME_INTERVAL_LIMIT_MS}ms`);
      if (entry.fixedScene.stage !== "relay-yard" || entry.fixedScene.weather !== "storm" || entry.fixedScene.objectCount !== 15) {
        failures.push(`capture ${entry.sequence}: fixed-scene mismatch`);
      }
      if (/swiftshader|software/i.test(entry.fixedScene.renderer ?? "")) failures.push(`capture ${entry.sequence}: hardware renderer missing`);
      if (Object.values(entry.errors).some((values) => values.length > 0)) failures.push(`capture ${entry.sequence}: runtime errors`);
      const expected = entry.route === "product" ? "product-v1" : "legacy";
      if (entry.fixedScene.presentation.skinId !== expected) failures.push(`capture ${entry.sequence}: resolved ${entry.fixedScene.presentation.skinId}`);
      if (entry.route === "legacy" && (entry.fixedScene.presentation.overlayCount !== 0 || entry.fixedScene.presentation.objects.length !== 0)) {
        failures.push(`capture ${entry.sequence}: legacy presentation was not empty`);
      }
      if (entry.route === "product") {
        const families = [...new Set(entry.fixedScene.presentation.objects.map((object) => object.family))].sort();
        if (entry.fixedScene.presentation.overlayCount !== 22 || entry.fixedScene.presentation.objects.length !== 22) {
          failures.push(`capture ${entry.sequence}: product overlay inventory mismatch`);
        }
        if (JSON.stringify(families) !== JSON.stringify(EXPECTED_PRODUCT_FAMILIES)) {
          failures.push(`capture ${entry.sequence}: product family coverage mismatch`);
        }
      }
      if (entry.route === "product" && entry.summary.p95Ms > P95_LIMIT_MS) failures.push(`capture ${entry.sequence}: product p95 ${entry.summary.p95Ms}ms`);
    }
    for (const pair of pairs) {
      if (pair.regressionP95Ms > P95_LIMIT_MS) failures.push(`pair ${pair.pair}: regression ${pair.regressionP95Ms}ms`);
    }
    const report = {
      schemaVersion: "1.0.0",
      measuredAt: new Date().toISOString(),
      workspaceFingerprint: workspaceFingerprint(WORKSPACE_ROOT),
      commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim(),
      environment: { platform: process.platform, release: os.release(), architecture: process.arch, cpu: os.cpus()[0]?.model, node: process.version, chromium: browser.version() },
      controls: { productionBuild: true, buildModifiedAt: build.mtime.toISOString(), buildAgeMsAtStart: Math.round(buildAgeMs), viewport: { width: 960, height: 540, deviceScaleFactor: 1 }, stage: "relay-yard", weather: "storm", actors: "quaternius-animated", warmupSamples: WARMUP_SAMPLES, measuredSamples: MEASURED_SAMPLES, captureOrders: CAPTURE_ORDERS },
      limits: { productP95Ms: P95_LIMIT_MS, regressionP95Ms: P95_LIMIT_MS, frameIntervalMs: FRAME_INTERVAL_LIMIT_MS },
      captures,
      pairs,
      failures,
      passed: failures.length === 0
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: OUTPUT_PATH, pairs, captures: captures.map(({ sequence: id, route, summary }) => ({ sequence: id, route, ...summary })), failures, passed: report.passed }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser?.close();
    await stopServer(server);
  }
};

await main();
