import type { TeamId } from "../round/MatchFlowLogic";

export const ACTOR_ANIMATION_STATES = Object.freeze([
  "idle",
  "run",
  "fire",
  "hit",
  "death"
] as const);

export type ActorAnimationState = (typeof ACTOR_ANIMATION_STATES)[number];

export const ACTOR_DIRECTIONS = Object.freeze([
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east"
] as const);

export type ActorDirection = (typeof ACTOR_DIRECTIONS)[number];
export type ActorSkinId = "legacy-vehicle" | "kenney-infantry" | "quaternius-animated";
export type ActorSkinSourceId =
  | "ground-shaker"
  | "kenney-top-down-shooter"
  | "quaternius-universal-core";
export type ActorWeaponLayerPolicy = "external" | "embedded";

export const ACTOR_ATLAS_MANIFEST_CACHE_KEY = "actor-atlas-manifest";
export const ACTOR_ATLAS_MANIFEST_RUNTIME_PATH = "/assets/runtime/actors/manifest.json";
export const ACTOR_ATLAS_WIDTH = 2048;
export const ACTOR_ATLAS_HEIGHT = 2048;
export const ACTOR_ATLAS_TRANSFER_LIMIT_BYTES = 8 * 1024 * 1024;
export const ACTOR_ATLAS_GPU_LIMIT_BYTES = 32 * 1024 * 1024;
export const ACTOR_ATLAS_FRAMES_PER_TEAM = 176;

export interface ActorAnimationClip {
  readonly kind: "static" | "atlas";
  readonly framesPerDirection: number;
  readonly frameRate: number;
  readonly repeat: boolean;
}

export interface ActorTeamTexture {
  readonly kind: "image" | "atlas";
  readonly textureKey: string;
  readonly runtimePath: string;
  readonly atlasDataPath?: string;
  readonly sourcePath: string;
  readonly sourceId: ActorSkinSourceId;
}

export interface ActorSkinDefinition {
  readonly id: ActorSkinId;
  readonly label: string;
  readonly sourceId: ActorSkinSourceId;
  readonly fallbackId: "legacy-vehicle";
  readonly bodyScale: number;
  readonly rotationOffsetRadians: number;
  readonly weaponLayer: ActorWeaponLayerPolicy;
  readonly teamTextures: Readonly<Record<TeamId, ActorTeamTexture>>;
  readonly animationClips: Readonly<Record<ActorAnimationState, ActorAnimationClip>>;
  readonly directions: readonly ActorDirection[];
}

export interface ActorAnimationInput {
  readonly isDead: boolean;
  readonly isHit: boolean;
  readonly isFiring: boolean;
  readonly isMoving: boolean;
}

export interface ActorAtlasFrameRecord {
  readonly key: string;
  readonly team: TeamId;
  readonly state: ActorAnimationState;
  readonly direction: ActorDirection;
  readonly index: number;
}

export interface ActorAtlasManifest {
  readonly schemaVersion: "1.0.0";
  readonly frames: readonly ActorAtlasFrameRecord[];
  readonly atlases: readonly {
    readonly team: TeamId;
    readonly imagePath: string;
    readonly jsonPath: string;
    readonly transferBytes: number;
  }[];
  readonly budgets: {
    readonly transferBytes: number;
    readonly transferLimitBytes: number;
    readonly gpuRgbaBytes: number;
    readonly gpuRgbaLimitBytes: number;
    readonly mipmaps: false;
  };
}

export interface ActorAtlasAvailability {
  readonly team: TeamId;
  readonly textureKey: string;
  readonly width: number;
  readonly height: number;
  readonly frameKeys: readonly string[];
}

export interface ActorSkinRuntimeResolution {
  readonly definition: ActorSkinDefinition;
  readonly fallbackReason: string | null;
}

export interface ActorAtlasValidationResult {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly manifest: ActorAtlasManifest | null;
}

const createStaticClips = (): Readonly<Record<ActorAnimationState, ActorAnimationClip>> => {
  const staticClip = Object.freeze({
    kind: "static" as const,
    framesPerDirection: 1,
    frameRate: 0,
    repeat: false
  });

  return Object.freeze({
    idle: staticClip,
    run: staticClip,
    fire: staticClip,
    hit: staticClip,
    death: staticClip
  });
};

