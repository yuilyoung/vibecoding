import { expect, test, type Page } from "@playwright/test";
import { runtimeRoute } from "./runtime-route";

test.setTimeout(90_000);

interface PresentationScene {
  getDebugSnapshot(): { stage: string };
  debugEnterStage(): void;
  debugSelectTeam(team: "BLUE" | "RED"): void;
  debugConfirmTeamSelection(): void;
  debugForceCombatLive(): void;
  debugRotateStage(): void;
  debugSetWeather(type: "clear" | "rain" | "fog" | "sandstorm" | "storm"): void;
  debugDamageMapObject(id: string, damage: number): void;
  debugGetMapObjectStates(): Array<{
    id: string;
    hp: number;
    active: boolean;
    reflectionsRemaining?: number;
  }>;
  debugGetProjectileSnapshot(): Array<{ owner: "player" | "dummy"; velocityY: number }>;
  debugGetIntegratedPresentationEffectCount(): number;
  debugGetWorldObjectPresentation(): { atlasActive: boolean };
  update(time: number, delta: number): void;
}

const withScene = <T>(page: Page, action: (scene: PresentationScene) => T): Promise<T> => page.evaluate(
  (source: string) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as PresentationScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene presentation handle.");
    return (eval(source) as (target: PresentationScene) => T)(scene);
  },
  `(${action.toString()})`
);

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(runtimeRoute(path, { arcade: "classic" }));
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as PresentationScene | undefined)?.debugGetIntegratedPresentationEffectCount === "function");
};

const damageAndObserve = async (page: Page, id: string, damage: number): Promise<{
  active: boolean;
  effectCount: number;
  hp: number;
}> => page.evaluate(({ targetId, amount }) => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as PresentationScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene presentation handle.");
  scene.debugDamageMapObject(targetId, amount);
  const state = scene.debugGetMapObjectStates().find((candidate) => candidate.id === targetId);
  if (state === undefined) throw new Error(`Missing map object ${targetId}.`);
  return {
    active: state.active,
    effectCount: scene.debugGetIntegratedPresentationEffectCount(),
    hp: state.hp
  };
}, { targetId: id, amount: damage });

const waitForEffectsToFinish = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => (
    window.__FPS_GAME__?.scene.keys.MainScene as unknown as PresentationScene | undefined
  )?.debugGetIntegratedPresentationEffectCount() === 0);
};

const reflectAndObserve = async (page: Page): Promise<{
  effectCount: number;
  projectileVelocityY: number;
  reflectionsRemaining: number;
  wallActive: boolean;
}> => page.evaluate(() => {
  const game = window.__FPS_GAME__;
  const scene = game?.scene.keys.MainScene as
    | (PresentationScene & {
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
          currentWind: { angleDegrees: number; strength: number };
        };
        time: { now: number };
      })
    | undefined;
  if (game === undefined || scene?.runtimeState === undefined) {
    throw new Error("Missing MainScene reflection test handle.");
  }

  scene.debugEnterStage();
  scene.debugSelectTeam("BLUE");
  scene.debugConfirmTeamSelection();
  scene.debugForceCombatLive();
  game.loop.sleep();

  for (let index = 0; index < 4 && scene.getDebugSnapshot().stage !== "storm-drain"; index += 1) {
    scene.debugRotateStage();
  }
  if (scene.getDebugSnapshot().stage !== "storm-drain") {
    throw new Error("Failed to rotate to storm-drain.");
  }

  scene.runtimeState.currentWind = { angleDegrees: 0, strength: 0 };
  scene.debugSetWeather("clear");
  scene.update(0, 0);

  const sprite = scene.add.rectangle(432, 96, 8, 8, 0xffffff, 1) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scene.runtimeState.bullets.push({
    sprite,
    velocityX: 0,
    velocityY: 220,
    damage: 20,
    critChance: 0,
    critMultiplier: 1,
    owner: "player",
    effectProfile: "carbine",
    projectileConfig: { trajectory: "linear", speed: 0 },
    bouncesRemaining: 0
  });

  scene.time.now += 50;
  scene.update(scene.time.now, 50);
  const wall = scene.debugGetMapObjectStates().find((object) => object.id === "drain-bounce-wall-a");
  const projectile = scene.debugGetProjectileSnapshot().find((entry) => entry.owner === "player");
  if (wall?.reflectionsRemaining === undefined || projectile === undefined) {
    throw new Error("Missing authoritative reflection result.");
  }
  return {
    effectCount: scene.debugGetIntegratedPresentationEffectCount(),
    projectileVelocityY: projectile.velocityY,
    reflectionsRemaining: wall.reflectionsRemaining,
    wallActive: wall.active
  };
});

