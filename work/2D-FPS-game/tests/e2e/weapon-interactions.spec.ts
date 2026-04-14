import { expect, test, type Page } from "@playwright/test";
import type { HudSnapshot } from "../../src/ui/hud-events";

interface DebugSnapshot {
  phase: string;
  activeWeapon: string;
  weaponSlot: number;
  ammoInMagazine: number;
  dummyHealth: number;
  lastEvent: string;
}

interface RuntimeStats {
  bullets: number;
  activeAirStrikes: number;
  impactEffects: number;
  shotTrails: number;
  movementEffects: number;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  getHudSnapshot(): HudSnapshot;
  debugGetRuntimeStats(): RuntimeStats;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSelectWeaponSlot(slotNumber: number): void;
  debugFire(): void;
  debugFireAt(targetX: number, targetY: number): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugSetPlayerAimAngle(angleRadians: number): void;
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

const readHudSnapshot = async (page: Page): Promise<HudSnapshot> => {
  return withScene(page, (scene: DebugScene) => scene.getHudSnapshot());
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

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
};

test("renders all six HUD weapon slots and highlights the active slot", async ({ page }) => {
  await enterCombat(page);

  const slots = page.locator(".weapon-slot-tile");
  await expect(slots).toHaveCount(6);
  await expect(slots.nth(0)).toHaveAttribute("aria-current", "true");

  await withScene(page, (scene: DebugScene) => scene.debugSelectWeaponSlot(5));
  await expect.poll(async () => (await readHudSnapshot(page)).weaponSlot).toBe(5);

  await expect(slots.nth(4)).toHaveAttribute("aria-current", "true");
  await expect(slots.nth(4)).toContainText("Sniper");
  await expect(slots.nth(0)).toHaveAttribute("aria-current", "false");
});

test("grenade shot launches a bouncing explosive projectile", async ({ page }) => {
  await enterCombat(page);
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(4);
    scene.debugMovePlayerTo(120, 40);
  });

  await withScene(page, (scene: DebugScene) => scene.debugFireAt(440, 220));
  const stats = await withScene(page, (scene: DebugScene) => scene.debugGetRuntimeStats());

  const after = await readSnapshot(page);
  expect(after.weaponSlot).toBe(4);
  expect(after.activeWeapon).toBe("Grenade");
  expect(stats.bullets).toBeGreaterThan(0);
});

test("sniper beam hits the dummy immediately on a clear lane", async ({ page }) => {
  await enterCombat(page);
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(5);
    scene.debugMovePlayerTo(120, 40);
    scene.debugMoveDummyTo(500, 40);
  });

  const before = await readSnapshot(page);
  await withScene(page, (scene: DebugScene) => scene.debugFireAt(500, 40));

  const after = await readSnapshot(page);
  expect(after.weaponSlot).toBe(5);
  expect(after.activeWeapon).toBe("Sniper");
  expect(after.dummyHealth).toBeLessThan(before.dummyHealth);
});

test("air strike queues blasts and applies area damage", async ({ page }) => {
  await enterCombat(page);
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(6);
    scene.debugMovePlayerTo(120, 120);
    scene.debugMoveDummyTo(500, 240);
  });

  const before = await readSnapshot(page);
  await withScene(page, (scene: DebugScene) => scene.debugFireAt(500, 240));

  let stats = await withScene(page, (scene: DebugScene) => scene.debugGetRuntimeStats());
  expect(stats.activeAirStrikes).toBe(1);

  for (let frame = 0; frame < 12; frame += 1) {
    await withScene(page, (scene: DebugScene) => scene.update(0, 100));
  }

  const after = await readSnapshot(page);
  stats = await withScene(page, (scene: DebugScene) => scene.debugGetRuntimeStats());
  expect(after.weaponSlot).toBe(6);
  expect(after.activeWeapon).toBe("Air Strike");
  expect(after.dummyHealth).toBeLessThan(before.dummyHealth);
  expect(stats.impactEffects).toBeGreaterThan(0);
});
