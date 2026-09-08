import Phaser from "phaser";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import {
  ACTOR_ANIMATION_STATES,
  ACTOR_ATLAS_MANIFEST_CACHE_KEY,
  ACTOR_ATLAS_MANIFEST_RUNTIME_PATH,
  ACTOR_DIRECTIONS,
  getActorAnimationFrameKeys,
  getActorAnimationKey,
  getActorSkinDefinition,
  getActorTeamTexture,
  isAnimatedActorSkin,
  isArcadeActorSkin,
  resolveActorSkinForRuntime,
  type ActorAtlasAvailability,
  type ActorSkinDefinition,
  type ActorSkinId
} from "../domain/visual/ActorSkinCatalog";
import {
  DUMMY_WEAPON_SCALE,
  GROUND_TURRET_CARBINE_BLUE_KEY,
  GROUND_TURRET_CARBINE_RED_KEY,
  PLAYER_WEAPON_SCALE
} from "./scene-constants";
import type { SceneRuntimeState } from "./scene-runtime-state";
import { ensureArcadeActorTextures, getArcadeBlasterTexture } from "./arcade-actor-art";
import {
  VisualController,
  type AnimatedActorOverlays,
  type VisualControllerDeps
} from "./visual-controller";

export interface ActorPresentationCompositionOptions {
  readonly scene: Phaser.Scene;
  readonly state: SceneRuntimeState;
  readonly requestedSkin: ActorSkinDefinition;
  readonly playerSpawn: Readonly<{ x: number; y: number }>;
  readonly dummySpawn: Readonly<{ x: number; y: number }>;
  readonly controllerDeps: VisualControllerDeps;
}

export interface ActorPresentationRefs {
  readonly playerSprite: Phaser.GameObjects.Image;
  readonly targetDummy: Phaser.GameObjects.Image;
  readonly playerAnimatedSprite: Phaser.GameObjects.Sprite | null;
  readonly dummyAnimatedSprite: Phaser.GameObjects.Sprite | null;
  readonly playerWeaponSprite: Phaser.GameObjects.Sprite;
  readonly dummyWeaponSprite: Phaser.GameObjects.Sprite;
  readonly controller: VisualController;
  readonly activeSkin: ActorSkinDefinition;
}

export function preloadActorPresentationAssets(scene: Phaser.Scene, requestedSkin: ActorSkinDefinition): void {
  if (requestedSkin.id !== "quaternius-animated") return;

  if (!scene.cache.json.has(ACTOR_ATLAS_MANIFEST_CACHE_KEY)) {
    scene.load.json(ACTOR_ATLAS_MANIFEST_CACHE_KEY, ACTOR_ATLAS_MANIFEST_RUNTIME_PATH);
  }

  for (const team of ["BLUE", "RED"] as const) {
    const texture = requestedSkin.teamTextures[team];
    if (!scene.textures.exists(texture.textureKey) && texture.atlasDataPath !== undefined) {
      scene.load.atlas(texture.textureKey, texture.runtimePath, texture.atlasDataPath);
    }
  }
}

export class ActorPresentationComposition {
  public readonly refs: ActorPresentationRefs;
  private readonly state: SceneRuntimeState;
  private destroyed = false;

