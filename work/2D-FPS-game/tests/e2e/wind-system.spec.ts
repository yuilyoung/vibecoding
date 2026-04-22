import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

interface DebugSnapshot {
  phase: string;
  wind: {
    angleDegrees: number;
    strength: number;
    forceX: number;
    forceY: number;
  };
}

interface ProjectileSnapshot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  owner: "player" | "dummy";
  trajectory: string;
}

interface DebugScene {
  getDebugSnapshot(): DebugSnapshot;
  debugGetProjectileSnapshot(): readonly ProjectileSnapshot[];
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  clearBullets(): void;
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

  await withScene(page, (scene: DebugScene) => scene.debugEnterStage());
  await withScene(page, (scene: DebugScene) => {
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
  });

  await expect.poll(async () => withScene(page, (scene: DebugScene) => scene.getDebugSnapshot().phase)).toBe("COMBAT LIVE");
};

const setWind = async (page: Page, angleDegrees: number, strength: number): Promise<void> => {
  await page.evaluate(({ nextAngleDegrees, nextStrength }) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as { runtimeState?: { currentWind: { angleDegrees: number; strength: number } } } | undefined;

    if (scene?.runtimeState === undefined) {
      throw new Error("Missing runtimeState.currentWind.");
    }

    scene.runtimeState.currentWind = {
      angleDegrees: nextAngleDegrees,
      strength: nextStrength
    };
  }, { nextAngleDegrees: angleDegrees, nextStrength: strength });
};

const seedWindRandom = async (page: Page, values: readonly number[]): Promise<void> => {
  await page.evaluate((sequence: readonly number[]) => {
    const queue = [...sequence];
    const original = Math.random;
    (window as Window & { __windRandomRestore__?: () => void }).__windRandomRestore__ = () => {
      Math.random = original;
    };
    Math.random = () => queue.shift() ?? 0;
  }, values);
};

const collectWindEvents = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const target = window as Window & { __windEvents__?: Array<{ angleDegrees: number; strength: number }> };
    target.__windEvents__ = [];
    window.addEventListener("fps-hud-wind-changed", (event) => {
      const detail = (event as CustomEvent<{ angleDegrees: number; strength: number }>).detail;
      target.__windEvents__?.push(detail);
    });
  });
};

const readWindEvents = async (page: Page): Promise<Array<{ angleDegrees: number; strength: number }>> => {
  return page.evaluate(() => {
    return (window as Window & { __windEvents__?: Array<{ angleDegrees: number; strength: number }> }).__windEvents__ ?? [];
  });
};

const injectAndAdvanceProjectile = async (page: Page, input: {
  trajectory: "arc" | "linear";
  startX?: number;
  startY?: number;
  velocityX: number;
  velocityY: number;
  windMultiplier?: number;
  steps?: number;
}): Promise<ProjectileSnapshot> => {
  const snapshot = await page.evaluate(({ trajectory, startX, startY, velocityX, velocityY, windMultiplier, steps }) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as DebugScene & {
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
    } | undefined;

    if (scene?.runtimeState === undefined) {
      throw new Error("Missing runtimeState test handle.");
    }

    const sprite = scene.add.rectangle(startX ?? 860, startY ?? 440, 8, 8, 0xffffff, 1) as {
      x: number;
      y: number;
      width: number;
      height: number;
      destroy(): void;
    };

    scene.runtimeState.bullets.push({
      sprite,
      velocityX,
      velocityY,
      damage: 40,
      critChance: 0,
      critMultiplier: 1,
      owner: "player",
      effectProfile: trajectory === "arc" ? "bazooka" : "carbine",
      projectileConfig: {
        trajectory,
        speed: 0,
        gravity: trajectory === "arc" ? 300 : undefined,
        windMultiplier
      }
    });

    let latestPlayerSnapshot = scene.debugGetProjectileSnapshot().find((projectile) => projectile.owner === "player") ?? null;
    for (let index = 0; index < (steps ?? 20); index += 1) {
      scene.update(0, 16);
      latestPlayerSnapshot = scene.debugGetProjectileSnapshot().find((projectile) => projectile.owner === "player") ?? latestPlayerSnapshot;
    }
    return latestPlayerSnapshot;
  }, input);

  expect(snapshot).not.toBeNull();
  return snapshot as ProjectileSnapshot;
};

test("bazooka projectiles drift with wind while preserving arc travel", async ({ page }) => {
  await enterCombat(page);

  await setWind(page, 0, 0);
  const calm = await injectAndAdvanceProjectile(page, {
    trajectory: "arc",
    startX: 860,
    startY: 440,
    velocityX: 0,
    velocityY: -220,
    windMultiplier: 0.35
  });
  await withScene(page, (scene: DebugScene) => scene.clearBullets());

  await setWind(page, 0, 2);
  const windy = await injectAndAdvanceProjectile(page, {
    trajectory: "arc",
    startX: 860,
    startY: 440,
    velocityX: 0,
    velocityY: -220,
    windMultiplier: 0.35
  });

  expect(calm.trajectory).toBe("arc");
  expect(windy.trajectory).toBe("arc");
  expect(windy.x).toBeGreaterThan(calm.x + 5);
});

test("carbine projectiles ignore wind", async ({ page }) => {
  await enterCombat(page);

  await setWind(page, 0, 0);
  const calm = await injectAndAdvanceProjectile(page, {
    trajectory: "linear",
    startX: 120,
    startY: 500,
    velocityX: 220,
    velocityY: 0,
    steps: 8
  });
  await withScene(page, (scene: DebugScene) => scene.clearBullets());

  await setWind(page, 0, 3);
  const windy = await injectAndAdvanceProjectile(page, {
    trajectory: "linear",
    startX: 120,
    startY: 500,
    velocityX: 220,
    velocityY: 0,
    steps: 8
  });

  expect(calm.trajectory).toBe("linear");
  expect(windy.trajectory).toBe("linear");
  expect(Math.abs(windy.x - calm.x)).toBeLessThanOrEqual(4);
});

test("round reset rotates wind and broadcasts the HUD wind event", async ({ page }) => {
  await seedWindRandom(page, [0, 0]);
  await enterCombat(page);
  await collectWindEvents(page);
  await setWind(page, 225, 3);

  const before = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot().wind);

  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as {
      matchFlowController?: { resetRoundState(now: number): void };
      time?: { now: number };
    } | undefined;

    if (scene?.matchFlowController === undefined || scene.time === undefined) {
      throw new Error("Missing matchFlowController test handles.");
    }

    scene.matchFlowController.resetRoundState(scene.time.now);
  });

  await expect.poll(async () => {
    const next = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot().wind);
    return next.angleDegrees !== before.angleDegrees || next.strength !== before.strength;
  }).toBe(true);

  const after = await withScene(page, (scene: DebugScene) => scene.getDebugSnapshot().wind);
  const events = await readWindEvents(page);

  expect(before).toMatchObject({ angleDegrees: 225, strength: 3 });
  expect(after.angleDegrees !== before.angleDegrees || after.strength !== before.strength).toBe(true);
  expect(events.length).toBeGreaterThan(0);
  expect(events).toContainEqual({ angleDegrees: after.angleDegrees, strength: after.strength });
});
