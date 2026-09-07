import { expect, test, type Page } from "@playwright/test";
import type { HudSnapshot } from "../../src/ui/hud-events";
import type { MainScene } from "../../src/scenes/MainScene";

const ready = async (page: Page) => {
  await page.goto("/");
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as MainScene | undefined)?.getHudSnapshot === "function");
  await expect(page.locator("#weapon-slot-grid button")).toHaveCount(6, { timeout: 15000 });
};
const combat = async (page: Page) => {
  await ready(page);
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    scene.debugEnterStage(); scene.debugSelectTeam("BLUE"); scene.debugConfirmTeamSelection(); scene.debugForceCombatLive();
    scene.debugMovePlayerTo(120, 90); scene.debugMoveDummyTo(800, 450);
  });
  await expect(page.locator("#phase-chip")).toHaveText("COMBAT LIVE");
};
const read = (page: Page): Promise<HudSnapshot> => page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).getHudSnapshot());

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()); });

test("places the score above and energy/weapons below the unobstructed arena at desktop and narrow widths", async ({ page }) => {
  await ready(page);
  for (const width of [1440, 960, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      };
      return { canvas: rect("canvas"), score: rect(".match-scoreboard"), dock: rect(".combat-dock"), slots: rect("#weapon-slot-grid"), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(boxes.score.bottom).toBeLessThan(boxes.canvas.top);
    expect(boxes.dock.top).toBeGreaterThanOrEqual(boxes.canvas.bottom);
    expect(boxes.slots.left).toBeGreaterThanOrEqual(0);
    expect(boxes.slots.right).toBeLessThanOrEqual(width);
    expect(boxes.overflow).toBe(false);
    await expect(page.locator("#weather-pill")).toBeVisible();
    await page.screenshot({ path: `docs/reports/arcade-hud-evidence/entry-${width}.png`, fullPage: true });
  }
});

test("shows actual damage, low energy, recovery and expired feedback", async ({ page }) => {
  await combat(page);
  await page.evaluate(() => {
    const s = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    s.setInputOverlayActive(true); s.debugDamagePlayer(75);
    window.__FPS_GAME__!.loop.sleep();
  });
  await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "25");
  await expect(page.locator("#energy-status")).toContainText("LOW ENERGY");
  await expect(page.locator("#combat-feedback")).toContainText("−75 HP");
  await expect(page.locator("#damage-flash")).toHaveClass(/is-active/);
  await page.screenshot({ path: "docs/reports/arcade-hud-evidence/hit.png", fullPage: true });
  await page.evaluate(() => window.__FPS_GAME__!.loop.wake());
  await expect(page.locator("#damage-flash")).not.toHaveClass(/is-active/);
  await expect(page.locator("#combat-feedback")).toBeEmpty();
  await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).debugRestoreActorHealth());
  await expect(page.locator("#combat-feedback")).toContainText("+75 HP");
  await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "100");
});

test("equips by pointer and keyboard without firing, and respects unavailable slots and settings", async ({ page }) => {
  await combat(page);
  await page.locator('[data-weapon-id="scatter"]').scrollIntoViewIfNeeded();
  const slot = await page.locator('[data-weapon-id="scatter"]').boundingBox();
  if (slot === null) throw new Error("Missing Scatter button");
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  expect((await read(page)).ammoInMagazine).toBe(6);
  await page.mouse.up();
  await expect(page.locator("#weapon-name")).toHaveText("Scatter");
  await expect(page.locator("#combat-feedback")).toContainText("SCATTER EQUIPPED");
  await expect(page.locator('[data-weapon-id="scatter"]')).toHaveAttribute("aria-pressed", "true");
  expect((await read(page)).ammoInMagazine).toBe(3);
  await expect(page.locator('[data-weapon-id="bazooka"]')).toBeDisabled();
  await page.keyboard.press("1");
  await expect(page.locator("#weapon-name")).toHaveText("Carbine");
  await page.locator("#open-settings").click();
  await expect(page.getByTestId("settings-panel")).toHaveAttribute("aria-hidden", "false");
  await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).requestWeaponSlot(2));
  expect((await read(page)).weaponSlot).toBe(1);
  await page.getByTestId("settings-close").click();
  await page.locator('[data-weapon-id="scatter"]').click();
  await expect(page.locator("#weapon-name")).toHaveText("Scatter");
  await page.locator('[data-weapon-id="carbine"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#weapon-name")).toHaveText("Carbine");
});

