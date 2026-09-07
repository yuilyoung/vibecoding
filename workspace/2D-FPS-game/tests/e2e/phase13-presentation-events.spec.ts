import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

interface PresentationScene {
  debugEnterStage(): void;
  debugDamageMapObject(id: string, damage: number): void;
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
  await page.goto(path);
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as PresentationScene | undefined)?.debugGetIntegratedPresentationEffectCount === "function");
};

test("keeps interaction feedback opt-in and releases it on scene restart", async ({ page }) => {
  await open(page, "/?worldSkin=legacy");
  await withScene(page, (scene) => scene.debugEnterStage());
  expect(await withScene(page, (scene) => {
    scene.debugDamageMapObject("foundry-barrel-a", 1);
    return scene.debugGetIntegratedPresentationEffectCount();
  })).toBe(0);

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
  expect(await withScene(page, (scene) => {
    scene.debugDamageMapObject("foundry-barrel-a", 1);
    return scene.debugGetIntegratedPresentationEffectCount();
  })).toBeGreaterThan(0);

  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    if (game === undefined) throw new Error("Missing game handle.");
    game.scene.stop("MainScene");
    game.scene.start("MainScene");
  });
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as PresentationScene | undefined)?.debugGetIntegratedPresentationEffectCount === "function");
  expect(await withScene(page, (scene) => scene.debugGetIntegratedPresentationEffectCount())).toBe(0);
});
