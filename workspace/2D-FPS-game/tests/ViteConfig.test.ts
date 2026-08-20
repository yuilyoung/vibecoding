import { describe, expect, it } from "vitest";
import {
  createPhaser3spectorjsEsbuildPlugin,
  createPhaser3spectorjsStubPlugin,
  phaser3spectorjsStubSource
} from "../vite.config";

describe("Phaser Spector production stub", () => {
  it("exposes named and default Spector interop through the Vite loader", () => {
    const plugin = createPhaser3spectorjsStubPlugin();
    const resolved = plugin.resolveId("phaser3spectorjs");

    expect(resolved).toBe("virtual:phaser3spectorjs-stub");
    expect(plugin.load(resolved as string)).toBe(phaser3spectorjsStubSource);
    expect(phaser3spectorjsStubSource).toContain("class Spector");
    expect(phaser3spectorjsStubSource).toContain("this.onCapture = { add() {} }");
    expect(phaser3spectorjsStubSource).toContain("export { Spector }");
    expect(phaser3spectorjsStubSource).toContain("export default { Spector }");
  });

  it("uses the identical stub source through the esbuild loader", () => {
    let resolveCallback: (() => { readonly path: string; readonly namespace: string }) | undefined;
    let loadCallback: (() => { readonly contents: string; readonly loader: "js" }) | undefined;
    const plugin = createPhaser3spectorjsEsbuildPlugin();

    plugin.setup({
      onResolve(_options, callback) {
        resolveCallback = callback;
      },
      onLoad(_options, callback) {
        loadCallback = callback;
      }
    });

    expect(resolveCallback?.()).toEqual({
      path: "virtual:phaser3spectorjs-stub",
      namespace: "phaser3spectorjs-stub"
    });
    expect(loadCallback?.()).toEqual({ contents: phaser3spectorjsStubSource, loader: "js" });
  });
});
