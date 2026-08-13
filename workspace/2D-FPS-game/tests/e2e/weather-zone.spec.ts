import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

interface DebugSnapshot {
  phase: string;
  weather: {
    global: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
    effective: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm" };
  };
}

interface HudSnapshot {
  weather?: { type: "clear" | "rain" | "fog" | "sandstorm" | "storm"; icon: string };
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  getHudSnapshot(): HudSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
  debugMovePlayerTo(x: number, y: number): void;
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

test("weather zones change only effective weather and keep global weather unchanged", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    const target = scene as unknown as DebugScene & {
      currentStage: {
        weatherZones?: Array<{
          weather: "clear" | "rain" | "fog" | "sandstorm" | "storm";
          shape: { kind: "circle"; cx: number; cy: number; radius: number };
          priority?: number;
        }>;
      };
    };

    scene.debugSetWeather("clear");
    target.currentStage.weatherZones = [{
      weather: "fog",
      priority: 5,
      shape: { kind: "circle", cx: 480, cy: 270, radius: 120 }
    }];

    scene.debugMovePlayerTo(480, 270);
    scene.update(0, 16);
    const inside = {
      weather: scene.getDebugSnapshot().weather,
      hud: scene.getHudSnapshot().weather
    };

    scene.debugMovePlayerTo(120, 120);
    scene.update(0, 16);
    const outside = {
      weather: scene.getDebugSnapshot().weather,
      hud: scene.getHudSnapshot().weather
    };

    return { inside, outside };
  });

  expect(result.inside.weather.global.type).toBe("clear");
  expect(result.inside.weather.effective.type).toBe("fog");
  expect(result.inside.hud).toMatchObject({ type: "fog", icon: "FOG" });
  expect(result.outside.weather.global.type).toBe("clear");
  expect(result.outside.weather.effective.type).toBe("clear");
  expect(result.outside.hud).toMatchObject({ type: "clear", icon: "CLR" });
});
