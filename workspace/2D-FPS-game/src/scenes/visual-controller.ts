import Phaser from "phaser";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import {
  getActorAnimationFrameKeys,
  getActorAnimationKey,
  getActorSkinDefinition,
  getActorTeamTexture,
  isAnimatedActorSkin,
  isArcadeActorSkin,
  resolveActorAnimationState,
  resolveActorPresentationDirection,
  type ActorAnimationState,
  type ActorDirection,
  type ActorSkinDefinition,
  type ActorSkinId,
  type ActorWeaponLayerPolicy
} from "../domain/visual/ActorSkinCatalog";
import { getDummyVisualState, getPlayerVisualState, type RespawnFxState } from "../ui/scene-visuals";
import type { SceneRuntimeState } from "./scene-runtime-state";
import { getArcadeBlasterTexture } from "./arcade-actor-art";
import {
  DUMMY_WEAPON_SCALE,
  GROUND_TURRET_CARBINE_BLUE_KEY,
  GROUND_TURRET_CARBINE_RED_KEY,
  GROUND_TURRET_SCATTER_BLUE_KEY,
  GROUND_TURRET_SCATTER_RED_KEY,
  PLAYER_WEAPON_SCALE,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MAX_Y,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MIN_Y,
} from "./scene-constants";

const ANIMATION_COMPLETE_EVENT = "animationcomplete";
type ActorOneShotState = Extract<ActorAnimationState, "fire" | "hit">;

export interface VisualControllerDeps {
  readonly getActiveWeaponId: () => string;
  readonly getRespawnFxState: (now: number) => RespawnFxState;
  readonly isCombatLive: (now: number) => boolean;
  readonly isPlayerHit: (now: number) => boolean;
  readonly isDummyHit: (now: number) => boolean;
}

export interface VisualControllerSelection {
  readonly requestedSkinId: ActorSkinId;
  readonly fallbackReason: string | null;
}

export interface AnimatedActorOverlays {
  readonly player: Phaser.GameObjects.Sprite | null;
  readonly dummy: Phaser.GameObjects.Sprite | null;
}

export interface ActorPresentationDebugState {
  readonly requestedSkinId: ActorSkinId;
  readonly skinId: ActorSkinId;
  readonly fallbackReason: string | null;
  readonly atlasActive: boolean;
  readonly weaponLayer: ActorWeaponLayerPolicy;
  readonly playerState: ActorAnimationState;
  readonly dummyState: ActorAnimationState;
  readonly playerDirection: ActorDirection;
  readonly dummyDirection: ActorDirection;
  readonly playerAnimationKey: string | null;
  readonly dummyAnimationKey: string | null;
  readonly playerFrameName: string | number | null;
  readonly dummyFrameName: string | number | null;
  readonly playerTextureKey: string | null;
  readonly dummyTextureKey: string | null;
  readonly playerWeaponVisible: boolean;
  readonly dummyWeaponVisible: boolean;
  readonly playerWeaponRotation: number | null;
  readonly dummyWeaponRotation: number | null;
  readonly destroyed: boolean;
}

export class VisualController {
  private scene: Phaser.Scene | null;
  private overlays: AnimatedActorOverlays;
  private playerAnimationState: ActorAnimationState = "idle";
  private dummyAnimationState: ActorAnimationState = "idle";
  private playerDirection: ActorDirection = "east";
  private dummyDirection: ActorDirection = "east";
  private playerAnimationKey: string | null = null;
  private dummyAnimationKey: string | null = null;
  private playerOneShotState: ActorOneShotState | null = null;
  private dummyOneShotState: ActorOneShotState | null = null;
  private playerOneShotDirection: ActorDirection | null = null;
  private dummyOneShotDirection: ActorDirection | null = null;
  private initialized = false;
  private destroyed = false;

  private readonly onPlayerAnimationComplete = (animation: Phaser.Animations.Animation): void => {
    if (animation.key !== this.playerAnimationKey || this.playerOneShotState === null) return;
    this.playerOneShotState = null;
    this.playerOneShotDirection = null;
    this.playerAnimationKey = null;
  };

  private readonly onDummyAnimationComplete = (animation: Phaser.Animations.Animation): void => {
    if (animation.key !== this.dummyAnimationKey || this.dummyOneShotState === null) return;
    this.dummyOneShotState = null;
    this.dummyOneShotDirection = null;
    this.dummyAnimationKey = null;
  };

