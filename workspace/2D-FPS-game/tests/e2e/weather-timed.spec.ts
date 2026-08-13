import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

interface DebugSnapshot {
  phase: string;
  weather: {
    global: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
    effective: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
  };
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  update(time: number, delta: number): void;
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
    const scene = game?.scene.keys.MainScene as { getDebugSnapshot?: () => unknown } | undefined;
    return typeof scene?.getDebugSnapshot === "function";
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
  });

  await expect.poll(async () => withScene(page, (scene) => scene.getDebugSnapshot().phase)).toBe("COMBAT LIVE");
};

test("timed weather rotates global weather mid-round while keeping effective in sync without zones", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    const target = scene as unknown as DebugScene & {
      time: { now: number };
      currentGlobalWeather: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
      currentEffectiveWeather: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
      gameBalance: { weather: { rotationMode: string; durationRangeMs: [number, number] } };
      matchFlowController: {
        weatherTimer: {
          weather: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
          durationMs: number;
          startedAtMs: number;
          nextChangeAtMs: number;
        };
      };
    };

    target.gameBalance.weather.rotationMode = "timed";
    target.gameBalance.weather.durationRangeMs = [100, 100];
    target.time.now = 0;
    target.matchFlowController.weatherTimer = {
      weather: target.currentGlobalWeather,
      durationMs: 100,
      startedAtMs: 0,
      nextChangeAtMs: 100
    };

    const before = target.getDebugSnapshot().weather;
    target.time.now = 150;
    target.update(150, 16);
    const after = target.getDebugSnapshot().weather;

    return { before, after };
  });

  expect(result.before.global.type).toBe(result.before.effective.type);
  expect(result.after.global.type).not.toBe(result.before.global.type);
  expect(result.after.effective.type).toBe(result.after.global.type);
});
