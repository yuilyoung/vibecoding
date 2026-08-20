import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

test.describe.configure({ mode: "serial", timeout: 180_000 });

type Team = "BLUE" | "RED";
type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";
type AnimationState = "idle" | "run" | "fire" | "hit" | "death";
type Direction = "east" | "south-east" | "south" | "south-west" | "west" | "north-west" | "north" | "north-east";

const TEAMS = ["BLUE", "RED"] as const;
const WEATHER_TYPES = ["clear", "rain", "fog", "sandstorm", "storm"] as const;
const DIRECTIONS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"] as const;
const STATE_CONTRACT = {
  idle: { frames: 4, frameRate: 6, repeat: -1 },
  run: { frames: 6, frameRate: 12, repeat: -1 },
  fire: { frames: 4, frameRate: 12, repeat: 0 },
  hit: { frames: 2, frameRate: 12, repeat: 0 },
  death: { frames: 6, frameRate: 8, repeat: 0 }
} as const;
const PROJECT_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "../..");
const HARNESS_CONTROLLER = path.resolve(
  WORKSPACE_ROOT,
  "plugins/hermes-ssot/scripts/harness-controller.mjs"
);
const ARTIFACT_DIR = path.resolve(
  PROJECT_ROOT,
  process.env.PHASE11_T4_ARTIFACT_DIR ?? "docs/reports/phase11-t4-evidence"
);

const readWorkspaceFingerprint = (): string => execFileSync(process.execPath, [
  "--input-type=module",
  "--eval",
  `import { workspaceFingerprint } from ${JSON.stringify(pathToFileURL(HARNESS_CONTROLLER).href)};` +
    `process.stdout.write(workspaceFingerprint(${JSON.stringify(WORKSPACE_ROOT)}));`
], { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim();

const SOURCE_WORKSPACE_FINGERPRINT = readWorkspaceFingerprint();
const SOURCE_COMMIT = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: WORKSPACE_ROOT,
  encoding: "utf8"
}).trim();

interface AnimatedActorDebugState {
  readonly requestedSkinId: string;
  readonly skinId: string;
  readonly fallbackReason: string | null;
  readonly atlasActive: boolean;
  readonly playerState: AnimationState;
  readonly dummyState: AnimationState;
  readonly playerDirection: Direction;
  readonly dummyDirection: Direction;
  readonly playerTextureKey: string | null;
  readonly dummyTextureKey: string | null;
  readonly playerAnimationKey: string | null;
  readonly dummyAnimationKey: string | null;
  readonly playerFrameName: string | number | null;
  readonly dummyFrameName: string | number | null;
  readonly playerWeaponVisible: boolean;
  readonly dummyWeaponVisible: boolean;
  readonly playerWeaponRotation: number | null;
  readonly dummyWeaponRotation: number | null;
}

interface AnimatedActorScene {
  readonly add: {
    sprite(x: number, y: number, texture: string): RuntimeSprite;
  };
  readonly anims: {
    get(key: string): RuntimeAnimation | undefined;
  };
  readonly children: {
    list: RuntimeDisplayObject[];
  };
  readonly textures: {
    exists(key: string): boolean;
    get(key: string): {
      getSourceImage(): { width?: number; height?: number } | undefined;
    };
  };
  readonly visualController: {
    getDebugState(): AnimatedActorDebugState;
    updatePlayerVisuals(now: number): void;
    updateDummyVisuals(now: number): void;
    updateWeaponVisuals(): void;
  };
  readonly weatherRenderer: {
    getDebugState(): { type: WeatherType };
  };
  readonly time: { now: number };
  debugEnterStage(): void;
  debugSelectTeam(team: Team): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: WeatherType): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugSetPlayerHullAngle(angleRadians: number): void;
  debugSetPlayerAimAngle(angleRadians: number): void;
  debugClearActorHitFeedback(): void;
  debugHoldPlayerFirePresentation(durationMs?: number): void;
  debugHoldActorHitPresentation(actor: "player" | "dummy", durationMs?: number): void;
  debugRestoreActorHealth(): void;
  debugDamagePlayer(amount: number): void;
  debugRefreshActorPresentation(): void;
  getDebugSnapshot(): { phase: string };
}

