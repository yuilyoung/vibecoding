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
  dummyX: number;
  dummyY: number;
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
  debugAdvanceMapObjects(now: number): void;
  debugResolveProjectiles(): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
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
  await stabilizeEnvironment(page);

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

const injectProjectile = async (page: Page, input: {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  trajectory?: "linear" | "arc" | "bounce";
}): Promise<void> => {
  await page.evaluate(({ x, y, velocityX, velocityY, trajectory }) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as
      | (DebugScene & {
          add: { rectangle(x: number, y: number, width: number, height: number, color: number, alpha: number): unknown };
          runtimeState?: {
            bullets: Array<{
              sprite: { x: number; y: number; width: number; height: number };
              velocityX: number;
              velocityY: number;
              damage: number;
              critChance: number;
              critMultiplier: number;
              owner: "player" | "dummy";
              effectProfile: string;
              projectileConfig: Record<string, unknown>;
              bouncesRemaining?: number;
            }>;
          };
        })
      | undefined;

    if (scene?.runtimeState === undefined) {
      throw new Error("Missing runtimeState test handle.");
    }

    const sprite = scene.add.rectangle(x, y, 8, 8, 0xffffff, 1) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    scene.runtimeState.bullets.push({
      sprite,
      velocityX,
      velocityY,
      damage: 20,
      critChance: 0,
      critMultiplier: 1,
      owner: "player",
      effectProfile: "carbine",
      projectileConfig: {
        trajectory: trajectory ?? "linear",
        speed: 0
      },
      bouncesRemaining: 0
    });
  }, input);
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
    await stabilizeEnvironment(page);
    await expect.poll(async () => (await readSnapshot(page)).phase).toBe("COMBAT LIVE");
  }

  throw new Error(`Failed to rotate to stage ${stageId}.`);
};

test.setTimeout(60_000);

test("cover blocks bullets until destroyed", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "relay-yard");

  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectWeaponSlot(1);
    scene.debugMovePlayerTo(240, 204);
    scene.debugMoveDummyTo(380, 204);
  });

  await injectProjectile(page, { x: 240, y: 204, velocityX: 500, velocityY: 0 });
  await advanceFrames(page, 6, 60);

  const afterFirst = await readSnapshot(page);
  const coverAfterFirst = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "relay-cover-a");
  });

  expect(coverAfterFirst?.hp).toBeLessThan(60);
  expect(coverAfterFirst?.active).toBe(true);

  for (let shot = 0; shot < 2; shot += 1) {
    await injectProjectile(page, { x: 240, y: 204, velocityX: 500, velocityY: 0 });
    await advanceFrames(page, 6, 60);
  }

  const coverAfterBurst = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "relay-cover-a");
  });

  expect(coverAfterBurst?.active).toBe(false);

  await withScene(page, (scene: DebugScene) => {
    const controllable = scene as DebugScene & {
      time: { now: number };
      updateDummyCoverState(now: number): void;
    };
    controllable.debugMoveDummyTo(520, 240);
    controllable.updateDummyCoverState(controllable.time.now);
  });
  await injectProjectile(page, { x: 520, y: 240, velocityX: 0, velocityY: 0 });
  await withScene(page, (scene: DebugScene) => scene.debugResolveProjectiles());

  const afterCoverDestroyed = await readSnapshot(page);
  expect(afterCoverDestroyed.dummyHealth).toBeLessThan(afterFirst.dummyHealth);
});

test("bounce wall reflects a linear projectile and flips its y velocity", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "storm-drain");

  await injectProjectile(page, {
    x: 432,
    y: 90,
    velocityX: 0,
    velocityY: 220,
    trajectory: "linear"
  });
  await expect.poll(async () => {
    const wall = await withScene(page, (scene: DebugScene) => {
      return scene.debugGetMapObjectStates().find((object) => object.id === "drain-bounce-wall-a");
    });
    return wall?.reflectionsRemaining ?? 3;
  }).toBeLessThan(3);

  const wall = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "drain-bounce-wall-a");
  });
  const projectile = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetProjectileSnapshot().find((entry) => entry.owner === "player") ?? null;
  });

  expect(wall?.reflectionsRemaining).toBeLessThan(3);
  expect(projectile).not.toBeNull();
  expect((projectile as ProjectileSnapshot).velocityY).toBeLessThan(0);
});

test("teleporter moves the player to its pair and blocks immediate re-entry", async ({ page }) => {
  await enterCombat(page);
  await rotateToStage(page, "relay-yard");

  await withScene(page, (scene: DebugScene) => {
    scene.debugMovePlayerTo(220, 356);
    scene.debugAdvanceMapObjects((scene as unknown as { time: { now: number } }).time.now);
  });

  const afterTeleport = await readSnapshot(page);
  expect(afterTeleport.playerX).toBeCloseTo(744, 0);
  expect(afterTeleport.playerY).toBeCloseTo(184, 0);

  const cooldownUntil = await withScene(page, (scene: DebugScene) => {
    return scene.debugGetMapObjectStates().find((object) => object.id === "relay-teleporter-a")?.cooldownUntil;
  });
  expect(cooldownUntil).toBeDefined();
  await page.evaluate((now: number) => {
    const game = window.__FPS_GAME__;
    if (game === undefined) {
      throw new Error("Missing __FPS_GAME__ test handle.");
    }
    const scene = game.scene.keys.MainScene as unknown as DebugScene;
    scene.debugMovePlayerTo(220, 356);
    scene.debugAdvanceMapObjects(now);
  }, (cooldownUntil as number) - 1);

  const duringCooldown = await readSnapshot(page);
  expect(duringCooldown.playerX).toBeCloseTo(220, 0);
  expect(duringCooldown.playerY).toBeCloseTo(356, 0);

});