  public constructor(
    scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly skinDefinition: ActorSkinDefinition,
    private readonly deps: VisualControllerDeps,
    private readonly selection: VisualControllerSelection = {
      requestedSkinId: skinDefinition.id,
      fallbackReason: null
    },
    overlays: AnimatedActorOverlays = { player: null, dummy: null }
  ) {
    this.scene = scene;
    this.overlays = overlays;
  }

  public initializeActorPresentation(): void {
    if (this.initialized || this.destroyed) return;
    this.initialized = true;
    this.overlays.player?.on(ANIMATION_COMPLETE_EVENT, this.onPlayerAnimationComplete);
    this.overlays.dummy?.on(ANIMATION_COMPLETE_EVENT, this.onDummyAnimationComplete);
    this.applyTeamVisuals(this.state.currentPlayerTeam, this.state.currentDummyTeam);
    this.applyWeaponLayerVisibility();
  }

  public updateDummyVisuals(now: number): void {
    const targetDummy = this.state.targetDummy;
    if (targetDummy === undefined || this.destroyed) return;

    const isHit = this.deps.isDummyHit(now);
    const visual = getDummyVisualState({
      isDead: this.state.dummyLogic.isDead(),
      healthRatio: this.state.dummyLogic.state.health / this.state.dummyLogic.state.maxHealth,
      decision: this.state.lastDummyDecision === "avoid-hazard" ? "avoid-hazard" : this.state.lastDummyDecision,
      respawnFxScale: this.deps.getRespawnFxState(now).scale
    });
    const requestedState = resolveActorAnimationState({
      isDead: this.state.dummyLogic.isDead(),
      isHit,
      isFiring: this.state.lastDummyShouldFire,
      isMoving: this.state.dummyLogic.state.lastAppliedSpeed > 0
    });

    this.dummyAnimationState = holdActiveOneShot(
      requestedState,
      this.overlays.dummy === null ? null : this.dummyOneShotState
    );
    const resolvedDirection = resolveActorPresentationDirection(
      this.dummyAnimationState,
      this.state.dummyBodyAngle,
      this.state.dummyLogic.state.aimAngleRadians
    );
    this.dummyDirection = resolveLatchedOneShotDirection(
      this.dummyAnimationState,
      this.dummyOneShotState,
      this.dummyOneShotDirection,
      resolvedDirection
    );
    this.dummyAnimationKey = this.playActorAnimation(
      this.overlays.dummy,
      this.state.currentDummyTeam,
      this.dummyAnimationState,
      this.dummyDirection,
      this.dummyAnimationKey
    );
    this.dummyOneShotState = this.overlays.dummy === null
      ? null
      : updateOneShotState(this.dummyAnimationState, this.dummyOneShotState);
    this.dummyOneShotDirection = this.dummyOneShotState === null ? null : this.dummyDirection;
    this.applyActorVisual(
      targetDummy,
      this.overlays.dummy,
      isHit ? 0xff6a6a : visual.tint,
      visual.alpha,
      visual.scale
    );
  }

  public updateWeaponVisuals(): void {
    const playerSprite = this.state.playerSprite;
    const targetDummy = this.state.targetDummy;
    const playerWeaponSprite = this.state.playerWeaponSprite;
    const dummyWeaponSprite = this.state.dummyWeaponSprite;
    if (
      this.destroyed ||
      playerSprite === undefined ||
      targetDummy === undefined ||
      playerWeaponSprite === undefined ||
      dummyWeaponSprite === undefined
    ) return;

    this.applyWeaponLayerVisibility();
    if (this.skinDefinition.weaponLayer === "embedded") return;

    const playerAngle = this.state.playerLogic.state.aimAngleRadians;
    const dummyAngle = this.state.dummyLogic.state.aimAngleRadians;
    const playerWeaponTexture = this.getWeaponTurretTexture(this.state.currentPlayerTeam, this.deps.getActiveWeaponId());
    const dummyWeaponTexture = this.getWeaponTurretTexture(this.state.currentDummyTeam, this.state.currentDummyWeaponId);

    if (playerWeaponSprite.texture.key !== playerWeaponTexture) playerWeaponSprite.setTexture(playerWeaponTexture, 0);
    if (dummyWeaponSprite.texture.key !== dummyWeaponTexture) dummyWeaponSprite.setTexture(dummyWeaponTexture, 0);
    if (!playerWeaponSprite.anims.isPlaying) playerWeaponSprite.setFrame(0);
    if (!dummyWeaponSprite.anims.isPlaying) dummyWeaponSprite.setFrame(0);

    if (isArcadeActorSkin(this.skinDefinition)) {
      this.positionArcadeBlaster(playerWeaponSprite, playerSprite, this.overlays.player, playerAngle);
      this.positionArcadeBlaster(dummyWeaponSprite, targetDummy, this.overlays.dummy, dummyAngle);
      return;
    }

    playerWeaponSprite
      .setPosition(playerSprite.x, playerSprite.y)
      .setRotation(this.getWeaponRotation(playerAngle))
      .setScale(PLAYER_WEAPON_SCALE * playerSprite.scaleX)
      .setAlpha(this.overlays.player?.alpha ?? playerSprite.alpha);

    dummyWeaponSprite
      .setPosition(targetDummy.x, targetDummy.y)
      .setRotation(this.getWeaponRotation(dummyAngle))
      .setScale(DUMMY_WEAPON_SCALE * targetDummy.scaleX)
      .setAlpha(this.overlays.dummy?.alpha ?? targetDummy.alpha);
  }

