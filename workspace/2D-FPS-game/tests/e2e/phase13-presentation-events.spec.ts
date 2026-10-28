import { expect, test, type Page } from "@playwright/test";
import { runtimeRoute } from "./runtime-route";

test.setTimeout(90_000);

interface PresentationScene {
  debugEnterStage(): void;
  debugDamageMapObject(id: string, damage: number): void;
  debugGetMapObjectStates(): Array<{ id: string; hp: number; active: boolean }>;
  debugGetIntegratedPresentationEffectCount(): number;
  debugGetWorldObjectPresentation(): { atlasActive: boolean };
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
