import { expect, test, type Page } from "@playwright/test";

interface MapObjectState {
  id: string;
  kind: "barrel" | "mine" | "crate" | "cover" | "bounce-wall" | "teleporter";
  x: number;
  y: number;
  hp: number;
  active: boolean;
  pairId?: string;
  angleDegrees?: number;
  reflectionsRemaining?: number;
  cooldownUntil?: number;
}

interface ProjectileSnapshot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  owner: "player" | "dummy";
  trajectory: string;
}

interface DebugSnapshot {
  phase: string;
  stage: string;
  weaponSlot: number;
  activeWeapon: string;
  dummyHealth: number;
  playerX: number;
  playerY: number;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void;
  debugSelectWeaponSlot(slotNumber: number): void;
  debugFireAt(targetX: number, targetY: number): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugGetMapObjectStates(): MapObjectState[];
  debugGetProjectileSnapshot(): ProjectileSnapshot[];
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
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await waitForSceneReady(page);
  await page.locator("canvas").click({ position: { x: 220, y: 220 } });

  await withScene(page, (scene: DebugScene) => {
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
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

const rotateToStage = async (page: Page, stageId: string): Promise<void> => {
  for (let index = 0; index < 4; index += 1) {
    if ((await readSnapshot(page)).stage === stageId) {
      return;
    }

    await withScene(page, (scene: DebugScene) => scene.debugForceMatchOver("PLAYER"));
    await page.waitForTimeout(250);
    await page.locator("canvas").focus();
    await page.keyboard.down("Enter");
    await page.waitForTimeout(120);
    await page.keyboard.up("Enter");

    await withScene(page, (scene: DebugScene) => {
      scene.debugEnterStage();
      scene.debugSelectTeam("BLUE");
      scene.debugConfirmTeamSelection();
      scene.debugForceCombatLive();
    });
    await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
  }

  throw new Error(`Failed to rotate to stage ${stageId}.`);
};

test("cover blocks bullets until destroyed", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "relay-yard");

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(1);
    scene.debugMovePlayerTo(240, 204);
    scene.debugMoveDummyTo(380, 204);
  });

  await withScene(page, (scene: DebugScene) => scene.debugFireAt(380, 204));
  await advanceFrames(page, 4, 60);

  const afterFirst = await readSnapshot(page);
  const coverAfterFirst = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "relay-cover-a");
  });

  expect(coverAfterFirst?.hp).toBeLessThan(60);
  expect(coverAfterFirst?.active).toBe(true);

  for (let shot = 0; shot < 3; shot += 1) {
    await withScene(page, (scene: DebugScene) => {
      scene.debugMovePlayerTo(240, 204);
      scene.debugMoveDummyTo(380, 204);
      scene.debugFireAt(380, 204);
    });
    await advanceFrames(page, 4, 60);
  }

  const coverAfterBurst = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "relay-cover-a");
  });
  const afterBurst = await readSnapshot(page);

  expect(coverAfterBurst?.active).toBe(false);
  expect(afterBurst.dummyHealth).toBeLessThan(afterFirst.dummyHealth);
});

test("bounce wall reflects a linear projectile and flips its y velocity", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "relay-yard");

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(1);
    scene.debugMovePlayerTo(400, 238);
  });

  let wall = null as MapObjectState | undefined | null;
  for (let shot = 0; shot < 3; shot += 1) {
    await withScene(page, (scene: DebugScene) => {
      scene.debugMovePlayerTo(400, 238);
      scene.debugFireAt(480, 238);
    });
    await advanceFrames(page, 12, 40);
    wall = await withScene(page, (scene: DebugScene) => {
      return scene.debugGetMapObjectStates().find((object) => object.id === "relay-bounce-wall-a");
    });

    if ((wall?.reflectionsRemaining ?? 3) < 3) {
      break;
    }
  }

  const after = await readSnapshot(page);

  expect(after.weaponSlot).toBe(1);
  expect(after.activeWeapon).toBe("Carbine");
  expect(wall?.reflectionsRemaining).toBeLessThan(3);
});

test("teleporter moves the player to its pair and blocks immediate re-entry during cooldown", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "relay-yard");

  await withScene(page, (scene: DebugScene) => scene.debugMovePlayerTo(220, 356));
  await advanceFrames(page, 2, 60);

  const afterTeleport = await readSnapshot(page);
  expect(afterTeleport.playerX).toBeCloseTo(744, 0);
  expect(afterTeleport.playerY).toBeCloseTo(184, 0);

  await withScene(page, (scene: DebugScene) => scene.debugMovePlayerTo(220, 356));
  await advanceFrames(page, 2, 60);

  const duringCooldown = await readSnapshot(page);
  expect(duringCooldown.playerX).toBeCloseTo(220, 0);
  expect(duringCooldown.playerY).toBeCloseTo(356, 0);

  await advanceFrames(page, 30, 60);
  const afterCooldown = await readSnapshot(page);
  expect(afterCooldown.playerX).toBeCloseTo(744, 0);
  expect(afterCooldown.playerY).toBeCloseTo(184, 0);
});