interface RuntimeAnimationFrame {
  readonly frame: { readonly name: string | number };
}

interface RuntimeAnimation {
  readonly frames: readonly RuntimeAnimationFrame[];
  readonly frameRate: number;
  readonly repeat: number;
}

interface RuntimeSprite {
  readonly frame: { readonly name: string | number };
  readonly anims: {
    readonly isPlaying: boolean;
    update(time: number, delta: number): void;
  };
  play(key: string): RuntimeSprite;
  once(event: string, callback: () => void): RuntimeSprite;
  off(event: string, callback: () => void): RuntimeSprite;
  destroy(): void;
}

interface RuntimeDisplayObject {
  readonly x?: number;
  readonly y?: number;
  readonly alpha?: number;
  readonly visible?: boolean;
  readonly texture?: { readonly key?: string };
  readonly anims?: {
    setProgress(value: number): unknown;
    pause(): unknown;
    resume(): unknown;
  };
}

interface RuntimeErrors {
  readonly console: string[];
  readonly page: string[];
  readonly failedRequests: string[];
  readonly httpErrors: string[];
}

interface PixelRegionStats {
  readonly name: string;
  readonly pixels: number;
  readonly nonBlackRatio: number;
  readonly luminanceMin: number;
  readonly luminanceMax: number;
  readonly luminanceMean: number;
  readonly luminanceStdDev: number;
}

interface CaptureIndexEntry {
  readonly file: string;
  readonly team: Team;
  readonly weather: WeatherType;
  readonly state: AnimationState;
  readonly presentation: AnimatedActorDebugState;
  readonly visibleActors: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly pixels: {
    readonly fullCanvas: PixelRegionStats;
    readonly playerRegion: PixelRegionStats;
    readonly dummyRegion: PixelRegionStats;
  };
}

const captureIndex: CaptureIndexEntry[] = [];

const installRuntimeErrorCapture = async (page: Page): Promise<RuntimeErrors> => {
  const errors: RuntimeErrors = { console: [], page: [], failedRequests: [], httpErrors: [] };
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
    const target = window as typeof window & { __PHASE11_UNHANDLED_REJECTIONS__?: string[] };
    target.__PHASE11_UNHANDLED_REJECTIONS__ = [];
    window.addEventListener("unhandledrejection", (event) => {
      target.__PHASE11_UNHANDLED_REJECTIONS__?.push(String(event.reason));
    });
  });
  return errors;
};

const expectCleanRuntime = async (page: Page, errors: RuntimeErrors): Promise<void> => {
  const unhandled = await page.evaluate(() => {
    const target = window as typeof window & { __PHASE11_UNHANDLED_REJECTIONS__?: string[] };
    return target.__PHASE11_UNHANDLED_REJECTIONS__ ?? [];
  });
  expect(errors).toEqual({ console: [], page: [], failedRequests: [], httpErrors: [] });
  expect(unhandled).toEqual([]);
};

const openGame = async (page: Page, path: string): Promise<RuntimeErrors> => {
  const errors = await installRuntimeErrorCapture(page);
  await page.setViewportSize({ width: 1_600, height: 1_300 });
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    return typeof scene?.visualController?.getDebugState === "function";
  });
  return errors;
};

const readPresentation = (page: Page): Promise<AnimatedActorDebugState> => page.evaluate(() => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");
  return scene.visualController.getDebugState();
});

const enterCombat = async (page: Page, team: Team): Promise<void> => {
  await page.evaluate((selectedTeam: Team) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugEnterStage();
    scene.debugSelectTeam(selectedTeam);
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
    scene.debugMovePlayerTo(340, 270);
    scene.debugMoveDummyTo(620, 270);
    scene.debugSetPlayerHullAngle(Math.PI);
    scene.debugSetPlayerAimAngle(0);
    scene.debugRestoreActorHealth();
    scene.debugClearActorHitFeedback();
    scene.debugRefreshActorPresentation();
  }, team);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    return scene?.getDebugSnapshot().phase;
  })).toBe("COMBAT LIVE");
  const canvasBounds = await page.locator("canvas").boundingBox();
  if (canvasBounds === null) throw new Error("Missing canvas bounds.");
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * (900 / 960),
    canvasBounds.y + canvasBounds.height * (270 / 540)
  );
};

