import { readFileSync } from "node:fs";

import {
  WORLD_OBJECT_ATLAS_HEIGHT,
  WORLD_OBJECT_ATLAS_TEXTURE_KEY,
  WORLD_OBJECT_ATLAS_WIDTH,
  WORLD_OBJECT_FAMILIES,
  WORLD_OBJECT_SKIN_DEFINITIONS,
  createExpectedWorldObjectFrames,
  getWorldObjectFrameKey,
  resolveWorldObjectSkinForRuntime,
  resolveWorldObjectSkinFromSearch,
  resolveWorldObjectVisualState
} from "../src/domain/visual/WorldObjectSkinCatalog";

const readManifest = (): Record<string, unknown> => JSON.parse(
  readFileSync("public/assets/runtime/world/product-v1/manifest.json", "utf8")
) as Record<string, unknown>;

const availability = () => ({
  textureKey: WORLD_OBJECT_ATLAS_TEXTURE_KEY,
  width: WORLD_OBJECT_ATLAS_WIDTH,
  height: WORLD_OBJECT_ATLAS_HEIGHT,
  frameKeys: createExpectedWorldObjectFrames().map((frame) => frame.key)
});

describe("WorldObjectSkinCatalog", () => {
  it("keeps default, explicit legacy, and unknown routes on legacy while opting in product-v1", () => {
    expect(resolveWorldObjectSkinFromSearch("").id).toBe("legacy");
    expect(resolveWorldObjectSkinFromSearch("?worldSkin=legacy").id).toBe("legacy");
    expect(resolveWorldObjectSkinFromSearch("?worldSkin=unknown").id).toBe("legacy");
    expect(resolveWorldObjectSkinFromSearch("?worldSkin=product-v1").id).toBe("product-v1");
  });

  it("defines exactly twenty stable namespaced frames for all eleven product families", () => {
    const frames = createExpectedWorldObjectFrames();
    expect(frames).toHaveLength(20);
    expect(new Set(frames.map((frame) => frame.key)).size).toBe(20);
    expect(frames[0]).toEqual({ key: "world/product-v1/barrel/idle", family: "barrel", state: "idle", index: 0 });
    expect(frames[11]).toEqual({ key: "world/product-v1/teleporter/active", family: "teleporter", state: "active", index: 11 });
    expect(frames[12]).toEqual({ key: "world/product-v1/arena-obstacle/core", family: "arena-obstacle", state: "core", index: 12 });
    expect(frames[19]).toEqual({ key: "world/product-v1/health-pickup/available", family: "health-pickup", state: "available", index: 19 });
    expect(WORLD_OBJECT_FAMILIES).toEqual([
      "barrel", "mine", "crate", "cover", "bounce-wall", "teleporter",
      "arena-obstacle", "service-gate", "vent-hazard", "ammo-pickup", "health-pickup"
    ]);
    expect(getWorldObjectFrameKey("barrel", "armed")).toBe("world/product-v1/barrel/idle");
    expect(WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"].layouts["bounce-wall"]).toMatchObject({
      displayScale: 0.25,
      displayPolicy: "fixed-scale",
      rotationPolicy: "anchor"
    });
    expect(WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"].layouts["service-gate"]).toMatchObject({
      displayPolicy: "anchor-size"
    });
  });

  it("maps obstacle variants, gate state, active hazard, and available pickups", () => {
    const common = { active: true, hp: 1, now: 1_000 };
    expect(resolveWorldObjectVisualState({ family: "arena-obstacle", ...common, variant: "tower" })).toBe("tower");
    expect(resolveWorldObjectVisualState({ family: "arena-obstacle", ...common })).toBe("core");
    expect(resolveWorldObjectVisualState({ family: "service-gate", ...common, open: false })).toBe("closed");
    expect(resolveWorldObjectVisualState({ family: "service-gate", ...common, open: true })).toBe("open");
    expect(resolveWorldObjectVisualState({ family: "vent-hazard", ...common })).toBe("active");
    expect(resolveWorldObjectVisualState({ family: "ammo-pickup", ...common, available: false })).toBe("available");
    expect(resolveWorldObjectVisualState({ family: "health-pickup", ...common, available: true })).toBe("available");
  });

  it("maps damage, arming, reflection durability, and teleporter cooldown boundaries", () => {
    const common = { active: true, hp: 60, now: 1_000 };
    expect(resolveWorldObjectVisualState({ family: "barrel", ...common, maxHp: 60 })).toBe("idle");
    expect(resolveWorldObjectVisualState({ family: "barrel", ...common, hp: 59, maxHp: 60 })).toBe("damaged");
    expect(resolveWorldObjectVisualState({ family: "crate", ...common, active: false, hp: 0, maxHp: 40 })).toBe("damaged");
    expect(resolveWorldObjectVisualState({ family: "mine", ...common, armedAt: 1_001 })).toBe("idle");
    expect(resolveWorldObjectVisualState({ family: "mine", ...common, armedAt: 1_000 })).toBe("armed");
    expect(resolveWorldObjectVisualState({ family: "bounce-wall", ...common, reflectionsRemaining: 0 })).toBe("idle");
    expect(resolveWorldObjectVisualState({ family: "bounce-wall", ...common, reflectionsRemaining: 1 })).toBe("active");
    expect(resolveWorldObjectVisualState({ family: "teleporter", ...common, cooldownUntil: 1_001 })).toBe("idle");
    expect(resolveWorldObjectVisualState({ family: "teleporter", ...common, cooldownUntil: 1_000 })).toBe("active");
  });

  it("activates product-v1 only when manifest and availability are complete", () => {
    const resolution = resolveWorldObjectSkinForRuntime(
      WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"],
      readManifest(),
      availability()
    );
    expect(resolution).toMatchObject({
      requestedSkinId: "product-v1",
      effectiveSkinId: "product-v1",
      fallbackReason: null,
      atlasActive: true
    });
  });

  it.each([
    ["schema", (manifest: Record<string, unknown>) => { manifest.schemaVersion = "9.0.0"; }],
    ["frame", (manifest: Record<string, unknown>) => { (manifest.frames as unknown[]).pop(); }],
    ["hash", (manifest: Record<string, unknown>) => { (manifest.atlas as Record<string, unknown>).imageSha256 = "0".repeat(64); }],
    ["dimension", (manifest: Record<string, unknown>) => { (manifest.atlas as Record<string, unknown>).width = 512; }],
    ["budget", (manifest: Record<string, unknown>) => { (manifest.budgets as Record<string, unknown>).transferBytes = 3_000_000; }],
    ["target path", (manifest: Record<string, unknown>) => { (manifest.targetFrame as Record<string, unknown>).path = "untrusted.png"; }],
    ["generator id", (manifest: Record<string, unknown>) => { (manifest.generator as Record<string, unknown>).id = "untrusted generator"; }],
    ["generator date", (manifest: Record<string, unknown>) => { (manifest.generator as Record<string, unknown>).generatedAt = "2099-01-01"; }],
    ["Sharp version", (manifest: Record<string, unknown>) => { (manifest.generator as Record<string, unknown>).sharpVersion = "0.0.0"; }],
    ["generator script hash", (manifest: Record<string, unknown>) => { (manifest.generator as Record<string, unknown>).scriptSha256 = "0".repeat(64); }],
    ["source path", (manifest: Record<string, unknown>) => { ((manifest.sources as Record<string, unknown>[])[0]).path = "untrusted.png"; }],
    ["source byte count", (manifest: Record<string, unknown>) => { ((manifest.sources as Record<string, unknown>[])[0]).bytes = 1; }],
    ["source hash", (manifest: Record<string, unknown>) => { ((manifest.sources as Record<string, unknown>[])[0]).sha256 = "0".repeat(64); }],
    ["source order", (manifest: Record<string, unknown>) => {
      const sources = manifest.sources as Record<string, unknown>[];
      [sources[0], sources[1]] = [sources[1], sources[0]];
    }]
  ])("falls all eleven families back for an invalid %s manifest", (_label, mutate) => {
    const manifest = readManifest();
    mutate(manifest);
    const resolution = resolveWorldObjectSkinForRuntime(
      WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"], manifest, availability()
    );
    expect(resolution.effectiveSkinId).toBe("legacy");
    expect(resolution.atlasActive).toBe(false);
    expect(resolution.fallbackReason).not.toBeNull();
  });

  it("falls back atomically for missing, wrong-sized, or incomplete loaded atlases", () => {
    const requested = WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"];
    const manifest = readManifest();
    expect(resolveWorldObjectSkinForRuntime(requested, manifest, null).effectiveSkinId).toBe("legacy");
    expect(resolveWorldObjectSkinForRuntime(requested, manifest, { ...availability(), width: 512 }).effectiveSkinId).toBe("legacy");
    expect(resolveWorldObjectSkinForRuntime(requested, manifest, {
      ...availability(), frameKeys: availability().frameKeys.slice(1)
    }).effectiveSkinId).toBe("legacy");
  });
});