const createAnimatedClips = (): Readonly<Record<ActorAnimationState, ActorAnimationClip>> => Object.freeze({
  idle: Object.freeze({ kind: "atlas", framesPerDirection: 4, frameRate: 6, repeat: true }),
  run: Object.freeze({ kind: "atlas", framesPerDirection: 6, frameRate: 12, repeat: true }),
  fire: Object.freeze({ kind: "atlas", framesPerDirection: 4, frameRate: 12, repeat: false }),
  hit: Object.freeze({ kind: "atlas", framesPerDirection: 2, frameRate: 12, repeat: false }),
  death: Object.freeze({ kind: "atlas", framesPerDirection: 6, frameRate: 8, repeat: false })
});

const LEGACY_STATIC_CLIPS = createStaticClips();
const INFANTRY_STATIC_CLIPS = createStaticClips();
const QUATERNIUS_ANIMATED_CLIPS = createAnimatedClips();

export const ACTOR_SKIN_DEFINITIONS: Readonly<Record<ActorSkinId, ActorSkinDefinition>> = Object.freeze({
  "legacy-vehicle": Object.freeze({
    id: "legacy-vehicle",
    label: "Ground Shaker vehicle",
    sourceId: "ground-shaker",
    fallbackId: "legacy-vehicle",
    bodyScale: 0.42,
    rotationOffsetRadians: Math.PI / 2,
    weaponLayer: "external",
    teamTextures: Object.freeze({
      BLUE: Object.freeze({
        kind: "image",
        textureKey: "ground-body-blue",
        runtimePath: "/assets/runtime/sprites/ground-body-blue.png",
        sourcePath: "/assets/source/ground-shaker/ground_shaker_asset/Blue/Bodies/body_tracks.png",
        sourceId: "ground-shaker"
      }),
      RED: Object.freeze({
        kind: "image",
        textureKey: "ground-body-red",
        runtimePath: "/assets/runtime/sprites/ground-body-red.png",
        sourcePath: "/assets/source/ground-shaker/ground_shaker_asset/Red/Bodies/body_tracks.png",
        sourceId: "ground-shaker"
      })
    }),
    animationClips: LEGACY_STATIC_CLIPS,
    directions: ACTOR_DIRECTIONS
  }),
  "kenney-infantry": Object.freeze({
    id: "kenney-infantry",
    label: "Kenney infantry fallback",
    sourceId: "kenney-top-down-shooter",
    fallbackId: "legacy-vehicle",
    bodyScale: 1.12,
    rotationOffsetRadians: 0,
    weaponLayer: "embedded",
    teamTextures: Object.freeze({
      BLUE: Object.freeze({
        kind: "image",
        textureKey: "actor-infantry-blue",
        runtimePath: "/assets/runtime/sprites/actor-infantry-blue.png",
        sourcePath: "/assets/source/kenney-top-down-shooter/PNG/Soldier 1/soldier1_gun.png",
        sourceId: "kenney-top-down-shooter"
      }),
      RED: Object.freeze({
        kind: "image",
        textureKey: "actor-infantry-red",
        runtimePath: "/assets/runtime/sprites/actor-infantry-red.png",
        sourcePath: "/assets/source/kenney-top-down-shooter/PNG/Hitman 1/hitman1_gun.png",
        sourceId: "kenney-top-down-shooter"
      })
    }),
    animationClips: INFANTRY_STATIC_CLIPS,
    directions: ACTOR_DIRECTIONS
  }),
  "quaternius-animated": Object.freeze({
    id: "quaternius-animated",
    label: "Vanguard animated infantry",
    sourceId: "quaternius-universal-core",
    fallbackId: "legacy-vehicle",
    bodyScale: 0.42,
    rotationOffsetRadians: Math.PI / 2,
    weaponLayer: "external",
    teamTextures: Object.freeze({
      BLUE: Object.freeze({
        kind: "atlas",
        textureKey: "actor-animated-blue",
        runtimePath: "/assets/runtime/actors/actor-blue.webp",
        atlasDataPath: "/assets/runtime/actors/actor-blue.json",
        sourcePath: "/assets/source/quaternius-universal-base-characters/Universal Base Characters[Standard].zip",
        sourceId: "quaternius-universal-core"
      }),
      RED: Object.freeze({
        kind: "atlas",
        textureKey: "actor-animated-red",
        runtimePath: "/assets/runtime/actors/actor-red.webp",
        atlasDataPath: "/assets/runtime/actors/actor-red.json",
        sourcePath: "/assets/source/quaternius-universal-animation-library/Universal Animation Library[Standard].zip",
        sourceId: "quaternius-universal-core"
      })
    }),
    animationClips: QUATERNIUS_ANIMATED_CLIPS,
    directions: ACTOR_DIRECTIONS
  })
});