const applyReadabilityState = async (page: Page, state: AnimationState): Promise<void> => {
  await page.evaluate((requestedState: AnimationState) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    scene.debugMovePlayerTo(340, 270);
    scene.debugMoveDummyTo(620, 270);
    scene.debugSetPlayerHullAngle(Math.PI);
    scene.debugSetPlayerAimAngle(0);
    scene.debugRestoreActorHealth();
    scene.debugClearActorHitFeedback();
    if (requestedState === "fire") scene.debugHoldPlayerFirePresentation(5_000);
    if (requestedState === "hit") {
      scene.debugHoldActorHitPresentation("player", 5_000);
      scene.debugHoldActorHitPresentation("dummy", 5_000);
    }
    if (requestedState === "death") scene.debugDamagePlayer(10_000);
    scene.debugRefreshActorPresentation();
  }, state);

  if (state === "run") {
    await page.keyboard.down("ArrowLeft");
  }

  await expect.poll(async () => (await readPresentation(page)).playerState).toBe(state);
};

const freezeRenderedScene = async (page: Page): Promise<number> => {
  const visibleActors = await page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    const actors = scene.children.list.filter((child) => child.texture?.key?.startsWith("actor-animated-") === true);
    for (const actor of actors) {
      actor.anims?.setProgress(0.5);
      actor.anims?.pause();
    }
    return actors.filter((actor) => actor.visible !== false && (actor.alpha ?? 0) > 0 &&
      (actor.x ?? -1) >= 0 && (actor.x ?? 961) <= 960 && (actor.y ?? -1) >= 0 && (actor.y ?? 541) <= 540).length;
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.evaluate(() => window.__FPS_GAME__?.loop.sleep());
  return visibleActors;
};

const resumeRenderedScene = (page: Page): Promise<void> => page.evaluate(() => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene test handle.");
  for (const actor of scene.children.list) actor.anims?.resume();
  window.__FPS_GAME__?.loop.wake();
});

const calculateRegionStats = (
  pixels: Buffer,
  imageWidth: number,
  channels: number,
  name: string,
  left: number,
  top: number,
  width: number,
  height: number
): PixelRegionStats => {
  let luminanceMin = Number.POSITIVE_INFINITY;
  let luminanceMax = Number.NEGATIVE_INFINITY;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;
  let nonBlackPixels = 0;
  const pixelCount = width * height;
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const offset = (y * imageWidth + x) * channels;
      const luminance = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
      luminanceMin = Math.min(luminanceMin, luminance);
      luminanceMax = Math.max(luminanceMax, luminance);
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
      if (luminance >= 12) nonBlackPixels += 1;
    }
  }
  const luminanceMean = luminanceSum / pixelCount;
  const variance = Math.max(0, luminanceSquareSum / pixelCount - luminanceMean * luminanceMean);
  return {
    name,
    pixels: pixelCount,
    nonBlackRatio: Number((nonBlackPixels / pixelCount).toFixed(6)),
    luminanceMin: Number(luminanceMin.toFixed(3)),
    luminanceMax: Number(luminanceMax.toFixed(3)),
    luminanceMean: Number(luminanceMean.toFixed(3)),
    luminanceStdDev: Number(Math.sqrt(variance).toFixed(3))
  };
};

const inspectPng = async (bytes: Buffer): Promise<CaptureIndexEntry["pixels"]> => {
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(decoded.info.width).toBe(960);
  expect(decoded.info.height).toBe(540);
  const region = (name: string, left: number, top: number, width: number, height: number): PixelRegionStats =>
    calculateRegionStats(decoded.data, decoded.info.width, decoded.info.channels, name, left, top, width, height);
  return {
    fullCanvas: region("full-canvas", 0, 0, 960, 540),
    playerRegion: region("player", 300, 230, 80, 80),
    dummyRegion: region("dummy", 580, 230, 80, 80)
  };
};

