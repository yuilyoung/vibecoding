import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

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
  debugSwapWeapon(): void;
  debugFire(): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugSetPlayerHullAngle(angleRadians: number): void;
  debugToggleGate(): void;
  debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void;
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

const enterCombat = async (page: Page, team: "BLUE" | "RED" = "BLUE"): Promise<DebugSnapshot> => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await waitForSceneReady(page);
  await canvas.click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, team === "BLUE"
    ? (scene: DebugScene) => {
        scene.debugSelectTeam("BLUE");
        scene.debugConfirmTeamSelection();
        scene.debugForceCombatLive();
      }
    : (scene: DebugScene) => {
        scene.debugSelectTeam("RED");
        scene.debugConfirmTeamSelection();
        scene.debugForceCombatLive();
      });

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
  return readSnapshot(page);
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

test("reports ammo full instead of overfilling reserve when the pickup is collected at cap", async ({ page }) => {
  let snapshot = await enterCombat(page, "BLUE");
  expect(snapshot.team).toBe("BLUE");
  expect(snapshot.phase).toBe("COMBAT LIVE");
  const reserveBeforePickup = snapshot.reserveAmmo;

  await withScene(page, (scene: DebugScene) => scene.debugMovePlayerTo(160, 430));
  await page.waitForTimeout(150);

  await expect.poll(async () => (await readSnapshot(page)).lastEvent).toBe("AMMO OVERDRIVE");

  snapshot = await readSnapshot(page);
  expect(snapshot.reserveAmmo).toBeGreaterThanOrEqual(reserveBeforePickup);
  expect(snapshot.activeWeapon).toBe("Carbine");
});

test("allows enter to restart after match over", async ({ page }) => {
  await enterCombat(page, "BLUE");
  await withScene(page, (scene: DebugScene) => scene.debugForceMatchOver("DUMMY"));

  await page.keyboard.down("Enter");
  await page.waitForTimeout(80);
  await page.keyboard.up("Enter");

  await expect.poll(async () => (await readSnapshot(page)).phase).toBe("TEAM SELECT");

  const snapshot = await readSnapshot(page);
  expect(snapshot.team).toBe("UNSET");
  expect(snapshot.playerScore).toBe(0);
  expect(snapshot.dummyScore).toBe(0);
  expect(snapshot.roundNumber).toBe(1);
  expect(snapshot.spawn).toBe("WAITING");
  expect(snapshot.lastEvent).toBe("SELECT TEAM FOR NEXT MATCH");
});
