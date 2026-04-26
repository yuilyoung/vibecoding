import { expect, test, type Page } from "@playwright/test";

interface DebugSnapshot {
  phase: string;
  team: string;
  playerX: number;
  playerY: number;
  playerHullAngle: number;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugSetPlayerHullAngle(angleRadians: number): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
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

const readSnapshot = async (page: Page): Promise<DebugSnapshot> => {
  return page.evaluate(() => {
    const game = window.__FPS_GAME__;

    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }

    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    return scene.getDebugSnapshot();
  });
};

const waitForSceneReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getDebugSnapshot?: () => unknown } | undefined;
    return typeof scene?.getDebugSnapshot === "function";
  });
};

const stabilizeEnvironment = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as
      | {
          runtimeState?: { currentWind: { angleDegrees: number; strength: number } };
          debugSetWeather?: (type: "clear") => void;
        }
      | undefined;

    if (scene?.runtimeState === undefined || scene.debugSetWeather === undefined) {
      throw new Error("Missing environment debug handles.");
    }

    scene.runtimeState.currentWind = { angleDegrees: 0, strength: 0 };
    scene.debugSetWeather("clear");
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });
  await stabilizeEnvironment(page);

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
};

test("player can still move right near the top-left playfield corner", async ({ page }) => {
  await enterCombat(page);

  await withScene(page, (scene: DebugScene) => {
    scene.debugMovePlayerTo(68, 76);
    scene.debugSetPlayerHullAngle(0);
  });

  const before = await readSnapshot(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(220);
  await page.keyboard.up("d");
  const after = await readSnapshot(page);

  expect(after.playerX).toBeGreaterThan(before.playerX + 10);
  expect(Math.abs(after.playerY - before.playerY)).toBeLessThan(8);
});

test("player is not blocked too early when strafing toward the left cover obstacle", async ({ page }) => {
  await enterCombat(page);

  await withScene(page, (scene: DebugScene) => {
    scene.debugMovePlayerTo(150, 180);
    scene.debugSetPlayerHullAngle(0);
  });

  const before = await readSnapshot(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(220);
  await page.keyboard.up("d");
  const after = await readSnapshot(page);

  expect(after.playerX).toBeGreaterThan(before.playerX + 10);
});