const captureCompositedCanvas = async (
  page: Page,
  fileName: string,
  team: Team,
  weather: WeatherType,
  state: AnimationState
): Promise<CaptureIndexEntry> => {
  const visibleActors = await freezeRenderedScene(page);
  const canvas = page.locator("canvas");
  await canvas.evaluate((element) => {
    element.dataset.phase11OriginalStyle = element.getAttribute("style") ?? "";
    element.style.setProperty("width", "960px", "important");
    element.style.setProperty("height", "540px", "important");
    element.style.setProperty("max-width", "none", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("box-sizing", "border-box", "important");
    element.style.setProperty("border", "0", "important");
    element.style.setProperty("transform", "none", "important");
  });
  let screenshot: Buffer;
  try {
    const bounds = await canvas.boundingBox();
    if (bounds === null) throw new Error("Missing canvas bounds for T4 capture.");
    screenshot = await page.screenshot({
      type: "png",
      clip: { x: bounds.x, y: bounds.y, width: 960, height: 540 }
    });
  } finally {
    await canvas.evaluate((element) => {
      const originalStyle = element.dataset.phase11OriginalStyle ?? "";
      if (originalStyle.length === 0) element.removeAttribute("style");
      else element.setAttribute("style", originalStyle);
      delete element.dataset.phase11OriginalStyle;
    });
    await resumeRenderedScene(page);
  }
  const metadata = await sharp(screenshot).metadata();
  const pixels = await inspectPng(screenshot);
  expect(pixels.fullCanvas.luminanceMax - pixels.fullCanvas.luminanceMin).toBeGreaterThan(32);
  expect(pixels.fullCanvas.luminanceStdDev).toBeGreaterThan(5);
  expect(pixels.fullCanvas.nonBlackRatio).toBeGreaterThan(0.05);
  for (const actorRegion of [pixels.playerRegion, pixels.dummyRegion]) {
    expect(actorRegion.luminanceMax - actorRegion.luminanceMin, actorRegion.name).toBeGreaterThan(16);
    expect(actorRegion.luminanceStdDev, actorRegion.name).toBeGreaterThan(2);
    expect(actorRegion.nonBlackRatio, actorRegion.name).toBeGreaterThan(0.02);
  }
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(path.join(ARTIFACT_DIR, fileName), screenshot);
  const entry: CaptureIndexEntry = {
    file: fileName,
    team,
    weather,
    state,
    presentation: await readPresentation(page),
    visibleActors,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    bytes: screenshot.byteLength,
    sha256: createHash("sha256").update(screenshot).digest("hex"),
    pixels
  };
  captureIndex.push(entry);
  return entry;
};

const persistJsonArtifact = async (fileName: string, value: unknown): Promise<Buffer> => {
  const body = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(path.join(ARTIFACT_DIR, fileName), body);
  return body;
};

const assertCapture = (entry: CaptureIndexEntry): void => {
  expect(entry.width).toBe(960);
  expect(entry.height).toBe(540);
  expect(entry.visibleActors).toBe(2);
  expect(entry.presentation).toMatchObject({
    skinId: "quaternius-animated",
    atlasActive: true,
    playerState: entry.state,
    playerWeaponVisible: true,
    dummyWeaponVisible: true
  });
  expect(entry.presentation.playerFrameName).toMatch(new RegExp(`^actor/(blue|red)/${entry.state}/`));
  expect(entry.presentation.playerDirection).toBe(entry.state === "fire" ? "east" : "west");
  const weaponAim = (entry.presentation.playerWeaponRotation ?? 0) - Math.PI / 2;
  const aimFromEast = Math.abs(Math.atan2(Math.sin(weaponAim), Math.cos(weaponAim)));
  if (entry.state === "fire") {
    expect(aimFromEast).toBeLessThan(Math.PI / 4);
  } else {
    const separationFromWest = Math.abs(Math.atan2(Math.sin(weaponAim - Math.PI), Math.cos(weaponAim - Math.PI)));
    expect(separationFromWest).toBeGreaterThanOrEqual(Math.PI / 2);
  }
};

const routeManifest = async (
  page: Page,
  mutate: (manifest: Record<string, unknown>) => void
): Promise<void> => {
  await page.route("**/assets/runtime/actors/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json() as Record<string, unknown>;
    mutate(manifest);
    await route.fulfill({ response, json: manifest });
  });
};

