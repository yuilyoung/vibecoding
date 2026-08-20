import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

type WorldObjectKind = "barrel" | "mine" | "crate" | "cover" | "bounce-wall" | "teleporter";
type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

interface WorldObjectState {
  id: string;
  kind: WorldObjectKind;
  x: number;
  y: number;
  hp: number;
  active: boolean;
  armedAt?: number;
}

interface WorldObjectPresentationDebug {
  requestedSkinId: "legacy" | "product-v1";
  skinId: "legacy" | "product-v1";
  fallbackReason: string | null;
  atlasActive: boolean;
  textureKey: string | null;
  overlayCount: number;
  objects: Array<{
    id: string;
    family: WorldObjectKind;
    state: "idle" | "damaged" | "armed" | "active";
    frameKey: string;
    x: number;
    y: number;
    rotation: number;
    visible: boolean;
    alpha: number;
  }>;
  initialized: boolean;
  destroyed: boolean;
}

interface WorldObjectScene {
  debugEnterStage(): void;
  debugRotateStage(): void;
  debugSetWeather(type: WeatherType): void;
  debugMovePlayerTo(x: number, y: number): void;
  debugMoveDummyTo(x: number, y: number): void;
  debugGetMapObjectStates(): WorldObjectState[];
  debugGetMapObjectCollisionRects(): Array<{ id: string; kind: WorldObjectKind; rect: unknown }>;
  debugGetWorldObjectPresentation(): WorldObjectPresentationDebug;
  debugDamageMapObject(id: string, damage: number): void;
  debugAdvanceMapObjects(now: number): void;
  getDebugSnapshot(): { stage: string; weather: { effective: { type: WeatherType } } };
}

const runtimePaths = [
  "/assets/runtime/world/product-v1/manifest.json",
  "/assets/runtime/world/product-v1/map-objects.webp",
  "/assets/runtime/world/product-v1/map-objects.json"
];

const withScene = <T>(page: Page, action: (scene: WorldObjectScene) => T): Promise<T> => page.evaluate(
  (fnSource: string) => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as WorldObjectScene | undefined;
    if (scene === undefined) throw new Error("Missing MainScene world-object handle.");
    return (eval(fnSource) as (target: WorldObjectScene) => T)(scene);
  },
  `(${action.toString()})`
);

const waitForScene = async (page: Page): Promise<void> => {
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const scene = window.__FPS_GAME__?.scene.keys.MainScene as unknown as WorldObjectScene | undefined;
    if (typeof scene?.debugGetWorldObjectPresentation !== "function") return false;
    try {
      return scene.debugGetWorldObjectPresentation().initialized;
    } catch {
      return false;
    }
  });
};

const open = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await waitForScene(page);
};

const readWorld = (page: Page) => withScene(page, (scene: WorldObjectScene) => ({
  presentation: scene.debugGetWorldObjectPresentation(),
  objects: scene.debugGetMapObjectStates(),
  collisions: scene.debugGetMapObjectCollisionRects(),
  snapshot: scene.getDebugSnapshot()
}));

const rotateToStage = async (page: Page, stageId: string): Promise<void> => {
  for (let index = 0; index < 4; index += 1) {
    const current = await withScene(page, (scene: WorldObjectScene) => scene.getDebugSnapshot().stage);
    if (current === stageId) return;
    await withScene(page, (scene: WorldObjectScene) => scene.debugRotateStage());
  }
  throw new Error(`Failed to rotate to ${stageId}.`);
};

