import { expect, test, type Page } from "@playwright/test";

interface TacticalSnapshot {
  intent: "pressure" | "hold" | "retreat" | "flank";
  targetCoverIndex: number | null;
  targetCoverEffect: "vision-jam" | "shield" | "repair" | null;
  chosenWeaponId: string;
  chosenWeaponRole: string | null;
}

interface DebugSnapshot {
  playerX: number;
  playerY: number;
  dummyX: number;
  dummyY: number;
  tactical: TacticalSnapshot;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  getHudSnapshot(): { tactical?: TacticalSnapshot; phase: string };
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugMovePlayerTo(x: number, y: number): void;
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
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { getDebugSnapshot?: () => unknown } | undefined;
    return typeof scene?.getDebugSnapshot === "function";
  });
};

const enterCombat = async (page: Page): Promise<void> => {
  await page.goto(process.env.PLAYTEST_BASE_URL ?? "/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => (await withScene(page, (scene: DebugScene) => scene.getHudSnapshot())).phase).toBe("COMBAT LIVE");
};

test("exposes tactical intent and role-aware weapon choice through debug and HUD snapshots", async ({ page }) => {
  await enterCombat(page);

  const baseline = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot());
  expect(baseline.tactical.chosenWeaponId.length).toBeGreaterThan(0);
  expect(baseline.tactical.chosenWeaponRole).not.toBeNull();

  await page.evaluate(([x, y]) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as DebugScene;
    scene.debugMovePlayerTo(x, y);
  }, [baseline.dummyX - 420, baseline.dummyY]);
  await expect.poll(async () => (await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot())).tactical.intent).toBe("pressure");
  await expect.poll(async () => (await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot())).tactical.chosenWeaponId).toBe("carbine");

  await page.evaluate(([x, y]) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as DebugScene;
    scene.debugMovePlayerTo(x, y);
  }, [baseline.dummyX - 24, baseline.dummyY]);
  await expect.poll(async () => (await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot())).tactical.intent).toBe("retreat");

  const closeRange = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot());
  expect(["carbine", "scatter"]).toContain(closeRange.tactical.chosenWeaponId);

  const hudSnapshot = await withScene(page, (scene: DebugScene) => scene.getHudSnapshot());
  expect(hudSnapshot.tactical).toBeDefined();
  expect(hudSnapshot.tactical?.chosenWeaponId).toBe(closeRange.tactical.chosenWeaponId);
});
