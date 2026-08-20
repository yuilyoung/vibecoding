export const WORLD_OBJECT_FAMILIES = Object.freeze([
  "barrel",
  "mine",
  "crate",
  "cover",
  "bounce-wall",
  "teleporter"
] as const);

export type WorldObjectFamily = (typeof WORLD_OBJECT_FAMILIES)[number];
export type ProductWorldObjectState = "idle" | "damaged" | "armed" | "active";
export type WorldObjectSkinId = "legacy" | "product-v1";
export type WorldObjectRotationPolicy = "none" | "anchor";

export const WORLD_OBJECT_ATLAS_MANIFEST_CACHE_KEY = "world-product-v1-manifest";
export const WORLD_OBJECT_ATLAS_MANIFEST_RUNTIME_PATH = "/assets/runtime/world/product-v1/manifest.json";
export const WORLD_OBJECT_ATLAS_TEXTURE_KEY = "world-product-v1";
export const WORLD_OBJECT_ATLAS_IMAGE_RUNTIME_PATH = "/assets/runtime/world/product-v1/map-objects.webp";
export const WORLD_OBJECT_ATLAS_JSON_RUNTIME_PATH = "/assets/runtime/world/product-v1/map-objects.json";
export const WORLD_OBJECT_ATLAS_WIDTH = 1024;
export const WORLD_OBJECT_ATLAS_HEIGHT = 1024;
export const WORLD_OBJECT_ATLAS_TRANSFER_LIMIT_BYTES = 2 * 1024 * 1024;
export const WORLD_OBJECT_ATLAS_GPU_LIMIT_BYTES = 4 * 1024 * 1024;

const PINNED_RELEASE = Object.freeze({
  imageSha256: "c5598986a42ee5f6dffb992707f26dad8a3196d34b479c3055a754b2abbe86f6",
  jsonSha256: "713f8b621815cd48970748729b4f61dccd95788ce713a66d911722709b2dc18b",
  pixelSha256: "7f429bebc766694a3a4cfdb361f7b31f3bc0bd6ca22698f00872ac6f8a9cc492",
  imageBytes: 285_362,
  jsonBytes: 4_565,
  totalTransferBytes: 295_024,
  targetFrameBytes: 1_063_704,
  targetFrameSha256: "1bf5e7ff6330854d8e9a7020c261c0c0778ad0baa782c446a1e88679bc01e8e6"
});

const PINNED_PROVENANCE = Object.freeze({
  targetFramePath: "docs/reports/phase12-t0-evidence/phase12-foundry-target-frame-v5.png",
  generator: Object.freeze({
    id: "OpenAI built-in image generation",
    generatedAt: "2026-08-21",
    sharpVersion: "0.35.3",
    scriptSha256: "bf5f5e18908180c08eb2fba48c1af7cf9ec6f0c1e1b38a8f53a74bdca2497eb3"
  }),
  sources: Object.freeze([
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/barrel-idle.png", bytes: 730_789, sha256: "3e9a792e4df66a67801a2c9e0b885f3ee1f808c9879999a4fadb470d922220cf" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/barrel-damaged.png", bytes: 768_933, sha256: "074e24bc9a5580bb055e0612a9fcb885b84b8cc69d847647dae7f759c38a44c5" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/mine-idle.png", bytes: 1_079_469, sha256: "c0575d9ec3e21039b397e89c32bd0a431df840391ec5594fc14fcbdf6253c62d" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/mine-armed.png", bytes: 1_110_525, sha256: "6d6891cbcca1988033a469f02625a01d94ff7c3bf9cdc94d58a085d754459336" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/crate-idle.png", bytes: 1_042_676, sha256: "ed4f01a88343b3ea95ef0a209e7af85185f17c2a81a486c6aee81a3b3a37604b" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/crate-damaged.png", bytes: 1_133_034, sha256: "57f98eb2d2bbfff2cce0ab69077b590108e3f78bd6b79eac21ec1566b44f78bc" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/cover-idle.png", bytes: 959_727, sha256: "cd5e88e2d69a1ac8e7c07c1727d1e66261e004751b7a58caef9adba017e6a702" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/cover-damaged.png", bytes: 953_600, sha256: "42f8c10f4e87a5126dc761bd65d57bae0b0b9160921b849b69da708ef217fedf" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/bounce-wall-idle.png", bytes: 627_278, sha256: "dd79abe08f15a134d6fad2930bc1ebebb2aad2dd31fef4c9ea4aac7e7f799af3" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/bounce-wall-active.png", bytes: 678_582, sha256: "e003b09e5e8b5cc7f9268f14a322bb837947453ddaab1b5247f9f99918ccf8cf" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/teleporter-idle.png", bytes: 903_908, sha256: "5fbbd527fb433b33229a2e1818f7bf5a961ca9a095e01e925bd4b2bfa4aef662" }),
    Object.freeze({ path: "public/assets/source/product-v1-map-objects/teleporter-active.png", bytes: 1_039_627, sha256: "56fdfdaa1e77dbbaa733c3b03e732da6e78b8152bcb495c7f395aa8882d50d16" })
  ])
});

