import Phaser from "phaser";
import type { ImpactFxView, ImpactProfile, MovementFxView, ShotTrailView } from "./scene-types";
import type { SceneRuntimeState } from "./scene-runtime-state";
import { MAX_IMPACT_EFFECTS, MAX_MOVEMENT_EFFECTS, MAX_SHOT_TRAILS } from "./scene-constants";

export type MovementFxActor = "player" | "dummy";

export interface VfxRuntimeStats {
  impactEffects: number;
  shotTrails: number;
  movementEffects: number;
}

export interface VfxControllerDeps {
  isPlayerSprintDown?: () => boolean;
}

export class VfxController {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly deps: VfxControllerDeps = {}
  ) {}

  public spawnImpactEffect(x: number, y: number, profile: ImpactProfile): void {
    const fxProfile = profile === "scatter"
      ? { flashRadius: 12, ringRadius: 20, flashColor: 0xffa44b, ringColor: 0xffe0aa, durationMs: 170, rayLength: 18 }
      : profile === "bazooka"
        ? { flashRadius: 18, ringRadius: 30, flashColor: 0xff7a3d, ringColor: 0xffd08a, durationMs: 220, rayLength: 26 }
      : profile === "grenade"
        ? { flashRadius: 16, ringRadius: 27, flashColor: 0x7cff8a, ringColor: 0xd5ffb0, durationMs: 210, rayLength: 22 }
      : profile === "sniper"
        ? { flashRadius: 10, ringRadius: 18, flashColor: 0xdff8ff, ringColor: 0x83eaff, durationMs: 160, rayLength: 28 }
      : profile === "airStrike"
        ? { flashRadius: 24, ringRadius: 42, flashColor: 0xfff06a, ringColor: 0xff6f4a, durationMs: 260, rayLength: 34 }
      : profile === "pickup-ammo"
        ? { flashRadius: 15, ringRadius: 28, flashColor: 0x6ce5ff, ringColor: 0xbaf4ff, durationMs: 260, rayLength: 22 }
        : profile === "pickup-health"
          ? { flashRadius: 14, ringRadius: 24, flashColor: 0x7effa8, ringColor: 0xd9ffe6, durationMs: 240, rayLength: 20 }
      : profile === "dummy"
        ? { flashRadius: 7, ringRadius: 11, flashColor: 0xff8d8d, ringColor: 0xffdfdf, durationMs: 110, rayLength: 10 }
        : { flashRadius: 8, ringRadius: 12, flashColor: 0xffe16c, ringColor: 0xfff0ad, durationMs: 115, rayLength: 13 };
    this.state.recentImpactEffectUntilMs = Math.max(
      this.state.recentImpactEffectUntilMs,
      this.scene.time.now + fxProfile.durationMs + 250
    );
    const flash = this.scene.add.circle(x, y, fxProfile.flashRadius, fxProfile.flashColor, 0.85).setDepth(9);
    const ring = this.scene.add
      .circle(x, y, fxProfile.ringRadius, fxProfile.ringColor, 0)
      .setDepth(9)
      .setStrokeStyle(profile === "scatter" || profile === "bazooka" || profile.startsWith("pickup-") ? 3 : 2, fxProfile.ringColor, 0.9);
    const rays = [0, 1, 2, 3].map((index) => {
      const angle = Phaser.Math.DegToRad(index * 45 + (profile === "scatter" || profile === "bazooka" ? 12 : profile.startsWith("pickup-") ? 8 : 0));
      return this.scene.add.line(
        x,
        y,
        Math.cos(angle) * 3,
        Math.sin(angle) * 3,
        Math.cos(angle) * fxProfile.rayLength,
        Math.sin(angle) * fxProfile.rayLength,
        fxProfile.ringColor,
        0.95
      ).setDepth(9).setLineWidth(profile === "scatter" || profile === "bazooka" || profile.startsWith("pickup-") ? 3 : 2);
    });

    this.state.impactEffects.push({
      flash,
      ring,
      rays,
      expiresAtMs: this.scene.time.now + fxProfile.durationMs,
      durationMs: fxProfile.durationMs
    });
    this.trimImpactEffectPool();
  }

  public spawnShotTrail(x: number, y: number, angle: number, length: number, color: number, durationMs: number): void {
    const line = this.scene.add.line(
      x,
      y,
      0,
      0,
      Math.cos(angle) * length,
      Math.sin(angle) * length,
      color,
      0.72
    ).setDepth(8).setLineWidth(3);

    this.state.shotTrails.push({
      line,
      expiresAtMs: this.scene.time.now + durationMs,
      durationMs
    });
    this.trimShotTrailPool();
  }

  public emitMovementFxForActor(actor: MovementFxActor, now: number, throttleInput: number): void {
    const isPlayer = actor === "player";
    const sprite = isPlayer ? this.state.playerSprite : this.state.targetDummy;
    const actorLogic = isPlayer ? this.state.playerLogic : this.state.dummyLogic;
    const bodyAngle = isPlayer ? this.state.playerBodyAngle : this.state.dummyBodyAngle;
    const nextAllowedAtMs = isPlayer ? this.state.nextPlayerMoveFxAtMs : this.state.nextDummyMoveFxAtMs;
    const appliedSpeed = actorLogic.state.lastAppliedSpeed;

    if (sprite === undefined || actorLogic.isDead() || appliedSpeed <= 4 || now < nextAllowedAtMs) {
      return;
    }

    const direction = throttleInput < 0 ? 1 : -1;
    const offsetDistance = 18;
    const sideOffset = 12;
    const baseX = sprite.x + Math.cos(bodyAngle) * offsetDistance * direction;
    const baseY = sprite.y + Math.sin(bodyAngle) * offsetDistance * direction;
    const lateralX = Math.cos(bodyAngle + Math.PI / 2) * sideOffset;
    const lateralY = Math.sin(bodyAngle + Math.PI / 2) * sideOffset;
    const driftScale = throttleInput < 0 ? 0.12 : 0.2;

    this.spawnMovementFx(baseX - lateralX, baseY - lateralY, -Math.cos(bodyAngle) * driftScale, -Math.sin(bodyAngle) * driftScale, 0x9fb6c8, 3.8);
    this.spawnMovementFx(baseX + lateralX, baseY + lateralY, -Math.cos(bodyAngle) * driftScale, -Math.sin(bodyAngle) * driftScale, 0x8aa0b4, 3.4);

    if (isPlayer) {
      this.state.nextPlayerMoveFxAtMs = now + (this.deps.isPlayerSprintDown?.() === true ? 70 : 110);
      return;
    }

    this.state.nextDummyMoveFxAtMs = now + 120;
  }

  public update(now: number): void {
    this.updateImpactEffects(now);
    this.updateShotTrails(now);
    this.updateMovementEffects(now);
  }

  public clearCombatFx(): void {
    for (const effect of this.state.impactEffects) {
      this.destroyImpactEffect(effect);
    }

    this.state.impactEffects.length = 0;

    for (const trail of this.state.shotTrails) {
      this.destroyShotTrail(trail);
    }

    this.state.shotTrails.length = 0;
  }

  public getRuntimeStats(now: number): VfxRuntimeStats {
    return {
      impactEffects: Math.max(this.state.impactEffects.length, now < this.state.recentImpactEffectUntilMs ? 1 : 0),
      shotTrails: this.state.shotTrails.length,
      movementEffects: this.state.movementEffects.length
    };
  }

  public getImpactProfile(weaponId: string): ImpactProfile {
    if (weaponId === "scatter" || weaponId === "bazooka" || weaponId === "grenade" || weaponId === "sniper" || weaponId === "airStrike") {
      return weaponId;
    }

    return "carbine";
  }

  private updateImpactEffects(now: number): void {
    for (let index = this.state.impactEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.state.impactEffects[index];
      const remainingMs = effect.expiresAtMs - now;

      if (remainingMs <= 0) {
        this.destroyImpactEffect(effect);
        this.state.impactEffects.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / effect.durationMs;
      effect.flash.setAlpha(0.85 - progress * 0.75);
      effect.flash.setScale(1 + progress * 0.45);
      effect.ring.setAlpha(0.95 - progress * 0.8);
      effect.ring.setScale(0.75 + progress * 0.8);
      for (const ray of effect.rays) {
        ray.setAlpha(0.92 - progress * 0.8);
        ray.setScale(0.9 + progress * 0.5);
      }
    }
  }

  private updateShotTrails(now: number): void {
    for (let index = this.state.shotTrails.length - 1; index >= 0; index -= 1) {
      const trail = this.state.shotTrails[index];
      const remainingMs = trail.expiresAtMs - now;

      if (remainingMs <= 0) {
        this.destroyShotTrail(trail);
        this.state.shotTrails.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / trail.durationMs;
      trail.line.setAlpha(0.72 - progress * 0.6);
      trail.line.setScale(1 + progress * 0.08);
    }
  }

  private updateMovementEffects(now: number): void {
    for (let index = this.state.movementEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.state.movementEffects[index];
      const remainingMs = effect.expiresAtMs - now;

      if (remainingMs <= 0) {
        this.destroyMovementEffect(effect);
        this.state.movementEffects.splice(index, 1);
        continue;
      }

      const progress = 1 - remainingMs / effect.durationMs;
      effect.sprite.x += effect.driftX;
      effect.sprite.y += effect.driftY;
      effect.sprite.setScale(1 + progress * 0.65);
      effect.sprite.setAlpha(0.22 * (1 - progress));
    }
  }

  private spawnMovementFx(
    x: number,
    y: number,
    driftX: number,
    driftY: number,
    color: number,
    radius: number
  ): void {
    const sprite = this.scene.add.circle(x, y, radius, color, 0.22).setDepth(4);
    this.state.movementEffects.push({
      sprite,
      expiresAtMs: this.scene.time.now + 260,
      durationMs: 260,
      driftX,
      driftY
    });
    this.trimMovementEffectPool();
  }

  private trimImpactEffectPool(): void {
    while (this.state.impactEffects.length > MAX_IMPACT_EFFECTS) {
      const oldest = this.state.impactEffects.shift();
      if (oldest === undefined) {
        return;
      }
      this.destroyImpactEffect(oldest);
    }
  }

  private trimShotTrailPool(): void {
    while (this.state.shotTrails.length > MAX_SHOT_TRAILS) {
      const oldest = this.state.shotTrails.shift();
      if (oldest === undefined) {
        return;
      }
      this.destroyShotTrail(oldest);
    }
  }

  private trimMovementEffectPool(): void {
    while (this.state.movementEffects.length > MAX_MOVEMENT_EFFECTS) {
      const oldest = this.state.movementEffects.shift();
      if (oldest === undefined) {
        return;
      }
      this.destroyMovementEffect(oldest);
    }
  }

  private destroyImpactEffect(effect: ImpactFxView): void {
    effect.flash.destroy();
    effect.ring.destroy();
    for (const ray of effect.rays) {
      ray.destroy();
    }
  }

  private destroyShotTrail(trail: ShotTrailView): void {
    trail.line.destroy();
  }

  private destroyMovementEffect(effect: MovementFxView): void {
    effect.sprite.destroy();
  }
}
