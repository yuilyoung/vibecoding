import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

interface DebugScene {
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
  debugGetWeatherSoundQueue(): readonly unknown[];
  debugClearWeatherSoundQueue(): void;
  getDebugSnapshot(): { audio: { activeWeatherLoopCue: string | null; lastDroppedCue: string | null } };
}

const withScene = async <T>(page: Page, action: (scene: DebugScene & Record<string, unknown>) => T): Promise<T> => {
  return page.evaluate((fnSource: string) => {
    const game = window.__FPS_GAME__;
    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }
    const scene = game.scene.keys.MainScene as unknown as DebugScene & Record<string, unknown>;
    const fn = eval(fnSource) as (target: DebugScene & Record<string, unknown>) => T;
    return fn(scene);
  }, `(${action.toString()})`);
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { debugSetWeather?: () => unknown } | undefined;
    return typeof scene?.debugSetWeather === "function";
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);

  await withScene(page, (scene) => scene.debugEnterStage());
  await withScene(page, (scene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
    scene.debugSetWeather("clear");
    scene.debugClearWeatherSoundQueue();
  });
};

test("keeps generated weather ambience disabled across weather and match reset transitions", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    scene.debugSetWeather("rain");
    scene.debugSetWeather("rain");
    (scene as unknown as DebugScene & { matchFlowController: { publishWeatherReset(): void } }).matchFlowController.publishWeatherReset();
    scene.debugSetWeather("storm");
    return { queue: scene.debugGetWeatherSoundQueue(), audio: scene.getDebugSnapshot().audio };
  });

  expect(result.queue).toEqual([]);

  expect(result.audio).toMatchObject({
    activeWeatherLoopCue: null,
    lastDroppedCue: null
  });
});

test("keeps every configured weather transition free of generated loop playback", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    scene.debugSetWeather("clear");
    scene.debugSetWeather("rain");
    scene.debugSetWeather("fog");
    scene.debugSetWeather("sandstorm");
    scene.debugSetWeather("storm");
    (scene as unknown as DebugScene & { matchFlowController: { publishWeatherReset(): void } }).matchFlowController.publishWeatherReset();
    scene.debugSetWeather("clear");
    return { queue: scene.debugGetWeatherSoundQueue(), audio: scene.getDebugSnapshot().audio };
  });

  expect(result.queue).toEqual([]);
  expect(result.audio).toMatchObject({
    activeWeatherLoopCue: null,
    lastDroppedCue: null
  });
});
