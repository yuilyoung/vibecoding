import { expect, test } from "@playwright/test";

test("control plane renders token state and a directed graph without browser errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#topology-source")).toContainText("directed links");
  await expect(page.locator("#token-input")).toHaveText(/unknown|\d/);
  await expect(page.locator("#token-output")).toHaveText(/unknown|\d/);
  await expect(page.locator("#token-total")).toHaveText(/unknown|\d/);
  const edge = page.locator("#graph path.edge").first();
  expect(await edge.count()).toBeGreaterThan(0);
  await edge.click({ force: true });
  await expect(page.locator("#inspector-title")).not.toHaveText("Select an agent or edge");
  expect(errors).toEqual([]);
});