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
export type ActorSkinId = "legacy-vehicle" | "kenney-infantry";
export type ActorSkinSourceId = "ground-shaker" | "kenney-top-down-shooter";
export type ActorWeaponLayerPolicy = "external" | "embedded";

export interface ActorAnimationClip {
  readonly kind: "static" | "atlas";
  readonly frameKeys: readonly string[];
  readonly frameRate: number;
  readonly repeat: boolean;
}

export interface ActorTeamTexture {
  readonly textureKey: string;
  readonly runtimePath: string;
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

const createStaticClips = (): Readonly<Record<ActorAnimationState, ActorAnimationClip>> => {
  const staticClip = Object.freeze({
    kind: "static" as const,
    frameKeys: Object.freeze(["static"]),
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

const LEGACY_STATIC_CLIPS = createStaticClips();
const INFANTRY_STATIC_CLIPS = createStaticClips();

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
        textureKey: "ground-body-blue",
        runtimePath: "/assets/runtime/sprites/ground-body-blue.png",
        sourcePath: "/assets/source/ground-shaker/ground_shaker_asset/Blue/Bodies/body_tracks.png",
        sourceId: "ground-shaker"
      }),
      RED: Object.freeze({
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
    label: "Kenney infantry contract POC",
    sourceId: "kenney-top-down-shooter",
    fallbackId: "legacy-vehicle",
    bodyScale: 1.12,
    rotationOffsetRadians: 0,
    weaponLayer: "embedded",
    teamTextures: Object.freeze({
      BLUE: Object.freeze({
        textureKey: "actor-infantry-blue",
        runtimePath: "/assets/runtime/sprites/actor-infantry-blue.png",
        sourcePath: "/assets/source/kenney-top-down-shooter/PNG/Soldier 1/soldier1_gun.png",
        sourceId: "kenney-top-down-shooter"
      }),
      RED: Object.freeze({
        textureKey: "actor-infantry-red",
        runtimePath: "/assets/runtime/sprites/actor-infantry-red.png",
        sourcePath: "/assets/source/kenney-top-down-shooter/PNG/Hitman 1/hitman1_gun.png",
        sourceId: "kenney-top-down-shooter"
      })
    }),
    animationClips: INFANTRY_STATIC_CLIPS,
    directions: ACTOR_DIRECTIONS
  })
});

export function getActorSkinDefinition(requestedId: string | null | undefined): ActorSkinDefinition {
  const normalized = requestedId?.trim().toLowerCase();
  return normalized === "kenney-infantry"
    ? ACTOR_SKIN_DEFINITIONS["kenney-infantry"]
    : ACTOR_SKIN_DEFINITIONS["legacy-vehicle"];
}

export function resolveActorSkinFromSearch(search: string): ActorSkinDefinition {
  const query = search.startsWith("?") ? search : `?${search}`;
  return getActorSkinDefinition(new URLSearchParams(query).get("actorSkin"));
}

export function getActorTeamTexture(definition: ActorSkinDefinition, team: TeamId): ActorTeamTexture {
  return definition.teamTextures[team];
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