test("keeps interaction feedback opt-in and releases it on scene restart", async ({ page }) => {
  await open(page, "/?worldSkin=legacy");
  await withScene(page, (scene) => scene.debugEnterStage());
  expect(await damageAndObserve(page, "foundry-barrel-a", 1)).toMatchObject({ active: true, effectCount: 0, hp: 39 });
  expect(await damageAndObserve(page, "foundry-crate-a", 1)).toMatchObject({ active: true, effectCount: 0, hp: 24 });
  expect(await damageAndObserve(page, "foundry-cover-a", 10_000)).toMatchObject({ active: false, effectCount: 0, hp: 0 });

  await open(page, "/?worldSkin=product-v1");
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as PresentationScene | undefined;
    try {
      return scene?.debugGetWorldObjectPresentation().atlasActive === true;
    } catch {
      return false;
    }
  });
  await withScene(page, (scene) => scene.debugEnterStage());
  const barrel = await damageAndObserve(page, "foundry-barrel-a", 1);
  expect(barrel).toMatchObject({ active: true, hp: 39 });
  expect(barrel.effectCount).toBeGreaterThan(0);
  await waitForEffectsToFinish(page);
  const crate = await damageAndObserve(page, "foundry-crate-a", 1);
  expect(crate).toMatchObject({ active: true, hp: 24 });
  expect(crate.effectCount).toBeGreaterThan(0);
  await waitForEffectsToFinish(page);
  const cover = await damageAndObserve(page, "foundry-cover-a", 10_000);
  expect(cover).toMatchObject({ active: false, hp: 0 });
  expect(cover.effectCount).toBeGreaterThan(0);

  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    if (game === undefined) throw new Error("Missing game handle.");
    game.scene.stop("MainScene");
    game.scene.start("MainScene");
  });
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as PresentationScene | undefined)?.debugGetIntegratedPresentationEffectCount === "function");
  expect(await withScene(page, (scene) => scene.debugGetIntegratedPresentationEffectCount())).toBe(0);
  await withScene(page, (scene) => scene.debugEnterStage());
  const restartedCrate = await damageAndObserve(page, "foundry-crate-a", 1);
  expect(restartedCrate).toMatchObject({ active: true, hp: 24 });
  expect(restartedCrate.effectCount).toBeGreaterThan(0);
});

test("publishes bounce-wall reflection feedback only for product-v1", async ({ page }) => {
  await open(page, "/?worldSkin=product-v1");
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as PresentationScene | undefined;
    return scene?.debugGetWorldObjectPresentation().atlasActive === true;
  });
  const product = await reflectAndObserve(page);
  expect(product).toMatchObject({ reflectionsRemaining: 2, wallActive: true });
  expect(product.projectileVelocityY).toBeLessThan(0);
  expect(product.effectCount).toBeGreaterThan(0);

  await open(page, "/?worldSkin=legacy");
  const legacy = await reflectAndObserve(page);
  expect(legacy).toMatchObject({ reflectionsRemaining: 2, wallActive: true });
  expect(legacy.projectileVelocityY).toBeLessThan(0);
  expect(legacy.effectCount).toBe(0);
});