  public constructor(options: ActorPresentationCompositionOptions) {
    this.state = options.state;
    ensureArcadeActorTextures(options.scene, options.requestedSkin);
    const availability = collectAtlasAvailability(options.scene, options.requestedSkin);
    const resolution = resolveActorSkinForRuntime(
      options.requestedSkin,
      options.scene.cache.json.get(ACTOR_ATLAS_MANIFEST_CACHE_KEY),
      availability
    );
    const activeSkin = resolution.definition;
    ensureActorAnimations(options.scene, activeSkin);

    const anchorSkin = isAnimatedActorSkin(activeSkin)
      ? getActorSkinDefinition("legacy-vehicle")
      : activeSkin;
    const playerSprite = createGameplayAnchor(
      options.scene,
      anchorSkin,
      options.state.currentPlayerTeam,
      options.playerSpawn,
      isAnimatedActorSkin(activeSkin)
    );
    const targetDummy = createGameplayAnchor(
      options.scene,
      anchorSkin,
      options.state.currentDummyTeam,
      options.dummySpawn,
      isAnimatedActorSkin(activeSkin)
    );
    const overlays = createAnimatedActorOverlays(options.scene, activeSkin, options);
    const playerWeaponSprite = createWeaponSprite(
      options.scene,
      playerSprite,
      isArcadeActorSkin(activeSkin) ? getArcadeBlasterTexture(options.state.currentPlayerTeam, "carbine") : GROUND_TURRET_CARBINE_BLUE_KEY,
      isArcadeActorSkin(activeSkin) ? 0.75 : PLAYER_WEAPON_SCALE
    );
    const dummyWeaponSprite = createWeaponSprite(
      options.scene,
      targetDummy,
      isArcadeActorSkin(activeSkin) ? getArcadeBlasterTexture(options.state.currentDummyTeam, "carbine") : GROUND_TURRET_CARBINE_RED_KEY,
      isArcadeActorSkin(activeSkin) ? 0.75 : DUMMY_WEAPON_SCALE
    );

    options.state.playerSprite = playerSprite;
    options.state.targetDummy = targetDummy;
    options.state.playerWeaponSprite = playerWeaponSprite;
    options.state.dummyWeaponSprite = dummyWeaponSprite;

    const controller = new VisualController(
      options.scene,
      options.state,
      activeSkin,
      options.controllerDeps,
      {
        requestedSkinId: options.requestedSkin.id,
        fallbackReason: resolution.fallbackReason
      },
      overlays
    );
    controller.initializeActorPresentation();

    this.refs = {
      playerSprite,
      targetDummy,
      playerAnimatedSprite: overlays.player,
      dummyAnimatedSprite: overlays.dummy,
      playerWeaponSprite,
      dummyWeaponSprite,
      controller,
      activeSkin
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.refs.controller.destroy();
    this.refs.playerAnimatedSprite?.destroy();
    this.refs.dummyAnimatedSprite?.destroy();
    this.refs.playerWeaponSprite.destroy();
    this.refs.dummyWeaponSprite.destroy();
    this.refs.playerSprite.destroy();
    this.refs.targetDummy.destroy();

    if (this.state.playerSprite === this.refs.playerSprite) this.state.playerSprite = undefined;
    if (this.state.targetDummy === this.refs.targetDummy) this.state.targetDummy = undefined;
    if (this.state.playerWeaponSprite === this.refs.playerWeaponSprite) this.state.playerWeaponSprite = undefined;
    if (this.state.dummyWeaponSprite === this.refs.dummyWeaponSprite) this.state.dummyWeaponSprite = undefined;
  }
}

function createGameplayAnchor(
  scene: Phaser.Scene,
  definition: ActorSkinDefinition,
  team: TeamId,
  spawn: Readonly<{ x: number; y: number }>,
  hidden: boolean
): Phaser.GameObjects.Image {
  return scene.add
    .image(spawn.x, spawn.y, getActorTeamTexture(definition, team).textureKey)
    .setDepth(5)
    .setScale(definition.bodyScale)
    .setAlpha(hidden ? 0 : 1);
}

function createAnimatedActorOverlays(
  scene: Phaser.Scene,
  definition: ActorSkinDefinition,
  options: ActorPresentationCompositionOptions
): AnimatedActorOverlays {
  if (!isAnimatedActorSkin(definition)) return { player: null, dummy: null };

  return {
    player: createAnimatedActorSprite(scene, definition, options.state.currentPlayerTeam, options.playerSpawn),
    dummy: createAnimatedActorSprite(scene, definition, options.state.currentDummyTeam, options.dummySpawn)
  };
}

function createAnimatedActorSprite(
  scene: Phaser.Scene,
  definition: ActorSkinDefinition,
  team: TeamId,
  spawn: Readonly<{ x: number; y: number }>
): Phaser.GameObjects.Sprite {
  const texture = getActorTeamTexture(definition, team);
  const firstFrame = getActorAnimationFrameKeys(definition, team, "idle", "east")[0];
  return scene.add
    .sprite(spawn.x, spawn.y, texture.textureKey, firstFrame)
    .setDepth(5)
    .setScale(definition.bodyScale);
}

function createWeaponSprite(
  scene: Phaser.Scene,
  actor: Phaser.GameObjects.Image,
  textureKey: string,
  scale: number
): Phaser.GameObjects.Sprite {
  return scene.add
    .sprite(actor.x, actor.y, textureKey, 0)
    .setDepth(6)
    .setOrigin(0.5, 0.72)
    .setScale(scale);
}

function collectAtlasAvailability(
  scene: Phaser.Scene,
  requestedSkin: ActorSkinDefinition
): readonly ActorAtlasAvailability[] {
  if (!isAnimatedActorSkin(requestedSkin)) return [];

  const availability: ActorAtlasAvailability[] = [];
  for (const team of ["BLUE", "RED"] as const) {
    const descriptor = requestedSkin.teamTextures[team];
    if (!scene.textures.exists(descriptor.textureKey)) continue;
    const texture = scene.textures.get(descriptor.textureKey);
    const source = texture.getSourceImage() as { width?: number; height?: number } | undefined;
    availability.push({
      team,
      textureKey: descriptor.textureKey,
      width: source?.width ?? 0,
      height: source?.height ?? 0,
      frameKeys: texture.getFrameNames().filter((key) => key !== "__BASE")
    });
  }
  return availability;
}

function ensureActorAnimations(scene: Phaser.Scene, definition: ActorSkinDefinition): void {
  if (!isAnimatedActorSkin(definition)) return;

  for (const team of ["BLUE", "RED"] as const) {
    const texture = getActorTeamTexture(definition, team);
    for (const state of ACTOR_ANIMATION_STATES) {
      const clip = definition.animationClips[state];
      for (const direction of ACTOR_DIRECTIONS) {
        const animationKey = getActorAnimationKey(definition, team, state, direction);
        if (scene.anims.exists(animationKey)) continue;
        scene.anims.create({
          key: animationKey,
          frames: getActorAnimationFrameKeys(definition, team, state, direction).map((frame) => ({
            key: texture.textureKey,
            frame
          })),
          frameRate: clip.frameRate,
          repeat: clip.repeat ? -1 : 0
        });
      }
    }
  }
}

export type { ActorSkinId };