const STATES_BY_FAMILY: Readonly<Record<WorldObjectFamily, readonly ProductWorldObjectState[]>> = Object.freeze({
  barrel: Object.freeze(["idle", "damaged"] as const),
  mine: Object.freeze(["idle", "armed"] as const),
  crate: Object.freeze(["idle", "damaged"] as const),
  cover: Object.freeze(["idle", "damaged"] as const),
  "bounce-wall": Object.freeze(["idle", "active"] as const),
  teleporter: Object.freeze(["idle", "active"] as const)
});

export interface WorldObjectPresentationLayout {
  readonly originX: number;
  readonly originY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly displayScale: number;
  readonly depth: number;
  readonly rotationPolicy: WorldObjectRotationPolicy;
}

export interface WorldObjectSkinDefinition {
  readonly id: WorldObjectSkinId;
  readonly label: string;
  readonly fallbackId: "legacy";
  readonly atlas: null | {
    readonly textureKey: string;
    readonly imagePath: string;
    readonly jsonPath: string;
    readonly imageSha256: string;
    readonly jsonSha256: string;
    readonly pixelSha256: string;
  };
  readonly layouts: Readonly<Record<WorldObjectFamily, WorldObjectPresentationLayout>>;
}

const LAYOUTS: Readonly<Record<WorldObjectFamily, WorldObjectPresentationLayout>> = Object.freeze({
  barrel: Object.freeze({ originX: 0.5, originY: 0.56, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "none" }),
  mine: Object.freeze({ originX: 0.5, originY: 0.5, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "none" }),
  crate: Object.freeze({ originX: 0.5, originY: 0.54, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "none" }),
  cover: Object.freeze({ originX: 0.5, originY: 0.55, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "none" }),
  "bounce-wall": Object.freeze({ originX: 0.5, originY: 0.55, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "anchor" }),
  teleporter: Object.freeze({ originX: 0.5, originY: 0.5, offsetX: 0, offsetY: 0, displayScale: 0.25, depth: 4, rotationPolicy: "none" })
});

export const WORLD_OBJECT_SKIN_DEFINITIONS: Readonly<Record<WorldObjectSkinId, WorldObjectSkinDefinition>> = Object.freeze({
  legacy: Object.freeze({ id: "legacy", label: "Legacy tactical objects", fallbackId: "legacy", atlas: null, layouts: LAYOUTS }),
  "product-v1": Object.freeze({
    id: "product-v1",
    label: "Foundry product objects",
    fallbackId: "legacy",
    atlas: Object.freeze({
      textureKey: WORLD_OBJECT_ATLAS_TEXTURE_KEY,
      imagePath: WORLD_OBJECT_ATLAS_IMAGE_RUNTIME_PATH,
      jsonPath: WORLD_OBJECT_ATLAS_JSON_RUNTIME_PATH,
      imageSha256: PINNED_RELEASE.imageSha256,
      jsonSha256: PINNED_RELEASE.jsonSha256,
      pixelSha256: PINNED_RELEASE.pixelSha256
    }),
    layouts: LAYOUTS
  })
});

export interface WorldObjectVisualStateInput {
  readonly family: WorldObjectFamily;
  readonly active: boolean;
  readonly hp: number;
  readonly maxHp?: number;
  readonly now: number;
  readonly armedAt?: number;
  readonly reflectionsRemaining?: number;
  readonly cooldownUntil?: number;
}

export interface WorldObjectAtlasFrameRecord {
  readonly key: string;
  readonly family: WorldObjectFamily;
  readonly state: ProductWorldObjectState;
  readonly index: number;
}

