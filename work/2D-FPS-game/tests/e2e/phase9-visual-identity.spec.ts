import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

interface DebugSnapshot {
  phase: string;
  stage: string;
}

interface StageVisualDebugState {
  stageId: string;
  crop: { x: number; y: number; width: number; height: number };
  terrainTint: number;
  overlayColor: number;
  borderColor: number;
}

interface WeatherVisualDebugState {
  type: WeatherType;
  particleCount: number;
  fogActive: boolean;
  atmosphereActive: boolean;
  atmosphereColor: number;
  flashActive: boolean;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: WeatherType): void;
  update(time: number, delta: number): void;
  stageVisualController: { getDebugState(): StageVisualDebugState };
  weatherRenderer: { getDebugState(): WeatherVisualDebugState };
  playerSprite: { texture: { key: string } };
  targetDummy: { texture: { key: string } };
  matchFlowController: { rotateStageForNextMatch(): void };
  hudController: { publishHudSnapshot(now: number, movementBlocked: boolean): void };
  time: { now: number };
}

const withScene = async <T>(page: Page, action: (scene: DebugScene) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;
    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    const fn = eval(fnSource) as (target: DebugScene) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as { getDebugSnapshot?: () => unknown } | undefined;
    return typeof scene?.getDebugSnapshot === "function";
  });
};

const openGame = async (page: Page): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);
  return errors;
};

const enterCombat = async (page: Page): Promise<void> => {
  await withScene(page, (scene) => {
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });
  await expect.poll(async () => withScene(page, (scene) => scene.getDebugSnapshot().phase)).toBe("COMBAT LIVE");
};

const rotateToStage = async (page: Page, stageId: string): Promise<void> => {
  for (let index = 0; index < 4; index += 1) {
    if (await withScene(page, (scene) => scene.getDebugSnapshot().stage) === stageId) {
      return;
    }

    await withScene(page, (scene) => {
      scene.matchFlowController.rotateStageForNextMatch();
      scene.hudController.publishHudSnapshot(scene.time.now, false);
    });
    await page.waitForTimeout(50);
  }

  throw new Error(`Failed to rotate to stage ${stageId}.`);
};

const setWeatherAndRead = async (page: Page, type: WeatherType): Promise<WeatherVisualDebugState> => {
  return page.evaluate((weatherType: WeatherType) => {
    const game = window.__FPS_GAME__;
    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }
    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    scene.debugSetWeather(weatherType);
    return scene.weatherRenderer.getDebugState();
  }, type);
};

test("loads CC0 operator portraits, six weapon icons, and the matching object legend", async ({ page }) => {
  const errors = await openGame(page);

  await expect(page.locator("#player-portrait")).toHaveAttribute("src", /player-blue\.png$/);
  await expect(page.locator("#enemy-portrait")).toHaveAttribute("src", /enemy-red\.png$/);
  await expect(page.locator("#player-operator-text")).toContainText("operator");

  const slots = page.locator(".weapon-slot-tile");
  await expect(slots).toHaveCount(6);
  const weaponIds = await slots.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.weaponId));
  expect(weaponIds).toEqual(["carbine", "scatter", "bazooka", "grenade", "sniper", "airStrike"]);

  const iconSources = await page.locator(".weapon-slot-icon").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  expect(new Set(iconSources).size).toBe(6);
  expect(await page.locator(".weapon-slot-icon").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);

  const legend = page.locator(".map-object-legend-item");
  await expect(legend).toHaveCount(6);
  expect(await legend.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.objectKind))).toEqual([
    "barrel",
    "mine",
    "crate",
    "cover",
    "bounce-wall",
    "teleporter"
  ]);
  expect(errors).toEqual([]);
});

test("keeps Ground Shaker tanks in-world and applies three distinct stage surfaces", async ({ page }) => {
  const errors = await openGame(page);
  await enterCombat(page);
  const themes: StageVisualDebugState[] = [];

  for (const stageId of ["foundry", "relay-yard", "storm-drain"]) {
    await rotateToStage(page, stageId);
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", stageId);
    themes.push(await withScene(page, (scene) => scene.stageVisualController.getDebugState()));
    await page.screenshot({ path: test.info().outputPath(`phase9-stage-${stageId}.png`), fullPage: false });
  }

  const actorTextures = await withScene(page, (scene) => ({
    player: scene.playerSprite.texture.key,
    enemy: scene.targetDummy.texture.key
  }));
  expect(actorTextures).toEqual({ player: "ground-body-blue", enemy: "ground-body-red" });
  expect(new Set(themes.map((theme) => JSON.stringify(theme.crop))).size).toBe(3);
  expect(new Set(themes.map((theme) => theme.borderColor)).size).toBe(3);
  expect(themes.map((theme) => theme.stageId)).toEqual(["foundry", "relay-yard", "storm-drain"]);
  expect(errors).toEqual([]);
});

test("exposes all five weather identities and clears every effect when weather returns to clear", async ({ page }) => {
  const errors = await openGame(page);
  await enterCombat(page);
  const observed = new Map<WeatherType, WeatherVisualDebugState>();

  for (const type of ["clear", "rain", "fog", "sandstorm", "storm"] as const) {
    const state = await setWeatherAndRead(page, type);
    observed.set(type, state);
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", type);
    await expect(page.locator("#weather-pill")).toHaveAttribute("data-weather", type);
    await page.screenshot({ path: test.info().outputPath(`phase9-weather-${type}.png`), fullPage: false });
  }

  expect(observed.get("rain")).toMatchObject({ particleCount: 50, atmosphereActive: true });
  expect(observed.get("fog")).toMatchObject({ fogActive: true, atmosphereActive: true });
  expect(observed.get("sandstorm")).toMatchObject({ particleCount: 30, atmosphereActive: true });
  expect(observed.get("storm")).toMatchObject({ flashActive: true, atmosphereActive: true });

  const clear = await withScene(page, (scene) => {
    scene.debugSetWeather("clear");
    return scene.weatherRenderer.getDebugState();
  });
  expect(clear).toMatchObject({ particleCount: 0, fogActive: false, atmosphereActive: false, flashActive: false });
  expect(errors).toEqual([]);
});
