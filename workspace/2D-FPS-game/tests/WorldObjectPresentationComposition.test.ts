import { readFileSync } from "node:fs";
import { vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    GameObjects: { Events: { DESTROY: "destroy" } }
  }
}));

import {
  WORLD_OBJECT_ATLAS_TEXTURE_KEY,
  WORLD_OBJECT_SKIN_DEFINITIONS,
  createExpectedWorldObjectFrames
} from "../src/domain/visual/WorldObjectSkinCatalog";
import {
  WorldObjectPresentationComposition,
  preloadWorldObjectPresentationAssets
} from "../src/scenes/world-object-presentation-composition";

class FakeAnchor {
  public visible = true;
  public rotation = 0;
  public displayWidth = 48;
  public displayHeight = 24;
  private readonly listeners = new Map<string, Set<() => void>>();

  public constructor(public x: number, public y: number) {}

  public once(event: string, listener: () => void): this {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  public off(event: string, listener: () => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  public emitDestroy(): void {
    for (const listener of [...(this.listeners.get("destroy") ?? [])]) listener();
  }
}

class FakeSprite {
  public originX = 0.5;
  public originY = 0.5;
  public scale = 1;
  public depth = 0;
  public rotation = 0;
  public visible = true;
  public alpha = 1;
  public destroyed = false;
  public destroyCalls = 0;
  public displayWidth = 256;
  public displayHeight = 256;

  public constructor(
    public x: number,
    public y: number,
    public readonly texture: { key: string },
    public frame: { name: string }
  ) {}

  public setOrigin(x: number, y: number): this { this.originX = x; this.originY = y; return this; }
  public setScale(scale: number): this { this.scale = scale; return this; }
  public setDisplaySize(width: number, height: number): this { this.displayWidth = width; this.displayHeight = height; return this; }
  public setDepth(depth: number): this { this.depth = depth; return this; }
  public setRotation(rotation: number): this { this.rotation = rotation; return this; }
  public setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  public setVisible(visible: boolean): this { this.visible = visible; return this; }
  public setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  public setFrame(frame: string): this { this.frame.name = frame; return this; }
  public destroy(): void { this.destroyed = true; this.destroyCalls += 1; }
}

const readManifest = (): Record<string, unknown> => JSON.parse(
  readFileSync("public/assets/runtime/world/product-v1/manifest.json", "utf8")
) as Record<string, unknown>;

const createScene = (options: { manifest?: unknown; textureLoaded?: boolean } = {}) => {
  const sprites: FakeSprite[] = [];
  const loadJson = vi.fn();
  const loadAtlas = vi.fn();
  const manifest = "manifest" in options ? options.manifest : readManifest();
  const scene = {
    cache: {
      json: {
        has: () => manifest !== undefined,
        get: () => manifest
      }
    },
    load: { json: loadJson, atlas: loadAtlas },
    textures: {
      exists: () => options.textureLoaded !== false,
      get: () => ({
        getSourceImage: () => ({ width: 2048, height: 1024 }),
        getFrameNames: () => ["__BASE", ...createExpectedWorldObjectFrames().map((frame) => frame.key)]
      })
    },
    add: {
      sprite: (x: number, y: number, textureKey: string, frameKey: string) => {
        const sprite = new FakeSprite(x, y, { key: textureKey }, { name: frameKey });
        sprites.push(sprite);
        return sprite;
      }
    }
  };
  return { scene, sprites, loadJson, loadAtlas };
};

describe("WorldObjectPresentationComposition", () => {
  it("preloads manifest and atlas only for product-v1", () => {
    const product = createScene({ manifest: undefined, textureLoaded: false });
    preloadWorldObjectPresentationAssets(product.scene as never, WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]);
    expect(product.loadJson).toHaveBeenCalledWith(
      "world-product-v1-manifest",
      "/assets/runtime/world/product-v1/manifest.json"
    );
    expect(product.loadAtlas).toHaveBeenCalledWith(
      WORLD_OBJECT_ATLAS_TEXTURE_KEY,
      "/assets/runtime/world/product-v1/map-objects.webp",
      "/assets/runtime/world/product-v1/map-objects.json"
    );

    const legacy = createScene();
    preloadWorldObjectPresentationAssets(legacy.scene as never, WORLD_OBJECT_SKIN_DEFINITIONS.legacy);
    expect(legacy.loadJson).not.toHaveBeenCalled();
    expect(legacy.loadAtlas).not.toHaveBeenCalled();
  });

  it("uses anchor-sized stage overlays and synchronizes gate and pickup visibility", () => {
    const { scene, sprites } = createScene();
    const composition = new WorldObjectPresentationComposition(scene as never, WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]);
    composition.initialize();
    const gate = new FakeAnchor(480, 430);
    gate.displayWidth = 96;
    gate.displayHeight = 24;
    const pickup = new FakeAnchor(160, 430);
    const gateHandle = composition.attach(gate, "service-gate", "service-gate");
    const pickupHandle = composition.attach(pickup, "ammo-pickup", "ammo-pickup");
    composition.sync(gateHandle!, { active: true, hp: 1, now: 1_000, open: true });
    composition.sync(pickupHandle!, { active: true, hp: 1, now: 1_000, available: false, visible: false });
    expect(sprites[0]).toMatchObject({
      frame: { name: "world/product-v1/service-gate/open" },
      displayWidth: 96,
      displayHeight: 24
    });
    expect(sprites[1]).toMatchObject({
      frame: { name: "world/product-v1/ammo-pickup/available" },
      scale: 0.22,
      visible: false
    });
  });

  it("attaches non-interactive overlays and synchronizes state, position, rotation, and alpha", () => {
    const { scene, sprites } = createScene();
    const composition = new WorldObjectPresentationComposition(
      scene as never,
      WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]
    );
    composition.initialize();
    composition.initialize();
    const barrel = new FakeAnchor(100, 200);
    const wall = new FakeAnchor(300, 400);
    wall.rotation = Math.PI / 4;
    const barrelHandle = composition.attach(barrel as never, "barrel", "barrel-a");
    const wallHandle = composition.attach(wall as never, "bounce-wall", "wall-a");
    expect(barrelHandle).not.toBeNull();
    expect(wallHandle).not.toBeNull();
    barrel.visible = false;
    composition.sync(barrelHandle!, { active: true, hp: 20, maxHp: 60, now: 1_000 });
    composition.sync(wallHandle!, { active: true, hp: 1, now: 1_000, reflectionsRemaining: 2 });

    expect(sprites).toHaveLength(2);
    expect(sprites[0]).toMatchObject({
      frame: { name: "world/product-v1/barrel/damaged" },
      x: 100,
      y: 200,
      scale: 0.25,
      depth: 4,
      alpha: 1,
      visible: true,
      rotation: 0
    });
    expect(sprites[1]).toMatchObject({
      frame: { name: "world/product-v1/bounce-wall/active" },
      rotation: Math.PI / 4
    });

    barrel.x = 125;
    barrel.y = 225;
    composition.sync(barrelHandle!, { active: false, hp: 0, maxHp: 60, now: 1_001 });
    expect(sprites[0]).toMatchObject({ x: 125, y: 225, alpha: 0.26 });
    expect(composition.getDebugState()).toMatchObject({
      requestedSkinId: "product-v1",
      skinId: "product-v1",
      fallbackReason: null,
      atlasActive: true,
      overlayCount: 2,
      initialized: true,
      destroyed: false
    });
  });