export interface WorldObjectAtlasManifest {
  readonly schemaVersion: "1.0.0";
  readonly skinId: "product-v1";
  readonly targetFrame: { readonly path: string; readonly bytes: number; readonly sha256: string };
  readonly generator: {
    readonly id: string;
    readonly generatedAt: string;
    readonly sharpVersion: string;
    readonly scriptSha256: string;
  };
  readonly sources: readonly { readonly path: string; readonly bytes: number; readonly sha256: string }[];
  readonly frames: readonly WorldObjectAtlasFrameRecord[];
  readonly atlas: {
    readonly textureKey: string;
    readonly imagePath: string;
    readonly jsonPath: string;
    readonly width: number;
    readonly height: number;
    readonly imageSha256: string;
    readonly jsonSha256: string;
    readonly pixelSha256: string;
    readonly transferBytes: number;
    readonly jsonTransferBytes: number;
  };
  readonly budgets: {
    readonly transferBytes: number;
    readonly transferLimitBytes: number;
    readonly gpuRgbaBytes: number;
    readonly gpuRgbaLimitBytes: number;
    readonly mipmaps: false;
  };
}

export interface WorldObjectAtlasAvailability {
  readonly textureKey: string;
  readonly width: number;
  readonly height: number;
  readonly frameKeys: readonly string[];
}

export interface WorldObjectSkinRuntimeResolution {
  readonly requestedSkinId: WorldObjectSkinId;
  readonly effectiveSkinId: WorldObjectSkinId;
  readonly definition: WorldObjectSkinDefinition;
  readonly fallbackReason: string | null;
  readonly atlasActive: boolean;
}

export function getWorldObjectSkinDefinition(requestedId: string | null | undefined): WorldObjectSkinDefinition {
  return requestedId?.trim().toLowerCase() === "product-v1"
    ? WORLD_OBJECT_SKIN_DEFINITIONS["product-v1"]
    : WORLD_OBJECT_SKIN_DEFINITIONS.legacy;
}

export function resolveWorldObjectSkinFromSearch(search: string): WorldObjectSkinDefinition {
  const parameters = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return getWorldObjectSkinDefinition(parameters.get("worldSkin"));
}

export function getWorldObjectFrameKey(
  family: WorldObjectFamily,
  state: ProductWorldObjectState
): string {
  if (!STATES_BY_FAMILY[family].includes(state)) return `world/product-v1/${family}/idle`;
  return `world/product-v1/${family}/${state}`;
}

export function createExpectedWorldObjectFrames(): readonly WorldObjectAtlasFrameRecord[] {
  const frames: WorldObjectAtlasFrameRecord[] = [];
  for (const family of WORLD_OBJECT_FAMILIES) {
    for (const state of STATES_BY_FAMILY[family]) {
      frames.push({ key: getWorldObjectFrameKey(family, state), family, state, index: frames.length });
    }
  }
  return Object.freeze(frames);
}

export function resolveWorldObjectVisualState(input: WorldObjectVisualStateInput): ProductWorldObjectState {
  if (input.family === "mine") {
    return input.active && input.now >= (input.armedAt ?? Number.POSITIVE_INFINITY) ? "armed" : "idle";
  }
  if (input.family === "bounce-wall") {
    return input.active && (input.reflectionsRemaining ?? 0) > 0 ? "active" : "idle";
  }
  if (input.family === "teleporter") {
    return input.active && input.now >= (input.cooldownUntil ?? 0) ? "active" : "idle";
  }
  if (!input.active) return "damaged";
  return input.maxHp !== undefined && input.hp < input.maxHp ? "damaged" : "idle";
}

export function resolveWorldObjectSkinForRuntime(
  requested: WorldObjectSkinDefinition,
  manifestInput: unknown,
  availability: WorldObjectAtlasAvailability | null
): WorldObjectSkinRuntimeResolution {
  if (requested.id === "legacy") return legacyResolution("legacy", null);
  const reason = validateManifest(manifestInput);
  if (reason !== null) return legacyResolution(requested.id, reason);
  if (availability === null) return legacyResolution(requested.id, "product atlas is unavailable");
  if (availability.textureKey !== WORLD_OBJECT_ATLAS_TEXTURE_KEY) return legacyResolution(requested.id, "product atlas texture key mismatch");
  if (availability.width !== WORLD_OBJECT_ATLAS_WIDTH || availability.height !== WORLD_OBJECT_ATLAS_HEIGHT) {
    return legacyResolution(requested.id, "product atlas dimensions mismatch");
  }
  const expectedKeys = createExpectedWorldObjectFrames().map((frame) => frame.key);
  if (availability.frameKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !availability.frameKeys.includes(key))) {
    return legacyResolution(requested.id, "product atlas frames are incomplete");
  }
  return {
    requestedSkinId: requested.id,
    effectiveSkinId: requested.id,
    definition: requested,
    fallbackReason: null,
    atlasActive: true
  };
}