const expectPresentationAligned = (world: Awaited<ReturnType<typeof readWorld>>): void => {
  expect(world.presentation.overlayCount).toBe(world.objects.length);
  expect(world.presentation.objects).toHaveLength(world.objects.length);
  for (const object of world.objects) {
    const overlay = world.presentation.objects.find((candidate) => candidate.id === object.id);
    expect(overlay, object.id).toMatchObject({
      family: object.kind,
      x: object.x,
      y: object.y,
      visible: true
    });
    expect(overlay?.frameKey).toBe(`world/product-v1/${object.kind}/${overlay?.state}`);
  }
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("keeps default, explicit legacy, and unknown routes on legacy world art", async ({ page }) => {
  for (const path of ["/", "/?worldSkin=legacy", "/?worldSkin=unknown"]) {
    const requested: string[] = [];
    const listener = (request: { url(): string }) => {
      if (runtimePaths.some((runtimePath) => request.url().includes(runtimePath))) requested.push(request.url());
    };
    page.on("request", listener);
    await open(page, path);
    const world = await readWorld(page);
    expect(world.presentation).toMatchObject({
      requestedSkinId: "legacy",
      skinId: "legacy",
      fallbackReason: null,
      atlasActive: false,
      textureKey: null,
      overlayCount: 0,
      initialized: true,
      destroyed: false
    });
    await expect(page.locator("#stage-frame")).toHaveAttribute("data-world-skin", "legacy");
    expect(requested).toEqual([]);
    page.off("request", listener);
  }
});

test("renders all six families, state changes, and stage swaps through product-v1", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

  await open(page, "/?worldSkin=product-v1");
  await withScene(page, (scene: WorldObjectScene) => scene.debugEnterStage());
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-world-skin", "product-v1");

  let world = await readWorld(page);
  expect(world.presentation).toMatchObject({
    requestedSkinId: "product-v1",
    skinId: "product-v1",
    fallbackReason: null,
    atlasActive: true,
    textureKey: "world-product-v1"
  });
  expectPresentationAligned(world);
  expect(new Set(world.presentation.objects.map((object) => object.family))).toEqual(
    new Set(["barrel", "crate", "cover"])
  );

  await withScene(page, (scene: WorldObjectScene) => {
    scene.debugDamageMapObject("foundry-barrel-a", 1);
    scene.debugDamageMapObject("foundry-crate-a", 10_000);
  });
  world = await readWorld(page);
  expect(world.presentation.objects.find((object) => object.id === "foundry-barrel-a")).toMatchObject({ state: "damaged", alpha: 1 });
  expect(world.presentation.objects.find((object) => object.id === "foundry-crate-a")).toMatchObject({ state: "damaged", alpha: 0.26 });

  await rotateToStage(page, "relay-yard");
  await withScene(page, (scene: WorldObjectScene) => {
    scene.debugSetWeather("clear");
    scene.debugMovePlayerTo(100, 100);
    scene.debugMoveDummyTo(840, 440);
  });
  world = await readWorld(page);
  expectPresentationAligned(world);
  expect(new Set(world.presentation.objects.map((object) => object.family))).toEqual(
    new Set(["barrel", "mine", "crate", "cover", "bounce-wall", "teleporter"])
  );
  const armedAt = Math.max(...world.objects.filter((object) => object.kind === "mine").map((object) => object.armedAt ?? 0));
  await page.evaluate((now: number) => {
    const game = window.__FPS_GAME__;
    const scene = game?.scene.keys.MainScene as unknown as WorldObjectScene | undefined;
    if (game === undefined || scene === undefined) throw new Error("Missing MainScene world-object handle.");
    game.loop.sleep();
    scene.debugAdvanceMapObjects(now);
  }, armedAt + 1);
  world = await readWorld(page);
  expect(world.presentation.objects.filter((object) => object.family === "mine").every((object) => object.state === "armed")).toBe(true);
  expect(world.presentation.objects.find((object) => object.family === "bounce-wall")?.state).toBe("active");
  expect(world.presentation.objects.filter((object) => object.family === "teleporter").every((object) => object.state === "active")).toBe(true);
  await page.evaluate(() => window.__FPS_GAME__?.loop.wake());

  await rotateToStage(page, "storm-drain");
  world = await readWorld(page);
  expectPresentationAligned(world);
  expect(world.presentation.objects.filter((object) => object.family === "bounce-wall")).toHaveLength(2);
  expect(world.collisions).toHaveLength(world.objects.filter((object) => object.kind !== "teleporter").length);
  expect(errors).toEqual([]);
});

test("falls the complete product presentation back for a corrupt manifest", async ({ page }) => {
  await page.route("**/assets/runtime/world/product-v1/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json() as { atlas: { imageSha256: string } };
    manifest.atlas.imageSha256 = "0".repeat(64);
    await route.fulfill({ response, json: manifest });
  });
  await open(page, "/?worldSkin=product-v1");
  const world = await readWorld(page);
  expect(world.presentation).toMatchObject({
    requestedSkinId: "product-v1",
    skinId: "legacy",
    atlasActive: false,
    overlayCount: 0
  });
  expect(world.presentation.fallbackReason).toContain("manifest atlas record mismatch");
  await expect(page.locator("#stage-frame")).toHaveAttribute("data-world-skin", "legacy");
});

test("falls back atomically for an incomplete atlas and survives scene restart", async ({ page }) => {
  await page.route("**/assets/runtime/world/product-v1/map-objects.json", async (route) => {
    const response = await route.fetch();
    const atlas = await response.json() as { frames: Record<string, unknown> };
    delete atlas.frames[Object.keys(atlas.frames)[0]];
    await route.fulfill({ response, json: atlas });
  });
  await open(page, "/?worldSkin=product-v1");
  expect((await readWorld(page)).presentation).toMatchObject({ skinId: "legacy", atlasActive: false, overlayCount: 0 });

  await page.unroute("**/assets/runtime/world/product-v1/map-objects.json");
  await page.reload();
  await waitForScene(page);
  const before = await readWorld(page);
  expect(before.presentation).toMatchObject({ skinId: "product-v1", atlasActive: true });
  await page.evaluate(() => {
    const game = window.__FPS_GAME__;
    if (game === undefined) throw new Error("Missing game handle.");
    game.scene.stop("MainScene");
    game.scene.start("MainScene");
  });
  await waitForScene(page);
  const after = await readWorld(page);
  expect(after.presentation).toMatchObject({
    skinId: "product-v1",
    atlasActive: true,
    overlayCount: before.presentation.overlayCount,
    initialized: true,
    destroyed: false
  });
});

test("preserves domain positions and collision rectangles across legacy and product routes", async ({ page }) => {
  await open(page, "/?worldSkin=legacy");
  const legacy = await readWorld(page);
  await open(page, "/?worldSkin=product-v1");
  const product = await readWorld(page);
  expect(product.objects).toEqual(legacy.objects);
  expect(product.collisions).toEqual(legacy.collisions);
});