  it("detaches on anchor destruction and clears stage overlays without orphans", () => {
    const { scene, sprites } = createScene();
    const composition = new WorldObjectPresentationComposition(scene as never, WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]);
    composition.initialize();
    const first = new FakeAnchor(10, 20);
    const second = new FakeAnchor(30, 40);
    composition.attach(first as never, "mine", "mine-a");
    composition.attach(second as never, "crate", "crate-a");
    first.emitDestroy();
    expect(composition.getDebugState().overlayCount).toBe(1);
    expect(sprites[0].destroyCalls).toBe(1);
    composition.clear();
    expect(composition.getDebugState().overlayCount).toBe(0);
    expect(sprites[1].destroyCalls).toBe(1);
  });

  it("falls the complete composition back when a pinned manifest record fails", () => {
    const manifest = readManifest();
    (manifest.atlas as Record<string, unknown>).jsonSha256 = "0".repeat(64);
    const { scene, sprites } = createScene({ manifest });
    const composition = new WorldObjectPresentationComposition(scene as never, WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]);
    composition.initialize();
    const handle = composition.attach(new FakeAnchor(0, 0) as never, "teleporter", "teleporter-a");
    expect(handle).toBeNull();
    expect(sprites).toHaveLength(0);
    expect(composition.getDebugState()).toMatchObject({
      requestedSkinId: "product-v1",
      skinId: "legacy",
      atlasActive: false,
      overlayCount: 0
    });
    expect(composition.getDebugState().fallbackReason).not.toBeNull();
  });

  it("makes duplicate initialize, detach, clear, and destroy idempotent", () => {
    const { scene, sprites } = createScene();
    const composition = new WorldObjectPresentationComposition(scene as never, WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]);
    composition.initialize();
    const handle = composition.attach(new FakeAnchor(0, 0) as never, "teleporter", "teleporter-a");
    composition.detach(handle);
    composition.detach(handle);
    composition.clear();
    composition.destroy();
    composition.destroy();
    expect(sprites[0].destroyCalls).toBe(1);
    expect(composition.getDebugState()).toMatchObject({ overlayCount: 0, initialized: false, destroyed: true });
    expect(composition.attach(new FakeAnchor(0, 0) as never, "barrel", "late")).toBeNull();
  });
});
