import Phaser from "phaser";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import {
  getActorTeamTexture,
  resolveActorAnimationState,
  resolveActorDirection,
  type ActorAnimationState,
  type ActorDirection,
  type ActorSkinDefinition,
  type ActorSkinId,
  type ActorWeaponLayerPolicy
} from "../domain/visual/ActorSkinCatalog";
import { getDummyVisualState, getPlayerVisualState, type RespawnFxState } from "../ui/scene-visuals";
import type { SceneRuntimeState } from "./scene-runtime-state";
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

export interface VisualControllerDeps {
  readonly getActiveWeaponId: () => string;
  readonly getRespawnFxState: (now: number) => RespawnFxState;
  readonly isCombatLive: (now: number) => boolean;
}

export interface ActorPresentationDebugState {
  readonly skinId: ActorSkinId;
  readonly weaponLayer: ActorWeaponLayerPolicy;
  readonly playerState: ActorAnimationState;
  readonly dummyState: ActorAnimationState;
  readonly playerDirection: ActorDirection;
  readonly dummyDirection: ActorDirection;
  readonly playerTextureKey: string | null;
  readonly dummyTextureKey: string | null;
  readonly playerWeaponVisible: boolean;
  readonly dummyWeaponVisible: boolean;
  readonly destroyed: boolean;
}

