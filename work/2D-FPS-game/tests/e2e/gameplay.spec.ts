import { expect, test, type Page } from "@playwright/test";

interface DebugSnapshot {
  phase: string;
  team: string;
  spawn: string;
  activeWeapon: string;
  weaponSlot: number;
  ammoInMagazine: number;
  reserveAmmo: number;
  playerHealth: number;
  dummyHealth: number;
  gateOpen: boolean;
  roundNumber: number;
  playerScore: number;
  dummyScore: number;
  lastEvent: string;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSwapWeapon(): void;
  debugFire(): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugToggleGate(): void;
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

test("supports stage entry, team selection, deployment, weapon swap, fire, and gate toggle", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 200, y: 200 } });

  let snapshot = await readSnapshot(page);
  expect(snapshot.phase).toBe("STAGE ENTRY");

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  snapshot = await readSnapshot(page);
  expect(snapshot.phase).toBe("TEAM SELECT");

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("RED");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  snapshot = await readSnapshot(page);
  expect(snapshot.team).toBe("RED");
  expect(snapshot.phase).toBe("COMBAT LIVE");
  expect(snapshot.spawn).toContain("vs");

  await withScene(page, (scene: DebugScene) => scene.debugSwapWeapon());
  snapshot = await readSnapshot(page);
  expect(snapshot.weaponSlot).toBe(2);
  expect(snapshot.activeWeapon).toBe("Scatter");

  const beforeAmmo = snapshot.ammoInMagazine;
  await page.mouse.move(740, 260);
  await withScene(page, (scene: DebugScene) => scene.debugFire());
  await page.waitForFunction((ammo) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as DebugScene | undefined;
    return scene !== undefined && scene.getDebugSnapshot().ammoInMagazine < ammo;
  }, beforeAmmo);

  snapshot = await readSnapshot(page);
  expect(snapshot.lastEvent).toMatch(/FIRED|MAG EMPTY/);

  await withScene(page, (scene: DebugScene) => {
    scene.debugMovePlayerTo(482, 430);
    scene.debugToggleGate();
  });

  snapshot = await readSnapshot(page);
  expect(snapshot.gateOpen).toBe(true);
});
