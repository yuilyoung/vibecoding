import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
// @ts-expect-error The repository harness helper is an untyped ESM module.
import { workspaceFingerprint } from "../../../../plugins/hermes-ssot/scripts/harness-controller.mjs";

type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

interface EvidenceScene {
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugRotateStage(): void;
  debugSetWeather(type: WeatherType): void;
  debugGetMapObjectStates(): Array<{ id: string; kind: string; x: number; y: number }>;
  debugGetWorldObjectPresentation(): {
    requestedSkinId: string;
    skinId: string;
    fallbackReason: string | null;
    atlasActive: boolean;
    overlayCount: number;
    objects: Array<{ id: string; family: string; state: string; frameKey: string; visible: boolean }>;
  };
  getDebugSnapshot(): { stage: string; weather: { effective: { type: WeatherType } } };
}

const projectRoot = path.resolve(".");
const workspaceRoot = path.resolve(projectRoot, "../..");
const reportsRoot = path.resolve(projectRoot, "docs/reports");
const t3ArtifactDir = path.resolve(reportsRoot, "phase12-t3-evidence");
const artifactDir = path.resolve(projectRoot, process.env.PHASE12_ARTIFACT_DIR ?? "docs/reports/phase12-t2-evidence");
const artifactPrefix = process.env.PHASE12_ARTIFACT_PREFIX ?? "phase12-t2";
const stages = ["foundry", "relay-yard", "storm-drain"] as const;
const weatherTypes: readonly WeatherType[] = ["clear", "rain", "fog", "sandstorm", "storm"];

test.skip(process.env.PHASE12_CAPTURE_EVIDENCE !== "1", "Run explicitly to refresh current Phase 12 visual evidence.");
test.setTimeout(120_000);
test.use({ viewport: { width: 1_600, height: 1_200 }, deviceScaleFactor: 1 });

const withScene = <T>(page: Page, action: (scene: EvidenceScene) => T): Promise<T> => page.evaluate(
  (fnSource: string) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as EvidenceScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene evidence handle.");
    return (eval(fnSource) as (target: EvidenceScene) => T)(scene);
  },
  `(${action.toString()})`
);

const rotateToStage = async (page: Page, stageId: string): Promise<void> => {
  for (let index = 0; index < 4; index += 1) {
    if (await withScene(page, (scene: EvidenceScene) => scene.getDebugSnapshot().stage) === stageId) return;
    await withScene(page, (scene: EvidenceScene) => scene.debugRotateStage());
  }
  throw new Error(`Failed to rotate to ${stageId}.`);
};

const inspectPixels = async (png: Buffer) => {
  const decoded = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let minimum = 255;
  let maximum = 0;
  let sum = 0;
  let squareSum = 0;
  for (let index = 0; index < decoded.data.length; index += decoded.info.channels) {
    const luminance = decoded.data[index] * 0.2126 + decoded.data[index + 1] * 0.7152 + decoded.data[index + 2] * 0.0722;
    minimum = Math.min(minimum, luminance);
    maximum = Math.max(maximum, luminance);
    sum += luminance;
    squareSum += luminance * luminance;
  }
  const pixelCount = decoded.info.width * decoded.info.height;
  const mean = sum / pixelCount;
  return {
    width: decoded.info.width,
    height: decoded.info.height,
    luminanceMin: Number(minimum.toFixed(3)),
    luminanceMax: Number(maximum.toFixed(3)),
    luminanceMean: Number(mean.toFixed(3)),
    luminanceStdDev: Number(Math.sqrt(Math.max(0, squareSum / pixelCount - mean * mean)).toFixed(3))
  };
};

