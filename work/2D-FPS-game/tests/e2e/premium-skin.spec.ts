import { expect, test } from "@playwright/test";

async function assertPremiumSkin(page: import("@playwright/test").Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.waitForTimeout(500);
  expect(pageErrors).toEqual([]);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#weapon-icon")).toHaveAttribute("src", /kenney-weapon-carbine/);
  await expect(page.locator(".hud-card").first()).toBeVisible();
  await expect.poll(() => page.locator("#weapon-icon").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

test("premium Kenney skin renders at desktop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await assertPremiumSkin(page);
  await page.screenshot({ path: testInfo.outputPath("premium-skin-desktop.png"), fullPage: true });
});

test("premium Kenney skin retains a usable mobile layout", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertPremiumSkin(page);
  await expect(page.locator(".shell-main")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("premium-skin-mobile.png"), fullPage: true });
});