function validateManifest(input: unknown): string | null {
  if (!isRecord(input)) return "manifest is not an object";
  if (input.schemaVersion !== "1.0.0" || input.skinId !== "product-v1") return "manifest identity mismatch";
  if (!Array.isArray(input.frames)) return "manifest frames are missing";
  const expected = createExpectedWorldObjectFrames();
  if (input.frames.length !== expected.length) return "manifest frame count mismatch";
  for (let index = 0; index < expected.length; index += 1) {
    const actual = input.frames[index];
    const wanted = expected[index];
    if (!isRecord(actual) || actual.key !== wanted.key || actual.family !== wanted.family ||
      actual.state !== wanted.state || actual.index !== wanted.index) return `manifest frame order mismatch at ${index}`;
  }
  if (!isRecord(input.atlas)) return "manifest atlas is missing";
  const atlas = input.atlas;
  if (atlas.textureKey !== WORLD_OBJECT_ATLAS_TEXTURE_KEY || atlas.imagePath !== "map-objects.webp" ||
    atlas.jsonPath !== "map-objects.json" || atlas.width !== WORLD_OBJECT_ATLAS_WIDTH ||
    atlas.height !== WORLD_OBJECT_ATLAS_HEIGHT || atlas.imageSha256 !== PINNED_RELEASE.imageSha256 ||
    atlas.jsonSha256 !== PINNED_RELEASE.jsonSha256 || atlas.pixelSha256 !== PINNED_RELEASE.pixelSha256 ||
    atlas.transferBytes !== PINNED_RELEASE.imageBytes || atlas.jsonTransferBytes !== PINNED_RELEASE.jsonBytes) {
    return "manifest atlas record mismatch";
  }
  if (!isRecord(input.targetFrame) || input.targetFrame.path !== PINNED_PROVENANCE.targetFramePath ||
    input.targetFrame.bytes !== PINNED_RELEASE.targetFrameBytes ||
    input.targetFrame.sha256 !== PINNED_RELEASE.targetFrameSha256) return "manifest target-frame record mismatch";
  if (!isRecord(input.generator) || input.generator.id !== PINNED_PROVENANCE.generator.id ||
    input.generator.generatedAt !== PINNED_PROVENANCE.generator.generatedAt ||
    input.generator.sharpVersion !== PINNED_PROVENANCE.generator.sharpVersion ||
    input.generator.scriptSha256 !== PINNED_PROVENANCE.generator.scriptSha256) {
    return "manifest generator record mismatch";
  }
  if (!Array.isArray(input.sources) || input.sources.length !== PINNED_PROVENANCE.sources.length) {
    return "manifest source record count mismatch";
  }
  for (let index = 0; index < PINNED_PROVENANCE.sources.length; index += 1) {
    const actual = input.sources[index];
    const wanted = PINNED_PROVENANCE.sources[index];
    if (!isRecord(actual) || actual.path !== wanted.path || actual.bytes !== wanted.bytes ||
      actual.sha256 !== wanted.sha256) return `manifest source record mismatch at ${index}`;
  }
  if (!isRecord(input.budgets)) return "manifest budgets are missing";
  const budgets = input.budgets;
  if (budgets.transferBytes !== PINNED_RELEASE.totalTransferBytes ||
    budgets.transferLimitBytes !== WORLD_OBJECT_ATLAS_TRANSFER_LIMIT_BYTES ||
    budgets.gpuRgbaBytes !== WORLD_OBJECT_ATLAS_WIDTH * WORLD_OBJECT_ATLAS_HEIGHT * 4 ||
    budgets.gpuRgbaLimitBytes !== WORLD_OBJECT_ATLAS_GPU_LIMIT_BYTES || budgets.mipmaps !== false) {
    return "manifest budget record mismatch";
  }
  if ((budgets.transferBytes as number) > WORLD_OBJECT_ATLAS_TRANSFER_LIMIT_BYTES ||
    (budgets.gpuRgbaBytes as number) > WORLD_OBJECT_ATLAS_GPU_LIMIT_BYTES) return "manifest budget exceeded";
  return null;
}

function legacyResolution(requestedSkinId: WorldObjectSkinId, fallbackReason: string | null): WorldObjectSkinRuntimeResolution {
  return {
    requestedSkinId,
    effectiveSkinId: "legacy",
    definition: WORLD_OBJECT_SKIN_DEFINITIONS.legacy,
    fallbackReason,
    atlasActive: false
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