  public updatePlayerVisuals(now: number): void {
    const playerSprite = this.state.playerSprite;
    if (playerSprite === undefined || this.destroyed) return;

    const isHit = this.deps.isPlayerHit(now);
    const visual = getPlayerVisualState({
      isDead: this.state.playerLogic.isDead(),
      isStunned: this.state.playerLogic.isStunned(now),
      isSprinting: this.state.playerLogic.state.isSprinting,
      muzzleFlashActive: now < this.state.muzzleFlashUntilMs,
      respawnFx: this.deps.getRespawnFxState(now)
    });
    const requestedState = resolveActorAnimationState({
      isDead: this.state.playerLogic.isDead(),
      isHit,
      isFiring: now < this.state.muzzleFlashUntilMs,
      isMoving: this.state.playerLogic.state.lastAppliedSpeed > 0
    });

    this.playerAnimationState = holdActiveOneShot(
      requestedState,
      this.overlays.player === null ? null : this.playerOneShotState
    );
    const resolvedDirection = resolveActorPresentationDirection(
      this.playerAnimationState,
      this.state.playerBodyAngle,
      this.state.playerLogic.state.aimAngleRadians
    );
    this.playerDirection = resolveLatchedOneShotDirection(
      this.playerAnimationState,
      this.playerOneShotState,
      this.playerOneShotDirection,
      resolvedDirection
    );
    this.playerAnimationKey = this.playActorAnimation(
      this.overlays.player,
      this.state.currentPlayerTeam,
      this.playerAnimationState,
      this.playerDirection,
      this.playerAnimationKey
    );
    this.playerOneShotState = this.overlays.player === null
      ? null
      : updateOneShotState(this.playerAnimationState, this.playerOneShotState);
    this.playerOneShotDirection = this.playerOneShotState === null ? null : this.playerDirection;
    this.applyActorVisual(
      playerSprite,
      this.overlays.player,
      isHit ? 0xff6a6a : visual.tint,
      visual.alpha,
      visual.scale
    );
  }

