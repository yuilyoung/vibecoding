import Phaser from "phaser";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import { getDummyVisualState, getPlayerVisualState, type RespawnFxState } from "../ui/scene-visuals";
import type { SceneRuntimeState } from "./scene-runtime-state";
import {
  ACTOR_BODY_SCALE,
  ACTOR_ROTATION_OFFSET,
  DUMMY_WEAPON_SCALE,
  GROUND_BODY_BLUE_KEY,
  GROUND_BODY_RED_KEY,
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

export class VisualController {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly deps: VisualControllerDeps
  ) {}

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

    targetDummy.setTint(visual.tint);
    targetDummy.setAlpha(visual.alpha);
    targetDummy.setScale(ACTOR_BODY_SCALE * visual.scale);
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

    playerSprite.setTint(visual.tint);
    playerSprite.setAlpha(visual.alpha);
    playerSprite.setScale(ACTOR_BODY_SCALE * visual.scale);
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
      this.state.playerSprite.setTexture(playerTeam === "BLUE" ? GROUND_BODY_BLUE_KEY : GROUND_BODY_RED_KEY);
    }

    if (this.state.targetDummy !== undefined) {
      this.state.targetDummy.setTexture(dummyTeam === "BLUE" ? GROUND_BODY_BLUE_KEY : GROUND_BODY_RED_KEY);
    }
  }

  public resetActorVisuals(): void {
    const playerSprite = this.state.playerSprite;
    const targetDummy = this.state.targetDummy;

    playerSprite?.setTint(0xffffff);
    playerSprite?.setAlpha(1);
    playerSprite?.setScale(1);
    targetDummy?.setTint(0xffffff);
    targetDummy?.setAlpha(1);
    targetDummy?.setScale(1);
  }

  public getWeaponTurretTexture(team: TeamId, weaponId: string): string {
    const isScatter = weaponId === "scatter";
    if (team === "RED") {
      return isScatter ? GROUND_TURRET_SCATTER_RED_KEY : GROUND_TURRET_CARBINE_RED_KEY;
    }
    return isScatter ? GROUND_TURRET_SCATTER_BLUE_KEY : GROUND_TURRET_CARBINE_BLUE_KEY;
  }

  public getActorRotation(angleRadians: number): number {
    return angleRadians + ACTOR_ROTATION_OFFSET;
  }
}