export class VisualController {
  private playerAnimationState: ActorAnimationState = "idle";
  private dummyAnimationState: ActorAnimationState = "idle";
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly skinDefinition: ActorSkinDefinition,
    private readonly deps: VisualControllerDeps
  ) {}

  public initializeActorPresentation(): void {
    this.destroyed = false;
    this.applyTeamVisuals(this.state.currentPlayerTeam, this.state.currentDummyTeam);
    this.applyWeaponLayerVisibility();
  }

  public updateDummyVisuals(now: number): void {
    const targetDummy = this.state.targetDummy;
    if (targetDummy === undefined) {
      return;
    }

    const visual = getDummyVisualState({
      isDead: this.state.dummyLogic.isDead(),
      healthRatio: this.state.dummyLogic.state.health / this.state.dummyLogic.state.maxHealth,
      decision: this.state.lastDummyDecision === "avoid-hazard" ? "avoid-hazard" : this.state.lastDummyDecision,
      respawnFxScale: this.deps.getRespawnFxState(now).scale
    });

    this.dummyAnimationState = resolveActorAnimationState({
      isDead: this.state.dummyLogic.isDead(),
      isHit: false,
      isFiring: this.state.lastDummyShouldFire,
      isMoving: this.state.dummyLogic.state.lastAppliedSpeed > 0
    });

    targetDummy.setTint(visual.tint);
    targetDummy.setAlpha(visual.alpha);
    targetDummy.setScale(this.skinDefinition.bodyScale * visual.scale);
  }

  public updateWeaponVisuals(): void {
    const playerSprite = this.state.playerSprite;
    const targetDummy = this.state.targetDummy;
    const playerWeaponSprite = this.state.playerWeaponSprite;
    const dummyWeaponSprite = this.state.dummyWeaponSprite;
    if (
      playerSprite === undefined ||
      targetDummy === undefined ||
      playerWeaponSprite === undefined ||
      dummyWeaponSprite === undefined
    ) {
      return;
    }

    this.applyWeaponLayerVisibility();
    if (this.skinDefinition.weaponLayer === "embedded") {
      return;
    }

    const playerAngle = this.state.playerLogic.state.aimAngleRadians;
    const dummyAngle = this.state.dummyLogic.state.aimAngleRadians;
    const playerWeaponTexture = this.getWeaponTurretTexture(this.state.currentPlayerTeam, this.deps.getActiveWeaponId());
    const dummyWeaponTexture = this.getWeaponTurretTexture(this.state.currentDummyTeam, this.state.currentDummyWeaponId);

    if (playerWeaponSprite.texture.key !== playerWeaponTexture) {
      playerWeaponSprite.setTexture(playerWeaponTexture, 0);
    }
    if (dummyWeaponSprite.texture.key !== dummyWeaponTexture) {
      dummyWeaponSprite.setTexture(dummyWeaponTexture, 0);
    }

    if (!playerWeaponSprite.anims.isPlaying) {
      playerWeaponSprite.setFrame(0);
    }
    if (!dummyWeaponSprite.anims.isPlaying) {
      dummyWeaponSprite.setFrame(0);
    }

    playerWeaponSprite
      .setPosition(playerSprite.x, playerSprite.y)
      .setRotation(this.getActorRotation(playerAngle))
      .setScale(PLAYER_WEAPON_SCALE * playerSprite.scaleX)
      .setAlpha(playerSprite.alpha);

    dummyWeaponSprite
      .setPosition(targetDummy.x, targetDummy.y)
      .setRotation(this.getActorRotation(dummyAngle))
      .setScale(DUMMY_WEAPON_SCALE * targetDummy.scaleX)
      .setAlpha(targetDummy.alpha);
  }

  public updatePlayerVisuals(now: number): void {
    const playerSprite = this.state.playerSprite;
    if (playerSprite === undefined) {
      return;
    }

    const visual = getPlayerVisualState({
      isDead: this.state.playerLogic.isDead(),
      isStunned: this.state.playerLogic.isStunned(now),
      isSprinting: this.state.playerLogic.state.isSprinting,
      muzzleFlashActive: now < this.state.muzzleFlashUntilMs,
      respawnFx: this.deps.getRespawnFxState(now)
    });

    this.playerAnimationState = resolveActorAnimationState({
      isDead: this.state.playerLogic.isDead(),
      isHit: this.state.playerLogic.isStunned(now),
      isFiring: now < this.state.muzzleFlashUntilMs,
      isMoving: this.state.playerLogic.state.lastAppliedSpeed > 0
    });

    playerSprite.setTint(visual.tint);
    playerSprite.setAlpha(visual.alpha);
    playerSprite.setScale(this.skinDefinition.bodyScale * visual.scale);
  }

  public updateCrosshair(
    now: number,
    crosshairHorizontal: Phaser.GameObjects.Rectangle,
    crosshairVertical: Phaser.GameObjects.Rectangle,
    muzzleFlash: Phaser.GameObjects.Arc
  ): void {
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
    this.state.currentPlayerTeam = playerTeam;
    this.state.currentDummyTeam = dummyTeam;

    if (this.state.playerSprite !== undefined) {
      this.state.playerSprite.setTexture(getActorTeamTexture(this.skinDefinition, playerTeam).textureKey);
    }

    if (this.state.targetDummy !== undefined) {
      this.state.targetDummy.setTexture(getActorTeamTexture(this.skinDefinition, dummyTeam).textureKey);
    }

    this.applyWeaponLayerVisibility();
  }

  public resetActorVisuals(): void {
    const playerSprite = this.state.playerSprite;
    const targetDummy = this.state.targetDummy;

    playerSprite?.setTint(0xffffff);
    playerSprite?.setAlpha(1);
    playerSprite?.setScale(this.skinDefinition.bodyScale);
    targetDummy?.setTint(0xffffff);
    targetDummy?.setAlpha(1);
    targetDummy?.setScale(this.skinDefinition.bodyScale);
  }

  public getWeaponTurretTexture(team: TeamId, weaponId: string): string {
    const isScatter = weaponId === "scatter";
    if (team === "RED") {
      return isScatter ? GROUND_TURRET_SCATTER_RED_KEY : GROUND_TURRET_CARBINE_RED_KEY;
    }
    return isScatter ? GROUND_TURRET_SCATTER_BLUE_KEY : GROUND_TURRET_CARBINE_BLUE_KEY;
  }

  public getActorRotation(angleRadians: number): number {
    return angleRadians + this.skinDefinition.rotationOffsetRadians;
  }

  public getDebugState(): ActorPresentationDebugState {
    return {
      skinId: this.skinDefinition.id,
      weaponLayer: this.skinDefinition.weaponLayer,
      playerState: this.playerAnimationState,
      dummyState: this.dummyAnimationState,
      playerDirection: resolveActorDirection(this.state.playerBodyAngle),
      dummyDirection: resolveActorDirection(this.state.dummyBodyAngle),
      playerTextureKey: this.state.playerSprite?.texture.key ?? null,
      dummyTextureKey: this.state.targetDummy?.texture.key ?? null,
      playerWeaponVisible: this.state.playerWeaponSprite?.visible ?? false,
      dummyWeaponVisible: this.state.dummyWeaponSprite?.visible ?? false,
      destroyed: this.destroyed
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.state.playerWeaponSprite?.setVisible(false);
    this.state.dummyWeaponSprite?.setVisible(false);
  }

  private applyWeaponLayerVisibility(): void {
    const visible = !this.destroyed && this.skinDefinition.weaponLayer === "external";
    this.state.playerWeaponSprite?.setVisible(visible);
    this.state.dummyWeaponSprite?.setVisible(visible);
  }
}