test("reflects real weapon cooldown and reload completion", async ({ page }) => {
  await combat(page);
  await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    scene.debugFire();
    scene.update(scene.time.now, 0);
    window.__FPS_GAME__!.loop.sleep();
  });
  await expect(page.locator("#weapon-readiness")).toHaveAttribute("data-state", "cooldown");
  await page.evaluate(() => window.__FPS_GAME__!.loop.wake());
  await expect.poll(async () => (await read(page)).ammoInMagazine).toBe(5);
  await page.keyboard.press("r");
  await expect(page.locator("#weapon-readiness")).toHaveAttribute("data-state", "reload");
  await expect(page.locator("#reload-text")).toHaveText("RELOADING");
  await expect(page.locator("#weapon-readiness")).toHaveAttribute("data-state", "ready");
  expect((await read(page)).ammoInMagazine).toBe(6);
});

test("scores a projectile elimination and clears transient state on scene restart", async ({ page }) => {
  await combat(page);
  await page.evaluate(() => {
    const s = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    s.debugMovePlayerTo(120, 90); s.debugMoveDummyTo(200, 90);
    // Use the real projectile resolver; low target health makes one hit decisive.
    const target = s as unknown as { dummyLogic: { state: { health: number } } };
    target.dummyLogic.state.health = 1;
    s.debugFireAt(200, 90);
  });
  await expect(page.locator("#score-text")).toHaveText("1 : 0");
  await expect(page.locator("#combat-feedback")).toContainText("ROUND WON");
  await page.screenshot({ path: "docs/reports/arcade-hud-evidence/score.png", fullPage: true });
  await page.evaluate(() => new Promise<void>((resolve) => {
    const s = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
    s.events.once("create", resolve); s.scene.restart();
  }));
  // Phaser recreates presentation while the existing match state remains authoritative.
  const restored = await read(page);
  await expect(page.locator("#score-text")).toHaveText(`${restored.playerScore} : ${restored.dummyScore}`);
  await expect(page.locator("#combat-feedback")).toBeEmpty();
  await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator("#damage-flash")).not.toHaveClass(/is-active/);
  await page.locator('[data-weapon-id="carbine"]').focus();
  await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).debugForceMatchOver("PLAYER"));
  await page.keyboard.press("Enter");
  await expect(page.locator("#score-text")).toHaveText("0 : 0");
  await expect(page.locator("#phase-chip")).toHaveText("TEAM SELECT");
  await expect(page.locator("#combat-feedback")).toBeEmpty();
});

test("keeps settings fully reachable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator("#open-settings").click();
  await expect(page.getByTestId("settings-save")).toBeInViewport();
  await expect(page.getByTestId("settings-close")).toBeInViewport();
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("settings-panel")).toHaveAttribute("aria-hidden", "true");
});

test("captures all three arena palettes and five weather states without rendering errors", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(request.url()));
  await page.setViewportSize({ width: 1280, height: 960 });
  await combat(page);
  await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as MainScene).setInputOverlayActive(true));
  for (const stage of ["foundry", "relay-yard", "storm-drain"]) {
    for (const weather of ["clear", "rain", "fog", "sandstorm", "storm"] as const) {
      await page.evaluate(({ stage, weather }) => {
        const s = window.__FPS_GAME__!.scene.keys.MainScene as MainScene;
        for (let n = 0; n < 3 && s.getDebugSnapshot().stage !== stage; n++) s.debugRotateStage();
        s.debugSetWeather(weather);
      }, { stage, weather });
      await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", stage);
      await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", weather);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `docs/reports/arcade-hud-evidence/${stage}-${weather}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