  public updateCrosshair(
    now: number,
    crosshairHorizontal: Phaser.GameObjects.Rectangle,
    crosshairVertical: Phaser.GameObjects.Rectangle,
    muzzleFlash: Phaser.GameObjects.Arc
  ): void {
    if (this.scene === null || this.destroyed) return;
    const pointerX = Phaser.Math.Clamp(this.scene.input.activePointer.worldX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const pointerY = Phaser.Math.Clamp(this.scene.input.activePointer.worldY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);
    const canFight =
      this.deps.isCombatLive(now) &&
      !this.state.playerLogic.isDead() &&
      !this.state.playerLogic.isStunned(now);
    const alpha = canFight ? 0.88 : 0.35;
    const color = canFight ? 0xd8f3ff : 0x7a8899;

    crosshairHorizontal.setPosition(pointerX, pointerY).setFillStyle(color, alpha);
    crosshairVertical.setPosition(pointerX, pointerY).setFillStyle(color, alpha);
    muzzleFlash.setVisible(now < this.state.muzzleFlashUntilMs);
  }

  public applyTeamVisuals(playerTeam: TeamId, dummyTeam: TeamId): void {
    if (this.destroyed) return;
    this.state.currentPlayerTeam = playerTeam;
    this.state.currentDummyTeam = dummyTeam;
    const anchorDefinition = this.getGameplayAnchorDefinition();

    if (this.state.playerSprite !== undefined) {
      this.state.playerSprite.setTexture(getActorTeamTexture(anchorDefinition, playerTeam).textureKey);
    }
    if (this.state.targetDummy !== undefined) {
      this.state.targetDummy.setTexture(getActorTeamTexture(anchorDefinition, dummyTeam).textureKey);
    }

    this.playerAnimationKey = this.applyOverlayTeamTexture(
      this.overlays.player,
      playerTeam,
      this.playerAnimationState,
      this.playerDirection
    );
    this.dummyAnimationKey = this.applyOverlayTeamTexture(
      this.overlays.dummy,
      dummyTeam,
      this.dummyAnimationState,
      this.dummyDirection
    );
    this.applyWeaponLayerVisibility();
    this.syncActorOverlays();
  }

  public resetActorVisuals(): void {
    if (this.destroyed) return;
    this.playerAnimationState = "idle";
    this.dummyAnimationState = "idle";
    this.playerOneShotState = null;
    this.dummyOneShotState = null;
    this.playerOneShotDirection = null;
    this.dummyOneShotDirection = null;
    this.playerDirection = resolveActorPresentationDirection("idle", this.state.playerBodyAngle, 0);
    this.dummyDirection = resolveActorPresentationDirection("idle", this.state.dummyBodyAngle, 0);
    this.playerAnimationKey = this.playActorAnimation(
      this.overlays.player,
      this.state.currentPlayerTeam,
      this.playerAnimationState,
      this.playerDirection,
      null
    );
    this.dummyAnimationKey = this.playActorAnimation(
      this.overlays.dummy,
      this.state.currentDummyTeam,
      this.dummyAnimationState,
      this.dummyDirection,
      null
    );
    if (this.state.playerSprite !== undefined) {
      this.applyActorVisual(this.state.playerSprite, this.overlays.player, 0xffffff, 1, 1);
    }
    if (this.state.targetDummy !== undefined) {
      this.applyActorVisual(this.state.targetDummy, this.overlays.dummy, 0xffffff, 1, 1);
    }
  }

  public syncActorOverlays(): void {
    if (this.destroyed) return;
    syncOverlayPosition(this.state.playerSprite, this.overlays.player);
    syncOverlayPosition(this.state.targetDummy, this.overlays.dummy);
  }

  public getWeaponTurretTexture(team: TeamId, weaponId: string): string {
    if (isArcadeActorSkin(this.skinDefinition)) return getArcadeBlasterTexture(team, weaponId);
    const isScatter = weaponId === "scatter";
    if (team === "RED") return isScatter ? GROUND_TURRET_SCATTER_RED_KEY : GROUND_TURRET_CARBINE_RED_KEY;
    return isScatter ? GROUND_TURRET_SCATTER_BLUE_KEY : GROUND_TURRET_CARBINE_BLUE_KEY;
  }

  public getActorRotation(angleRadians: number): number {
    return angleRadians + this.getGameplayAnchorDefinition().rotationOffsetRadians;
  }

  public getDebugState(): ActorPresentationDebugState {
    const atlasActive = isAnimatedActorSkin(this.skinDefinition) &&
      this.overlays.player !== null && this.overlays.dummy !== null;
    const playerPresentation = this.overlays.player ?? this.state.playerSprite;
    const dummyPresentation = this.overlays.dummy ?? this.state.targetDummy;
    return {
      requestedSkinId: this.selection.requestedSkinId,
      skinId: this.skinDefinition.id,
      fallbackReason: this.selection.fallbackReason,
      atlasActive,
      weaponLayer: this.skinDefinition.weaponLayer,
      playerState: this.playerAnimationState,
      dummyState: this.dummyAnimationState,
      playerDirection: this.playerDirection,
      dummyDirection: this.dummyDirection,
      playerAnimationKey: this.playerAnimationKey,
      dummyAnimationKey: this.dummyAnimationKey,
      playerFrameName: playerPresentation?.frame.name ?? null,
      dummyFrameName: dummyPresentation?.frame.name ?? null,
      playerTextureKey: playerPresentation?.texture.key ?? null,
      dummyTextureKey: dummyPresentation?.texture.key ?? null,
      playerWeaponVisible: this.state.playerWeaponSprite?.visible ?? false,
      dummyWeaponVisible: this.state.dummyWeaponSprite?.visible ?? false,
      playerWeaponRotation: this.state.playerWeaponSprite?.rotation ?? null,
      dummyWeaponRotation: this.state.dummyWeaponSprite?.rotation ?? null,
      destroyed: this.destroyed
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.overlays.player?.off(ANIMATION_COMPLETE_EVENT, this.onPlayerAnimationComplete);
    this.overlays.dummy?.off(ANIMATION_COMPLETE_EVENT, this.onDummyAnimationComplete);
    this.overlays.player?.anims?.stop?.();
    this.overlays.dummy?.anims?.stop?.();
    this.overlays.player?.setVisible(false);
    this.overlays.dummy?.setVisible(false);
    this.state.playerWeaponSprite?.setVisible(false);
    this.state.dummyWeaponSprite?.setVisible(false);
    this.scene = null;
  }

  private getGameplayAnchorDefinition(): ActorSkinDefinition {
    return isAnimatedActorSkin(this.skinDefinition)
      ? getActorSkinDefinition("legacy-vehicle")
      : this.skinDefinition;
  }

  private getWeaponRotation(angleRadians: number): number {
    return angleRadians + this.skinDefinition.rotationOffsetRadians;
  }

  private positionArcadeBlaster(
    weapon: Phaser.GameObjects.Sprite,
    anchor: Phaser.GameObjects.Image,
    overlay: Phaser.GameObjects.Sprite | null,
    angle: number
  ): void {
    const visualScale = anchor.scaleX / this.getGameplayAnchorDefinition().bodyScale;
    weapon
      .setPosition(anchor.x + Math.cos(angle) * 9, anchor.y + 9 + Math.sin(angle) * 5)
      .setRotation(this.getWeaponRotation(angle))
      .setScale(0.75 * visualScale)
      .setDepth(Math.sin(angle) < -0.25 ? 4.9 : 6)
      .setAlpha(overlay?.alpha ?? anchor.alpha);
  }

  private applyActorVisual(
    anchor: Phaser.GameObjects.Image,
    overlay: Phaser.GameObjects.Sprite | null,
    tint: number,
    alpha: number,
    visualScale: number
  ): void {
    const anchorScale = this.getGameplayAnchorDefinition().bodyScale * visualScale;
    anchor.setTint(tint).setScale(anchorScale).setAlpha(overlay === null ? alpha : 0);
    if (overlay === null) return;
    const arcade = isArcadeActorSkin(this.skinDefinition);
    overlay
      .setPosition(anchor.x, anchor.y)
      .setRotation(0)
      .setTint(arcade && alpha < 0.5 ? 0xd9e8ff : tint)
      .setAlpha(arcade ? Math.max(0.72, alpha) : alpha)
      .setScale(this.skinDefinition.bodyScale * visualScale);
  }

  private applyOverlayTeamTexture(
    overlay: Phaser.GameObjects.Sprite | null,
    team: TeamId,
    state: ActorAnimationState,
    direction: ActorDirection
  ): string | null {
    if (overlay === null) return null;
    const texture = getActorTeamTexture(this.skinDefinition, team);
    const frame = getActorAnimationFrameKeys(this.skinDefinition, team, state, direction)[0];
    overlay.anims.stop();
    overlay.setTexture(texture.textureKey, frame);
    return this.playActorAnimation(overlay, team, state, direction, null);
  }

  private playActorAnimation(
    sprite: Phaser.GameObjects.Sprite | null,
    team: TeamId,
    state: ActorAnimationState,
    direction: ActorDirection,
    previousKey: string | null
  ): string | null {
    if (sprite === null || this.skinDefinition.animationClips[state].kind !== "atlas") return null;
    const animationKey = getActorAnimationKey(this.skinDefinition, team, state, direction);
    if (animationKey !== previousKey) sprite.play(animationKey);
    return animationKey;
  }

  private applyWeaponLayerVisibility(): void {
    const visible = !this.destroyed && this.skinDefinition.weaponLayer === "external";
    this.state.playerWeaponSprite?.setVisible(visible);
    this.state.dummyWeaponSprite?.setVisible(visible);
  }
}

function holdActiveOneShot(
  requested: ActorAnimationState,
  activeOneShot: ActorOneShotState | null
): ActorAnimationState {
  if (requested === "death" || requested === "hit") return requested;
  return activeOneShot ?? requested;
}

function updateOneShotState(
  state: ActorAnimationState,
  previous: ActorOneShotState | null
): ActorOneShotState | null {
  if (state === "death") return null;
  if (state === "hit" || state === "fire") return state;
  return previous === null ? null : previous;
}

function resolveLatchedOneShotDirection(
  state: ActorAnimationState,
  activeState: ActorOneShotState | null,
  activeDirection: ActorDirection | null,
  resolvedDirection: ActorDirection
): ActorDirection {
  return activeState === state && activeDirection !== null ? activeDirection : resolvedDirection;
}

function syncOverlayPosition(
  anchor: Phaser.GameObjects.Image | undefined,
  overlay: Phaser.GameObjects.Sprite | null
): void {
  if (anchor !== undefined && overlay !== null) overlay.setPosition(anchor.x, anchor.y).setRotation(0);
}
