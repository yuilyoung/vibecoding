import Phaser from "phaser";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import { getDummyVisualState, getPlayerVisualState, type RespawnFxState } from "../ui/scene-visuals";
import type { SceneRuntimeState } from "./scene-runtime-state";
import {
  ACTOR_BODY_SCALE,
  ACTOR_MIN_SEPARATION,
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
import type { ActorCollisionResolver } from "./actor-collision";

export interface ActorVisualsDeps {
  readonly getActiveWeaponId: () => string;
  readonly getRespawnFxState: (now: number) => RespawnFxState;
  readonly isCombatLive: (now: number) => boolean;
}

export function getActorRotation(angleRadians: number): number {
  return angleRadians + ACTOR_ROTATION_OFFSET;
}

export function getWeaponTurretTexture(team: TeamId, weaponId: string): string {
  const isScatter = weaponId === "scatter";
  if (team === "RED") {
    return isScatter ? GROUND_TURRET_SCATTER_RED_KEY : GROUND_TURRET_CARBINE_RED_KEY;
  }
  return isScatter ? GROUND_TURRET_SCATTER_BLUE_KEY : GROUND_TURRET_CARBINE_BLUE_KEY;
}

export class ActorVisualsController {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly collisionResolver: ActorCollisionResolver,
    private readonly deps: ActorVisualsDeps
  ) {}

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

  public resolveActorSeparation(): void {
    const playerSprite = this.state.playerSprite;
    const targetDummy = this.state.targetDummy;
    if (!playerSprite || !targetDummy) return;

    const deltaX = targetDummy.x - playerSprite.x;
    const deltaY = targetDummy.y - playerSprite.y;
    const rawDistance = Math.hypot(deltaX, deltaY);

    if (rawDistance >= ACTOR_MIN_SEPARATION) {
      return;
    }

    const distance = rawDistance === 0 ? 1 : rawDistance;
    const fallbackAngle = this.state.playerLogic.state.aimAngleRadians;
    const normalX = rawDistance === 0 ? Math.cos(fallbackAngle) : deltaX / distance;
    const normalY = rawDistance === 0 ? Math.sin(fallbackAngle) : deltaY / distance;
    const overlap = ACTOR_MIN_SEPARATION - rawDistance;
    const pushX = normalX * overlap * 0.5;
    const pushY = normalY * overlap * 0.5;
    const playerCenter = this.collisionResolver.resolveStaticActorCenter(
      playerSprite,
      this.state.playerLogic,
      playerSprite.x - pushX,
      playerSprite.y - pushY
    );
    const dummyCenter = this.collisionResolver.resolveStaticActorCenter(
      targetDummy,
      this.state.dummyLogic,
      targetDummy.x + pushX,
      targetDummy.y + pushY
    );

    playerSprite.setPosition(playerCenter.x, playerCenter.y);
    targetDummy.setPosition(dummyCenter.x, dummyCenter.y);
  }

  public updatePlayerVisuals(now: number): void {
    const playerSprite = this.state.playerSprite;
    if (!playerSprite) return;

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

  public updateDummyVisuals(now: number): void {
    const targetDummy = this.state.targetDummy;
    if (!targetDummy) return;

    const dummyLogic = this.state.dummyLogic;
    const visual = getDummyVisualState({
      isDead: dummyLogic.isDead(),
      healthRatio: dummyLogic.state.health / dummyLogic.state.maxHealth,
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
    if (!playerSprite || !targetDummy || !playerWeaponSprite || !dummyWeaponSprite) return;

    const playerAngle = this.state.playerLogic.state.aimAngleRadians;
    const dummyAngle = this.state.dummyLogic.state.aimAngleRadians;
    const playerWeaponTexture = getWeaponTurretTexture(this.state.currentPlayerTeam, this.deps.getActiveWeaponId());
    const dummyWeaponTexture = getWeaponTurretTexture(this.state.currentDummyTeam, this.state.currentDummyWeaponId);

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
      .setRotation(getActorRotation(playerAngle))
      .setScale(PLAYER_WEAPON_SCALE * playerSprite.scaleX)
      .setAlpha(playerSprite.alpha);

    dummyWeaponSprite
      .setPosition(targetDummy.x, targetDummy.y)
      .setRotation(getActorRotation(dummyAngle))
      .setScale(DUMMY_WEAPON_SCALE * targetDummy.scaleX)
      .setAlpha(targetDummy.alpha);
  }

  public updateCrosshair(
    now: number,
    crosshairHorizontal: Phaser.GameObjects.Rectangle,
    crosshairVertical: Phaser.GameObjects.Rectangle,
    muzzleFlash: Phaser.GameObjects.Arc
  ): void {
    const pointer = this.scene.input.activePointer;
    const pointerX = Phaser.Math.Clamp(pointer.worldX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const pointerY = Phaser.Math.Clamp(pointer.worldY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);
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
}

export type { PlayerLogic };