const expectTotalLegacyFallback = async (page: Page): Promise<void> => {
  const presentation = await readPresentation(page);
  expect(presentation).toMatchObject({
    skinId: "legacy-vehicle",
    atlasActive: false,
    playerTextureKey: "ground-body-blue",
    dummyTextureKey: "ground-body-red",
    playerAnimationKey: null,
    dummyAnimationKey: null,
    playerWeaponVisible: true,
    dummyWeaponVisible: true
  });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "legacy-vehicle");
  await expect(page.locator("#actor-skin-label")).toHaveText("Ground Shaker vehicle");
};

test("exercises all 80 Phaser team/state/direction clips with exact frame and playback contracts", async ({ page }) => {
  const errors = await openGame(page, "/");
  const results = await page.evaluate(({ teams, directions, stateContract }) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene test handle.");
    const probe = scene.add.sprite(-4_096, -4_096, "actor-animated-blue");
    const observed: Array<{
      key: string;
      frames: Array<string | number>;
      frameRate: number;
      repeat: number;
      advanced: boolean;
      completed: boolean;
      playingAfterCycle: boolean;
    }> = [];
    let time = 0;

    for (const team of teams) {
      for (const [state, contract] of Object.entries(stateContract)) {
        for (const direction of directions) {
          const key = `quaternius-animated:${team.toLowerCase()}:${state}:${direction}`;
          const animation = scene.anims.get(key);
          if (animation === undefined) throw new Error(`Missing runtime animation ${key}.`);
          let completed = false;
          const onComplete = (): void => { completed = true; };
          probe.once("animationcomplete", onComplete);
          probe.play(key);
          const firstFrame = probe.frame.name;
          const seenFrames = new Set<string | number>([firstFrame]);
          const stepMs = 1_000 / contract.frameRate + 1;
          for (let index = 0; index < contract.frames + 2; index += 1) {
            time += stepMs;
            probe.anims.update(time, stepMs);
            seenFrames.add(probe.frame.name);
          }
          probe.off("animationcomplete", onComplete);
          observed.push({
            key,
            frames: animation.frames.map((frame) => frame.frame.name),
            frameRate: animation.frameRate,
            repeat: animation.repeat,
            advanced: seenFrames.size > 1,
            completed,
            playingAfterCycle: probe.anims.isPlaying
          });
        }
      }
    }
    probe.destroy();
    return observed;
  }, { teams: TEAMS, directions: DIRECTIONS, stateContract: STATE_CONTRACT });

  expect(results).toHaveLength(80);
  for (const team of TEAMS) {
    for (const [state, contract] of Object.entries(STATE_CONTRACT) as Array<[AnimationState, typeof STATE_CONTRACT[AnimationState]]>) {
      for (const direction of DIRECTIONS) {
        const key = `quaternius-animated:${team.toLowerCase()}:${state}:${direction}`;
        const result = results.find((candidate) => candidate.key === key);
        expect(result, key).toBeDefined();
        expect(result?.frameRate, key).toBe(contract.frameRate);
        expect(result?.repeat, key).toBe(contract.repeat);
        expect(result?.advanced, key).toBe(true);
        expect(result?.completed, key).toBe(contract.repeat === 0);
        expect(result?.playingAfterCycle, key).toBe(contract.repeat === -1);
        expect(result?.frames, key).toEqual(Array.from({ length: contract.frames }, (_, index) =>
          `actor/${team.toLowerCase()}/${state}/${direction}/${String(index).padStart(2, "0")}`));
      }
    }
  }
  await expectCleanRuntime(page, errors);
});