export function getActorSkinDefinition(requestedId: string | null | undefined): ActorSkinDefinition {
  const normalized = requestedId?.trim().toLowerCase();
  if (normalized === "kenney-infantry" || normalized === "quaternius-animated") {
    return ACTOR_SKIN_DEFINITIONS[normalized];
  }
  return ACTOR_SKIN_DEFINITIONS["legacy-vehicle"];
}

export function resolveActorSkinFromSearch(search: string): ActorSkinDefinition {
  const query = search.startsWith("?") ? search : `?${search}`;
  const parameters = new URLSearchParams(query);
  return parameters.has("actorSkin")
    ? getActorSkinDefinition(parameters.get("actorSkin"))
    : ACTOR_SKIN_DEFINITIONS["quaternius-animated"];
}

export function getActorTeamTexture(definition: ActorSkinDefinition, team: TeamId): ActorTeamTexture {
  return definition.teamTextures[team];
}

export function getActorAnimationFrameKeys(
  definition: ActorSkinDefinition,
  team: TeamId,
  state: ActorAnimationState,
  direction: ActorDirection
): readonly string[] {
  const clip = definition.animationClips[state];
  if (clip.kind === "static") return Object.freeze(["static"]);

  return Object.freeze(Array.from(
    { length: clip.framesPerDirection },
    (_, frame) => `actor/${team.toLowerCase()}/${state}/${direction}/${String(frame).padStart(2, "0")}`
  ));
}

export function getActorAnimationKey(
  definition: ActorSkinDefinition,
  team: TeamId,
  state: ActorAnimationState,
  direction: ActorDirection
): string {
  return `${definition.id}:${team.toLowerCase()}:${state}:${direction}`;
}

export function resolveActorAnimationState(input: ActorAnimationInput): ActorAnimationState {
  if (input.isDead) return "death";
  if (input.isHit) return "hit";
  if (input.isFiring) return "fire";
  if (input.isMoving) return "run";
  return "idle";
}

export function resolveActorDirection(angleRadians: number): ActorDirection {
  if (!Number.isFinite(angleRadians)) return "east";

  const fullTurn = Math.PI * 2;
  const normalized = ((angleRadians % fullTurn) + fullTurn) % fullTurn;
  const octant = Math.round(normalized / (Math.PI / 4)) % ACTOR_DIRECTIONS.length;
  return ACTOR_DIRECTIONS[octant];
}

export function resolveActorPresentationDirection(
  state: ActorAnimationState,
  movementAngleRadians: number,
  aimAngleRadians: number
): ActorDirection {
  return resolveActorDirection(state === "fire" ? aimAngleRadians : movementAngleRadians);
}

