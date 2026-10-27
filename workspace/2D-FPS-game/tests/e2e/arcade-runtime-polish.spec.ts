import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("enters the integrated arcade setup with distinct map previews and integer HUD health", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("selection-flow")).toBeVisible();
  await expect(page.locator('input[name="stage"]')).toHaveCount(8);
  const previewBackgrounds = await page.locator(".selection-flow__map-thumb").evaluateAll((elements) =>
    new Set(elements.map((element) => getComputedStyle(element).backgroundImage)).size
  );
  expect(previewBackgrounds).toBe(8);

  await page.locator('label:has(input[name="character"][value="arcade-cat"])').click();
  await page.locator('label:has(input[name="stage"][value="neon-city"])').click();
  await page.locator('select[name="weather"]').selectOption("rain");
  await page.getByTestId("duel-entry").click();

  await expect(page).toHaveURL(/arcade=cozy.*actorSkin=arcade-cat.*stage=neon-city.*setup=complete.*weather=rain/);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => typeof (window.__FPS_GAME__?.scene.keys.MainScene as unknown as { getHudSnapshot?: unknown } | undefined)?.getHudSnapshot === "function", undefined, { timeout: 60_000 });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-stage-id", "neon-city");
  expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as unknown as { debugGetWeather(): { type: string } }).debugGetWeather())).toMatchObject({ type: "rain" });
  expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as unknown as { runtimeState: { currentWeather: { type: string } } }).runtimeState.currentWeather)).toMatchObject({ type: "rain" });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", "rain");
  await expect(page.locator(".arcade-profile")).toHaveCount(2);
  await expect(page.locator("#player-portrait")).toHaveCount(0);
  await expect(page.locator("#enemy-portrait")).toHaveCount(0);

  await page.evaluate(() => {
    const scene = window.__FPS_GAME__!.scene.keys.MainScene as unknown as {
      debugEnterStage(): void;
      debugSelectTeam(team: "BLUE"): void;
      debugConfirmTeamSelection(): void;
      debugForceCombatLive(): void;
      debugDamagePlayer(amount: number): void;
      debugSetWeather(type: "storm"): void;
      debugGetWeatherSoundQueue(): readonly { action: string; cue: string }[];
    };
    scene.debugEnterStage();
    scene.debugSelectTeam("BLUE");
    scene.debugConfirmTeamSelection();
    scene.debugForceCombatLive();
    scene.debugDamagePlayer(27.6);
    scene.debugSetWeather("storm");
  });

  await expect(page.locator("#player-health-text")).toHaveText(/^\d+\/\d+$/);
  await expect(page.locator("#energy-meter")).toHaveAttribute("aria-valuenow", /^\d+$/);
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-weather", "storm");
  expect(await page.evaluate(() => (window.__FPS_GAME__!.scene.keys.MainScene as unknown as { debugGetWeatherSoundQueue(): readonly { action: string; cue: string }[] }).debugGetWeatherSoundQueue())).toEqual(
    expect.arrayContaining([expect.objectContaining({ action: "play", cue: "weather.storm.loop" })])
  );
  await expect.poll(async () => page.locator(".game-root").evaluate((element) => getComputedStyle(element, "::after").opacity)).toBe("0.22");
});