const FALLBACK_CASES: Array<{
  name: string;
  path?: string;
  configure?: (page: Page) => Promise<void>;
}> = [
  { name: "unknown-query", path: "/?actorSkin=unknown" },
  { name: "missing-manifest-fields", configure: (page) => routeManifest(page, (manifest) => { delete manifest.atlases; }) },
  { name: "malformed-manifest", configure: (page) => routeManifest(page, (manifest) => {
    for (const key of Object.keys(manifest)) delete manifest[key];
    manifest.schemaVersion = "invalid";
  }) },
  { name: "missing-team", configure: (page) => routeManifest(page, (manifest) => {
    (manifest.atlases as unknown[]).pop();
  }) },
  { name: "missing-frame", configure: (page) => routeManifest(page, (manifest) => {
    (manifest.frames as unknown[]).pop();
  }) },
  { name: "over-budget", configure: (page) => routeManifest(page, (manifest) => {
    const budgets = manifest.budgets as Record<string, number>;
    budgets.transferBytes = budgets.transferLimitBytes + 1;
  }) },
  { name: "invalid-texture-dimensions", configure: async (page) => {
    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/gL+qZtYAAAAAElFTkSuQmCC", "base64");
    await page.route("**/assets/runtime/actors/actor-red.webp", (route) => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: onePixelPng
    }));
  } }
];

for (const fault of FALLBACK_CASES) {
  test(`falls back atomically for ${fault.name} without failed actor requests`, async ({ page }) => {
    if (fault.configure !== undefined) await fault.configure(page);
    const errors = await openGame(page, fault.path ?? "/");
    await expectTotalLegacyFallback(page);
    const presentation = await readPresentation(page);
    if (fault.name !== "unknown-query") expect(presentation.fallbackReason, fault.name).not.toBeNull();
    await expectCleanRuntime(page, errors);
  });
}

test("records uncached transfer bytes and exact GPU texture metadata within budget", async ({ page }) => {
  await page.route("**/assets/runtime/actors/**", (route) => route.continue({
    headers: { ...route.request().headers(), "cache-control": "no-cache" }
  }));
  const errors = await openGame(page, "/");
  const evidence = await page.evaluate(async () => {
    const paths = [
      "/assets/runtime/actors/actor-blue.webp",
      "/assets/runtime/actors/actor-blue.json",
      "/assets/runtime/actors/actor-red.webp",
      "/assets/runtime/actors/actor-red.json",
      "/assets/runtime/actors/manifest.json"
    ];
    const payloads = await Promise.all(paths.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
      return { path, bytes: (await response.arrayBuffer()).byteLength };
    }));
    const manifestResponse = await fetch("/assets/runtime/actors/manifest.json", { cache: "reload" });
    const blueResponse = await fetch("/assets/runtime/actors/actor-blue.json", { cache: "reload" });
    const redResponse = await fetch("/assets/runtime/actors/actor-red.json", { cache: "reload" });
    const manifest = await manifestResponse.json() as {
      budgets: { transferBytes: number; transferLimitBytes: number; gpuRgbaBytes: number; gpuRgbaLimitBytes: number; mipmaps: boolean };
    };
    const atlases = await Promise.all([
      ["BLUE", "actor-animated-blue", blueResponse] as const,
      ["RED", "actor-animated-red", redResponse] as const
    ].map(async ([team, textureKey, response]) => {
      const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
      if (scene === undefined || !scene.textures.exists(textureKey)) throw new Error(`Missing ${team} texture.`);
      const source = scene.textures.get(textureKey).getSourceImage();
      const atlas = await response.json() as { meta?: { mipmaps?: boolean } };
      return { team, textureKey, width: source?.width ?? 0, height: source?.height ?? 0, mipmaps: atlas.meta?.mipmaps };
    }));
    return { payloads, manifest, atlases };
  });

  const atlasPayloadBytes = evidence.payloads
    .filter((payload) => !payload.path.endsWith("manifest.json"))
    .reduce((sum, payload) => sum + payload.bytes, 0);
  const strictPayloadBytes = evidence.payloads.reduce((sum, payload) => sum + payload.bytes, 0);
  expect(atlasPayloadBytes).toBe(evidence.manifest.budgets.transferBytes);
  expect(strictPayloadBytes).toBeLessThanOrEqual(evidence.manifest.budgets.transferLimitBytes);
  expect(evidence.atlases).toEqual([
    { team: "BLUE", textureKey: "actor-animated-blue", width: 2048, height: 2048, mipmaps: false },
    { team: "RED", textureKey: "actor-animated-red", width: 2048, height: 2048, mipmaps: false }
  ]);
  expect(evidence.manifest.budgets).toMatchObject({
    transferLimitBytes: 8 * 1024 * 1024,
    gpuRgbaBytes: 33_554_432,
    gpuRgbaLimitBytes: 33_554_432,
    mipmaps: false
  });
  const budgetBody = await persistJsonArtifact(
    "phase11-t4-web-gpu-budget.json",
    { ...evidence, atlasPayloadBytes, strictPayloadBytes }
  );
  await test.info().attach("phase11-t4-web-gpu-budget.json", {
    body: budgetBody,
    contentType: "application/json"
  });
  await expectCleanRuntime(page, errors);
});