export function validateActorAtlasManifest(input: unknown): ActorAtlasValidationResult {
  if (!isRecord(input)) return invalidManifest("manifest is not an object");
  if (input.schemaVersion !== "1.0.0") return invalidManifest("manifest schema version mismatch");
  if (!Array.isArray(input.frames)) return invalidManifest("manifest frames are missing");
  if (!Array.isArray(input.atlases)) return invalidManifest("manifest atlases are missing");
  if (!isRecord(input.budgets)) return invalidManifest("manifest budgets are missing");

  const expectedFrames = createExpectedActorAtlasFrames();
  if (input.frames.length !== expectedFrames.length) return invalidManifest("manifest frame count mismatch");
  for (let index = 0; index < expectedFrames.length; index++) {
    const actual = input.frames[index];
    const expected = expectedFrames[index];
    if (!isRecord(actual) ||
      actual.key !== expected.key ||
      actual.team !== expected.team ||
      actual.state !== expected.state ||
      actual.direction !== expected.direction ||
      actual.index !== expected.index) {
      return invalidManifest(`manifest frame order mismatch at ${index}`);
    }
  }

  if (input.atlases.length !== 2) return invalidManifest("manifest atlas count mismatch");
  const animated = ACTOR_SKIN_DEFINITIONS["quaternius-animated"];
  let atlasTransferBytes = 0;
  for (const [index, team] of (["BLUE", "RED"] as const).entries()) {
    const atlas = input.atlases[index];
    const texture = animated.teamTextures[team];
    if (!isRecord(atlas) ||
      atlas.team !== team ||
      atlas.imagePath !== basename(texture.runtimePath) ||
      atlas.jsonPath !== basename(texture.atlasDataPath ?? "") ||
      !isNonNegativeInteger(atlas.transferBytes)) {
      return invalidManifest(`manifest ${team} atlas mismatch`);
    }
    atlasTransferBytes += atlas.transferBytes;
  }

  const budgets = input.budgets;
  if (!isNonNegativeInteger(budgets.transferBytes) ||
    !isNonNegativeInteger(budgets.transferLimitBytes) ||
    !isNonNegativeInteger(budgets.gpuRgbaBytes) ||
    !isNonNegativeInteger(budgets.gpuRgbaLimitBytes) ||
    budgets.mipmaps !== false) {
    return invalidManifest("manifest budgets are invalid");
  }
  if (budgets.transferLimitBytes !== ACTOR_ATLAS_TRANSFER_LIMIT_BYTES ||
    budgets.transferBytes > budgets.transferLimitBytes ||
    budgets.transferBytes < atlasTransferBytes) {
    return invalidManifest("manifest transfer budget exceeded");
  }
  if (budgets.gpuRgbaLimitBytes !== ACTOR_ATLAS_GPU_LIMIT_BYTES ||
    budgets.gpuRgbaBytes > budgets.gpuRgbaLimitBytes) {
    return invalidManifest("manifest GPU budget exceeded");
  }
  if (budgets.gpuRgbaBytes !== 2 * ACTOR_ATLAS_WIDTH * ACTOR_ATLAS_HEIGHT * 4) {
    return invalidManifest("manifest GPU estimate mismatch");
  }

  return { valid: true, reason: null, manifest: input as unknown as ActorAtlasManifest };
}

export function resolveActorSkinForRuntime(
  requested: ActorSkinDefinition,
  manifestInput: unknown,
  availability: readonly ActorAtlasAvailability[]
): ActorSkinRuntimeResolution {
  if (requested.id !== "quaternius-animated") {
    return { definition: requested, fallbackReason: null };
  }

  const validation = validateActorAtlasManifest(manifestInput);
  if (!validation.valid || validation.manifest === null) {
    return fallbackResolution(validation.reason ?? "animated manifest rejected");
  }

  if (availability.length !== 2) return fallbackResolution("animated atlas availability is incomplete");
  for (const team of ["BLUE", "RED"] as const) {
    const texture = requested.teamTextures[team];
    const loaded = availability.find((item) => item.team === team);
    if (loaded === undefined || loaded.textureKey !== texture.textureKey) {
      return fallbackResolution(`${team} animated atlas is unavailable`);
    }
    if (loaded.width !== ACTOR_ATLAS_WIDTH || loaded.height !== ACTOR_ATLAS_HEIGHT) {
      return fallbackResolution(`${team} animated atlas dimensions mismatch`);
    }
    const expectedFrameKeys = validation.manifest.frames
      .filter((frame) => frame.team === team)
      .map((frame) => frame.key);
    if (loaded.frameKeys.length !== ACTOR_ATLAS_FRAMES_PER_TEAM ||
      expectedFrameKeys.some((key) => !loaded.frameKeys.includes(key))) {
      return fallbackResolution(`${team} animated atlas frames are incomplete`);
    }
  }

  return { definition: requested, fallbackReason: null };
}

export function createExpectedActorAtlasFrames(): readonly ActorAtlasFrameRecord[] {
  const frames: ActorAtlasFrameRecord[] = [];
  const animated = ACTOR_SKIN_DEFINITIONS["quaternius-animated"];
  for (const team of ["BLUE", "RED"] as const) {
    let index = 0;
    for (const state of ACTOR_ANIMATION_STATES) {
      for (const direction of ACTOR_DIRECTIONS) {
        for (const key of getActorAnimationFrameKeys(animated, team, state, direction)) {
          frames.push({ key, team, state, direction, index });
          index++;
        }
      }
    }
  }
  return frames;
}

function fallbackResolution(reason: string): ActorSkinRuntimeResolution {
  return { definition: ACTOR_SKIN_DEFINITIONS["legacy-vehicle"], fallbackReason: reason };
}

function invalidManifest(reason: string): ActorAtlasValidationResult {
  return { valid: false, reason, manifest: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
