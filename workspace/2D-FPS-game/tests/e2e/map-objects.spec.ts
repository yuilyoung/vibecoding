import { expect, test, type Page } from "@playwright/test";

interface MapObjectsSummary {
  total: number;
  active: number;
  destroyed: number;
  drops: number;
  typeBreakdown: {
    barrel: number;
    mine: number;
    crate: number;
  };
}

interface DebugSnapshot {
  phase: string;
  weaponSlot: number;
  activeWeapon: string;
  lastEvent: string;
  mapObjects: MapObjectsSummary;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSelectWeaponSlot(slotNumber: number): void;
  debugFireAt(targetX: number, targetY: number): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  update(time: number, delta: number): void;
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
  return withScene(page, (scene: DebugScene) => scene.getDebugSnapshot());
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
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: DebugScene) => {
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
    scene.debugMoveDummyTo(820, 460);
  });

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
};

const advanceFrames = async (page: Page, frames: number, deltaMs: number): Promise<void> => {
  for (let index = 0; index < frames; index += 1) {
    await page.evaluate((delta: number) => {
      const game = window.__FPS_GAME__;

      if (game === undefined) {
        throw new Error("Missing __FPS_GAME__ test handle.");
      }

      const scene = game.scene.keys.MainScene as unknown as DebugScene;
      scene.update(0, delta);
    }, deltaMs);
  }
};

test("bazooka fire destroys a barrel map object", async ({ page }) => {
  await enterCombat(page);

  const before = await readSnapshot(page);
  expect(before.mapObjects.typeBreakdown.barrel).toBeGreaterThanOrEqual(2);

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(3);
    scene.debugMovePlayerTo(360, 222);
    scene.debugFireAt(430, 222);
  });
  await advanceFrames(page, 18, 60);

  const after = await readSnapshot(page);
  expect(after.weaponSlot).toBe(3);
  expect(after.activeWeapon).toBe("Bazooka");
  expect(after.mapObjects.destroyed).toBeGreaterThan(before.mapObjects.destroyed);
});

test("barrel chain destroys adjacent barrels", async ({ page }) => {
  await enterCombat(page);

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(3);
    scene.debugMovePlayerTo(360, 222);
    scene.debugFireAt(430, 222);
  });
  await advanceFrames(page, 24, 80);
  await page.waitForTimeout(350);

  const after = await readSnapshot(page);
  expect(after.mapObjects.destroyed).toBeGreaterThanOrEqual(2);
});

test("crate destruction emits a pickup drop event", async ({ page }) => {
  await enterCombat(page);

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(6);
    scene.debugMovePlayerTo(520, 430);
    scene.debugFireAt(612, 430);
  });
  await advanceFrames(page, 4, 100);

  const after = await readSnapshot(page);
  expect(after.weaponSlot).toBe(6);
  expect(after.activeWeapon).toBe("Air Strike");
  expect(after.mapObjects.destroyed).toBeGreaterThanOrEqual(1);
  expect(after.mapObjects.drops).toBeGreaterThanOrEqual(1);
});