for (const weather of WEATHER_TYPES) {
  test(`captures five fixed BLUE-player animation states in ${weather}`, async ({ page }) => {
    const errors = await openGame(page, "/");
    await enterCombat(page, "BLUE");
    await page.evaluate((type: WeatherType) => {
      const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
      if (scene === undefined) throw new Error("Missing MainScene test handle.");
      scene.debugSetWeather(type);
    }, weather);
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", weather);

    const index: CaptureIndexEntry[] = [];
    for (const state of Object.keys(STATE_CONTRACT) as AnimationState[]) {
      await applyReadabilityState(page, state);
      const entry = await captureCompositedCanvas(page, `phase11-t4-blue-${weather}-${state}.png`, "BLUE", weather, state);
      assertCapture(entry);
      index.push(entry);
      if (state === "run") await page.keyboard.up("ArrowLeft");
    }
    expect(index).toHaveLength(5);
    expect(await page.evaluate(() => {
      const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
      return scene?.weatherRenderer.getDebugState().type;
    })).toBe(weather);
    const indexBody = await persistJsonArtifact(`phase11-t4-blue-${weather}-index.json`, index);
    await test.info().attach(`phase11-t4-blue-${weather}-index.json`, {
      body: indexBody,
      contentType: "application/json"
    });
    await expectCleanRuntime(page, errors);
  });
}

test("captures the RED-player team swap in all five weather states", async ({ page, browser, browserName }) => {
  const errors = await openGame(page, "/");
  await enterCombat(page, "RED");
  await applyReadabilityState(page, "idle");
  const index: CaptureIndexEntry[] = [];
  for (const weather of WEATHER_TYPES) {
    await page.evaluate((type: WeatherType) => {
      const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as AnimatedActorScene | undefined;
      if (scene === undefined) throw new Error("Missing MainScene test handle.");
      scene.debugSetWeather(type);
      scene.debugRefreshActorPresentation();
    }, weather);
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", weather);
    const entry = await captureCompositedCanvas(page, `phase11-t4-red-${weather}-idle.png`, "RED", weather, "idle");
    assertCapture(entry);
    expect(entry.presentation).toMatchObject({
      playerTextureKey: "actor-animated-red",
      dummyTextureKey: "actor-animated-blue"
    });
    index.push(entry);
  }
  expect(index).toHaveLength(5);
  const indexBody = await persistJsonArtifact("phase11-t4-red-team-swap-index.json", index);
  await test.info().attach("phase11-t4-red-team-swap-index.json", {
    body: indexBody,
    contentType: "application/json"
  });
  expect(captureIndex).toHaveLength(30);
  expect(new Set(captureIndex.map((entry) => entry.file)).size).toBe(30);
  expect(new Set(captureIndex.map((entry) => entry.sha256)).size).toBe(30);
  const consolidatedBody = await persistJsonArtifact("phase11-t4-readability-index.json", {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceWorkspaceFingerprint: SOURCE_WORKSPACE_FINGERPRINT,
    commit: SOURCE_COMMIT,
    environment: {
      platform: process.platform,
      release: os.release(),
      architecture: process.arch,
      node: process.version,
      browserName,
      browserVersion: browser.version(),
      playwrightProject: test.info().project.name,
      browserViewport: { width: 1_600, height: 1_000, deviceScaleFactor: 1 },
      capturedCanvas: { width: 960, height: 540 }
    },
    captures: captureIndex
  });
  await test.info().attach("phase11-t4-readability-index.json", {
    body: consolidatedBody,
    contentType: "application/json"
  });
  await expectCleanRuntime(page, errors);
});
