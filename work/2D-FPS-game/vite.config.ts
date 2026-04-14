import path from "node:path";
import { defineConfig } from "vite";

const phaserSourceEntry = path.resolve("node_modules/phaser/src/phaser.js");
const phaser3spectorjsStubId = "virtual:phaser3spectorjs-stub";
const phaser3spectorjsStubNamespace = "phaser3spectorjs-stub";

interface EsbuildPluginBuild {
  onResolve(options: { readonly filter: RegExp }, callback: () => { readonly path: string; readonly namespace: string }): void;
  onLoad(options: { readonly filter: RegExp; readonly namespace: string }, callback: () => { readonly contents: string; readonly loader: "js" }): void;
}

function getPhaserChunkName(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, "/");

  if (!normalizedId.includes("/node_modules/phaser/")) {
    return undefined;
  }

  if (normalizedId.endsWith("/node_modules/phaser/src/phaser.js")) {
    return "phaser-vendor";
  }

  const sourceMatch = normalizedId.match(/\/node_modules\/phaser\/src\/([^/]+)\//);
  if (sourceMatch) {
    return `phaser-${sourceMatch[1]}`;
  }

  const pluginMatch = normalizedId.match(/\/node_modules\/phaser\/plugins\/([^/]+)\//);
  if (pluginMatch) {
    return `phaser-plugin-${pluginMatch[1]}`;
  }

  return "phaser-vendor";
}

function createPhaser3spectorjsStubPlugin() {
  return {
    name: "phaser3spectorjs-stub",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (id === "phaser3spectorjs") {
        return phaser3spectorjsStubId;
      }

      return undefined;
    },
    load(id: string) {
      if (id === phaser3spectorjsStubId) {
        return "export default {};";
      }

      return undefined;
    }
  };
}

function createPhaser3spectorjsEsbuildPlugin() {
  return {
    name: "phaser3spectorjs-stub",
    setup(build: EsbuildPluginBuild) {
      build.onResolve({ filter: /^phaser3spectorjs$/ }, () => ({
        path: phaser3spectorjsStubId,
        namespace: phaser3spectorjsStubNamespace
      }));
      build.onLoad({ filter: /.*/, namespace: phaser3spectorjsStubNamespace }, () => ({
        contents: "export default {};",
        loader: "js"
      }));
    }
  };
}

export default defineConfig(({ command }) => ({
  plugins: command === "build" ? [createPhaser3spectorjsStubPlugin()] : [],
  resolve: command === "build"
    ? {
        alias: {
          phaser: phaserSourceEntry
        }
      }
    : undefined,
  server: {
    host: "127.0.0.1",
    port: 4173
  },
  preview: {
    host: "127.0.0.1",
    port: 4174
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: command === "build" ? [createPhaser3spectorjsEsbuildPlugin()] : []
    }
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "CIRCULAR_CHUNK" && warning.message.includes("phaser-")) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks(id) {
          const phaserChunk = getPhaserChunkName(id);
          if (phaserChunk !== undefined) {
            return phaserChunk;
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
}));
