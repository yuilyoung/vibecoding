import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

interface DebugSnapshot {
  phase: string;
  weather: {
    type: "clear" | "rain" | "fog" | "sandstorm" | "storm";
    movementMultiplier: number;
    visionRange: number;
    windStrengthMultiplier: number;
    minesDisabled: boolean;
  };
}

interface HudSnapshot {
  weather?: {
    type: "clear" | "rain" | "fog" | "sandstorm" | "storm";
    icon: string;
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
  getHudSnapshot(now?: number, movementBlocked?: boolean): HudSnapshot;
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugGetProjectileSnapshot(): readonly ProjectileSnapshot[];
  clearBullets(): void;
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

const injectAndAdvanceProjectile = async (page: Page, input: {
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  steps?: number;
}): Promise<ProjectileSnapshot> => {
  const snapshot = await page.evaluate(({ startX, startY, velocityX, velocityY, steps }) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as DebugScene & {
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

    const sprite = scene.add.rectangle(startX, startY, 8, 8, 0xffffff, 1) as {
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
        trajectory: "linear",
        speed: 0
      }
    });

    let latest = scene.debugGetProjectileSnapshot().find((projectile) => projectile.owner === "player") ?? null;
    for (let index = 0; index < (steps ?? 8); index += 1) {
      scene.update(0, 16);
      latest = scene.debugGetProjectileSnapshot().find((projectile) => projectile.owner === "player") ?? latest;
    }

    return latest;
  }, input);

  expect(snapshot).not.toBeNull();
  return snapshot as ProjectileSnapshot;
};

test("rain weather reduces player speed and updates the HUD icon", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    scene.debugSetWeather("rain");
    const runtimeState = scene.runtimeState as {
      currentWeather: { movementMultiplier: number };
      playerLogic: {
        reset(x?: number, y?: number): void;
        move(input: { x: number; y: number; sprint: boolean }, deltaSeconds: number, atTimeMs?: number, envMovementMultiplier?: number): void;
        state: { lastAppliedSpeed: number };
      };
    };
    runtimeState.playerLogic.reset(0, 0);
    runtimeState.playerLogic.move({ x: 1, y: 0, sprint: false }, 1, 0, runtimeState.currentWeather.movementMultiplier);

    return {
      weather: scene.getDebugSnapshot().weather,
      hudWeather: scene.getHudSnapshot().weather,
      lastAppliedSpeed: runtimeState.playerLogic.state.lastAppliedSpeed
    };
  });

  expect(result.weather.type).toBe("rain");
  expect(result.weather.movementMultiplier).toBe(0.85);
  expect(result.lastAppliedSpeed).toBeCloseTo(220 * 0.85);
  expect(result.hudWeather).toMatchObject({ type: "rain", icon: "RAIN" });
});

test("fog weather lowers vision range and activates the fog renderer", async ({ page }) => {
  await enterCombat(page);

  const result = await withScene(page, (scene) => {
    scene.debugSetWeather("fog");
    scene.debugMovePlayerTo(480, 270);
    scene.update(0, 16);
    const rendererState = (scene.weatherRenderer as { getDebugState(): { fogActive: boolean } }).getDebugState();

    return {
      weather: scene.getDebugSnapshot().weather,
      hudWeather: scene.getHudSnapshot().weather,
      rendererState
    };
  });

  expect(result.weather).toMatchObject({
    type: "fog",
    visionRange: 150
  });
  expect(result.hudWeather).toMatchObject({ type: "fog", icon: "FOG" });
  expect(result.rendererState.fogActive).toBe(true);
});

test("sandstorm adds wind drift to linear projectiles", async ({ page }) => {
  await enterCombat(page);

  await withScene(page, (scene) => scene.debugSetWeather("clear"));
  await setWind(page, 0, 3);
  const calm = await injectAndAdvanceProjectile(page, {
    startX: 120,
    startY: 500,
    velocityX: 220,
    velocityY: 0
  });
  await withScene(page, (scene) => scene.clearBullets());

  await withScene(page, (scene) => scene.debugSetWeather("sandstorm"));
  const windy = await injectAndAdvanceProjectile(page, {
    startX: 120,
    startY: 500,
    velocityX: 220,
    velocityY: 0
  });

  const weather = await withScene(page, (scene) => scene.getDebugSnapshot().weather);
  expect(weather).toMatchObject({ type: "sandstorm", windStrengthMultiplier: 2 });
  expect(windy.trajectory).toBe("linear");
  expect(windy.x).toBeGreaterThan(calm.x + 5);
});
