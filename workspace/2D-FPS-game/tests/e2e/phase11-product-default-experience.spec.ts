import { expect, test, type Page } from "@playwright/test";

type SkinId = "legacy-vehicle" | "kenney-infantry" | "quaternius-animated";

interface ProductScene {
  requestStageEntry(): boolean;
  visualController: {
    getDebugState(): {
      requestedSkinId: SkinId;
      skinId: SkinId;
      atlasActive: boolean;
      playerTextureKey: string | null;
      dummyTextureKey: string | null;
    };
  };
  getDebugSnapshot(): {
    phase: string;
    playerX: number;
    playerY: number;
    dummyX: number;
    dummyY: number;
    audio: { activeWeatherLoopCue: string | null };
  };
}

const waitForProductScene = async (page: Page): Promise<void> => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as ProductScene | undefined;
    return typeof scene?.requestStageEntry === "function" &&
      typeof scene?.visualController?.getDebugState === "function";
  });
};

const readProductState = (page: Page) => page.evaluate(() => {
  const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as ProductScene | undefined;
  if (scene === undefined) throw new Error("Missing MainScene product handle.");
  return {
    presentation: scene.visualController.getDebugState(),
    debug: scene.getDebugSnapshot()
  };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("promotes the animated actor on the default route without prototype-facing copy", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => runtimeErrors.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => { if (response.status() >= 400) runtimeErrors.push(`${response.status()} ${response.url()}`); });

  await page.goto("/");
  await waitForProductScene(page);

  const state = await readProductState(page);
  expect(state.presentation).toMatchObject({
    requestedSkinId: "quaternius-animated",
    skinId: "quaternius-animated",
    atlasActive: true,
    playerTextureKey: "actor-animated-blue",
    dummyTextureKey: "actor-animated-red"
  });
  expect(state.debug.audio.activeWeatherLoopCue).toBeNull();
  expect(state.debug).toMatchObject({ playerX: 120, playerY: 120, dummyX: 760, dummyY: 210 });
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", "quaternius-animated");
  await expect(page.locator("#actor-skin-label")).toHaveText("Vanguard animated infantry");
  await expect(page.locator(".operator-badge--blue")).toBeVisible();
  await expect(page.locator(".operator-badge--red")).toBeVisible();
  await expect(page.locator("#player-portrait")).toBeHidden();
  await expect(page.locator("#enemy-portrait")).toBeHidden();
  await expect(page.getByTestId("primary-play")).toBeVisible();
  await expect(page.getByTestId("tutorial-overlay")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("body")).not.toContainText(/prototype|\bPOC\b|Kenney \/ CC0/i);
  expect(runtimeErrors).toEqual([]);
});

test("routes PLAY and the first Enter through one idempotent stage-entry transition", async ({ page }) => {
  await page.goto("/");
  await waitForProductScene(page);

  await page.getByTestId("primary-play").click();
  await expect.poll(async () => (await readProductState(page)).debug.phase).toBe("TEAM SELECT");
  await expect(page.getByTestId("primary-play")).toBeHidden();
  await expect(page.getByTestId("tutorial-overlay")).toHaveAttribute("aria-hidden", "false");
  expect(await page.evaluate(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as ProductScene;
    return scene.requestStageEntry();
  })).toBe(false);

  await page.reload();
  await waitForProductScene(page);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await readProductState(page)).debug.phase).toBe("TEAM SELECT");
  await expect(page.getByTestId("tutorial-overlay")).toHaveAttribute("aria-hidden", "false");
});

test("keeps explicit recovery and comparison routes deterministic", async ({ page }) => {
  for (const [path, expected] of [
    ["/?actorSkin=legacy-vehicle", "legacy-vehicle"],
    ["/?actorSkin=kenney-infantry", "kenney-infantry"],
    ["/?actorSkin=quaternius-animated", "quaternius-animated"],
    ["/?actorSkin=unknown", "legacy-vehicle"]
  ] as const) {
    await page.goto(path);
    await waitForProductScene(page);
    const state = await readProductState(page);
    expect(state.presentation.requestedSkinId).toBe(expected);
    expect(state.presentation.skinId).toBe(expected);
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-actor-skin", expected);
  }
});
