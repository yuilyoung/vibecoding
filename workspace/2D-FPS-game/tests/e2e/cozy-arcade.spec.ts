import { expect, test, type Page } from "@playwright/test";
import type { MainScene } from "../../src/scenes/MainScene";

async function ready(page: Page, path = "/?arcade=cozy") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForScene(page);
}

async function waitForScene(page: Page) {
  await page.waitForFunction(() => (window.__FPS_GAME__?.scene.keys.MainScene as MainScene | undefined)?.sys.isActive(), undefined, { timeout: 60000 });
  await expect(page.locator("#primary-play")).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
  await page.addInitScript(() => localStorage.clear());
});

test("enters the cute experience from the ordinary UI and retains both character and stage choices", async ({ page }) => {
  // Includes four complete page boots on Windows CI; keep gameplay assertions strict.
  test.setTimeout(180000);
  await ready(page, "/");
  await page.locator(".cozy-picker summary").click();
  await page.locator('input[name="character"][value="arcade-bunny"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('input[name="character"][value="arcade-bear"]')).toBeChecked();
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    scene.debugEnterStage(); scene.debugSelectTeam("BLUE"); scene.debugConfirmTeamSelection(); scene.debugForceCombatLive();
    scene.debugMovePlayerTo(100, 90);
  });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).getDebugSnapshot().playerX)).toBe(100);
  await page.locator('input[name="character"][value="arcade-bear"]').check();
  await page.locator('.cozy-stage-card:has(input[value="bubble-bay"])').click();
  await page.getByTestId("cozy-play").click();
  await expect(page).toHaveURL(/arcade=cozy.*actorSkin=arcade-bear.*stage=bubble-bay/);
  await waitForScene(page);
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "arcade-bear");
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", "bubble-bay");
  await page.reload();
  await waitForScene(page);
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", "bubble-bay");
  await expect(page.locator('input[name="character"][value="arcade-bear"]')).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByTestId("cozy-play")).toBeVisible();
  await page.getByRole("link", { name: "기존 아레나" }).click();
  await waitForScene(page);
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", "foundry");
});

test("renders three distinct playgrounds through all five weather states without browser errors", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(request.url()));
  await page.setViewportSize({ width: 1160, height: 1180 });
  await ready(page);
  await page.locator(".cozy-picker summary").click();
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    scene.debugEnterStage(); scene.debugSelectTeam("BLUE"); scene.debugConfirmTeamSelection(); scene.debugForceCombatLive();
    scene.setInputOverlayActive(true);
  });
  for (const stage of ["garden-maze", "bubble-bay", "picnic-plaza"]) {
    for (const weather of ["clear", "rain", "fog", "sandstorm", "storm"] as const) {
      await page.evaluate(({ stage, weather }) => {
        const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
        for (let count = 0; count < 3 && scene.getDebugSnapshot().stage !== stage; count++) scene.debugRotateStage();
        scene.debugSetWeather(weather);
      }, { stage, weather });
      await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", stage);
      await page.waitForTimeout(120);
      await page.locator("canvas").screenshot({ path: testInfo.outputPath(`${stage}-${weather}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

test("real shots wear different skins and real object destruction emits fragments with deterministic cleanup", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await ready(page, "/?arcade=cozy&stage=picnic-plaza");
  await page.locator(".cozy-picker summary").click();
  const result = await page.evaluate(() => {
    const game = window.__FPS_GAME__!;
    const scene = game.scene.keys.MainScene as MainScene;
    scene.debugEnterStage(); scene.debugSelectTeam("BLUE"); scene.debugConfirmTeamSelection(); scene.debugForceCombatLive();
    scene.debugMovePlayerTo(130, 90); scene.debugMoveDummyTo(820, 440);
    game.loop.sleep();
    const styles: string[] = [];
    for (const slot of [1, 2, 3]) {
      scene.debugSelectWeaponSlot(slot); scene.debugFireAt(800, 90);
      styles.push(...scene.children.list.flatMap((child) => {
        const style = child.getData("arcadeProjectile"); return typeof style === "string" ? [style] : [];
      }));
      scene.clearBullets();
    }
    const object = scene.debugGetMapObjectStates().find((state) => state.kind === "crate" && state.active)!;
    const before = scene.debugGetMapObjectCollisionRects().some((rect) => rect.id === object.id);
    scene.debugDamageMapObject(object.id, 999);
    const after = scene.debugGetMapObjectCollisionRects().some((rect) => rect.id === object.id);
    const effects = scene.debugGetIntegratedPresentationEffectCount();
    game.loop.wake();
    return { before, after, effects, styles: [...new Set(styles)] };
  });
  expect(result).toMatchObject({ before: true, after: false });
  expect(result.styles).toEqual(expect.arrayContaining(["bubble", "star", "comet"]));
  expect(result.effects).toBeGreaterThan(0);
  await page.locator("canvas").screenshot({ path: testInfo.outputPath("picnic-destruction.png") });
  await expect.poll(() => page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).debugGetIntegratedPresentationEffectCount())).toBe(0);
  for (let index = 0; index < 3; index++) {
    await page.evaluate(() => new Promise<void>((resolve) => {
      const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
      scene.events.once("create", resolve); scene.scene.restart();
    }));
    expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).debugGetIntegratedPresentationEffectCount())).toBe(0);
    expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).debugGetProjectileSnapshot())).toEqual([]);
    expect(await page.evaluate(() => {
      const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
      scene.debugForceCombatLive(); scene.debugSelectWeaponSlot(1); scene.debugFireAt(900, 90);
      return scene.children.list.some((child) => child.getData("arcadeProjectile") === "bubble");
    })).toBe(true);
  }
});