test("captures product-v1 across three stages and five weather states", async ({ page, browser }) => {
  expect(process.env.PHASE12_ARTIFACT_DIR, "Explicit evidence refreshes require a new artifact directory.").toBeTruthy();
  expect(process.env.PHASE12_ARTIFACT_PREFIX, "Explicit evidence refreshes require a new artifact prefix.").toBeTruthy();
  expect(artifactDir).toBe(t3ArtifactDir);
  expect(artifactPrefix).toBe("phase12-t3");
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/?worldSkin=product-v1");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as EvidenceScene | undefined;
    try { return scene?.debugGetWorldObjectPresentation().atlasActive === true; } catch { return false; }
  });
  await withScene(page, (scene: EvidenceScene) => {
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });
  const canvas = page.locator("canvas");
  await canvas.evaluate((element) => {
    element.style.setProperty("width", "960px", "important");
    element.style.setProperty("height", "540px", "important");
    element.style.setProperty("max-width", "none", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("box-sizing", "border-box", "important");
    element.style.setProperty("border", "0", "important");
    element.style.setProperty("transform", "none", "important");
  });
  await mkdir(artifactDir, { recursive: true });

  const captures: unknown[] = [];
  const coveredFamilies = new Set<string>();
  for (const stage of stages) {
    await rotateToStage(page, stage);
    for (const weather of weatherTypes) {
      await page.evaluate((type: WeatherType) => {
        const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as EvidenceScene | undefined;
        if (scene === undefined) throw new Error("Missing MainScene evidence handle.");
        scene.debugSetWeather(type);
      }, weather);
      await page.waitForFunction((type: WeatherType) => {
        const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as EvidenceScene | undefined;
        return scene?.getDebugSnapshot().weather.effective.type === type;
      }, weather);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await page.evaluate(() => window.__FPS_GAME__?.loop.sleep());
      const presentation = await withScene(page, (scene: EvidenceScene) => scene.debugGetWorldObjectPresentation());
      const objects = await withScene(page, (scene: EvidenceScene) => scene.debugGetMapObjectStates());
      expect(presentation).toMatchObject({ skinId: "product-v1", atlasActive: true, fallbackReason: null });
      expect(presentation.overlayCount).toBe(objects.length + 7);
      expect(presentation.objects.every((object) => object.visible)).toBe(true);
      for (const object of presentation.objects) coveredFamilies.add(object.family);
      const file = `${artifactPrefix}-${stage}-${weather}.png`;
      const bounds = await canvas.boundingBox();
      if (bounds === null) throw new Error("Missing Phase 12 canvas bounds.");
      const png = await page.screenshot({
        type: "png",
        animations: "disabled",
        clip: { x: Math.round(bounds.x), y: Math.round(bounds.y), width: 960, height: 540 }
      });
      const pixels = await inspectPixels(png);
      expect(pixels).toMatchObject({ width: 960, height: 540 });
      expect(pixels.luminanceMax - pixels.luminanceMin).toBeGreaterThan(32);
      expect(pixels.luminanceStdDev).toBeGreaterThan(5);
      await writeFile(path.join(artifactDir, file), png);
      captures.push({
        file,
        stage,
        weather,
        bytes: png.byteLength,
        sha256: createHash("sha256").update(png).digest("hex"),
        pixels,
        domainObjectCount: objects.length,
        presentation
      });
      await page.evaluate(() => window.__FPS_GAME__?.loop.wake());
    }
  }

  expect(captures).toHaveLength(15);
  expect(coveredFamilies).toEqual(new Set([
    "barrel", "mine", "crate", "cover", "bounce-wall", "teleporter",
    "arena-obstacle", "service-gate", "vent-hazard", "ammo-pickup", "health-pickup"
  ]));
  expect(errors).toEqual([]);
  const index = {
    schemaVersion: "1.1.0",
    capturedAt: new Date().toISOString(),
    workspaceFingerprint: workspaceFingerprint(workspaceRoot),
    route: "/?worldSkin=product-v1",
    targetFrame: "../phase12-t0-evidence/phase12-foundry-target-frame-v5.png",
    browser: browser.version(),
    viewport: { width: 1_600, height: 1_200, deviceScaleFactor: 1 },
    canvas: { width: 960, height: 540 },
    coveredStages: stages,
    coveredWeather: weatherTypes,
    coveredFamilies: [...coveredFamilies],
    errors,
    captures
  };
  await writeFile(path.join(artifactDir, `${artifactPrefix}-visual-index.json`), `${JSON.stringify(index, null, 2)}\n`, "utf8");
});
