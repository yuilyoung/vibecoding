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

test("weather sound queue dedups identical weather and resets on MATCH_RESET", async ({ page }) => {
  await enterCombat(page);

  const queue = await withScene(page, (scene) => {
    scene.debugSetWeather("rain");
    scene.debugSetWeather("rain");
    (scene as unknown as DebugScene & { matchFlowController: { publishWeatherReset(): void } }).matchFlowController.publishWeatherReset();
    scene.debugSetWeather("storm");
    return scene.debugGetWeatherSoundQueue();
  });

  expect(queue).toEqual([
    {
      action: "play",
      weatherType: "rain",
      cue: "weather.rain.loop",
      volume: 0.6,
      fadeMs: 800,
      priority: 18
    },
    {
      action: "stop",
      cue: "weather.rain.loop",
      fadeMs: 800,
      priority: 18,
      reason: "MATCH_RESET"
    },
    {
      action: "play",
      weatherType: "storm",
      cue: "weather.storm.loop",
      volume: 0.65,
      fadeMs: 800,
      priority: 18
    }
  ]);
});
