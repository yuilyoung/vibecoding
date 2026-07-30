import { describe, expect, it } from "vitest";
import { RUNTIME_ASSET_MANIFEST, resolveRuntimeTextureKey } from "../src/scenes/runtime-asset-contract";

describe("runtime asset contract", () => {
  it("uses reviewed local runtime paths only", () => {
    expect(RUNTIME_ASSET_MANIFEST.length).toBeGreaterThan(0);
    expect(RUNTIME_ASSET_MANIFEST.every((asset) => asset.path.startsWith("/assets/runtime/"))).toBe(true);
    expect(RUNTIME_ASSET_MANIFEST.every((asset) => !asset.path.includes("://"))).toBe(true);
  });
  it("keeps rendering available when a runtime asset cannot be loaded", () => {
    const textures = { exists: (key: string) => key === "loaded" };
    expect(resolveRuntimeTextureKey(textures, "loaded", "generated")).toBe("loaded");
    expect(resolveRuntimeTextureKey(textures, "missing", "generated")).toBe("generated");
  });
});