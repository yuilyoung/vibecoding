import type { ProjectileConfig } from "./ProjectileRuntime";

export interface WeaponConfig {
  readonly fireRateMs: number;
  readonly bulletSpeed: number;
  readonly damage: number;
  readonly critChance?: number;
  readonly critMultiplier?: number;
  readonly magazineSize: number;
  readonly reloadTimeMs: number;
  readonly reserveAmmo: number;
  readonly projectile?: ProjectileConfig;
  readonly blastRadius?: number;
  readonly blastDamage?: number;
  readonly knockback?: number;
  readonly pelletCount?: number;
  readonly spreadRadians?: number;
  readonly roleProfile?: WeaponRoleProfile;
}

export type TacticalIntent = "pressure" | "hold" | "retreat" | "flank";

export type WeaponSplashRisk = "low" | "medium" | "high";

export type WeaponTacticalTag = TacticalIntent | "anchor" | "denial" | "safe";

export interface WeaponRoleProfile {
  readonly role: string;
  readonly idealRange: readonly [number, number];
  readonly burstSize?: number;
  readonly splashRisk?: WeaponSplashRisk;
  readonly tacticalTags?: readonly WeaponTacticalTag[];
}

export interface WeaponSelectionContext {
  readonly distanceToTarget: number;
  readonly tacticalIntent?: TacticalIntent;
  readonly splashRiskTolerance?: "avoid" | "cautious" | "allow";
  readonly targetSpacing?: "tight" | "neutral" | "spread";
}

export interface WeaponSelectionEvaluation {
  readonly role: string | null;
  readonly score: number;
  readonly ready: boolean;
  readonly reasons: readonly string[];
}

export interface FireAttempt {
  readonly allowed: boolean;
  readonly nextReadyAtMs: number;
  readonly bulletSpeed: number;
  readonly damage: number;
  readonly ammoInMagazine: number;
  readonly reserveAmmo: number;
  readonly reloadUntilMs: number;
  readonly projectile: ProjectileConfig;
  readonly reason: "ready" | "cooldown" | "reloading" | "empty" | "no-reserve";
}

export class WeaponLogic {
  private readonly config: WeaponConfig;
  private readonly projectileConfig: ProjectileConfig;
  private nextReadyAtMs: number;
  private ammoInMagazine: number;
  private reserveAmmo: number;
  private reloadUntilMs: number;

  public constructor(config: WeaponConfig) {
    this.config = config;
    this.projectileConfig = this.resolveProjectileConfig(config);
    this.nextReadyAtMs = 0;
    this.ammoInMagazine = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;
    this.reloadUntilMs = 0;
  }

  public tryFire(atTimeMs: number): FireAttempt {
    if (this.isReloading(atTimeMs)) {
      return this.createAttempt(false, "reloading");
    }

    if (atTimeMs < this.nextReadyAtMs) {
      return this.createAttempt(false, "cooldown");
    }

    if (this.ammoInMagazine === 0) {
      return this.createAttempt(false, "empty");
    }

    this.nextReadyAtMs = atTimeMs + this.config.fireRateMs;
    this.ammoInMagazine -= 1;

    return this.createAttempt(true, "ready");
  }

  public getCooldownRemaining(atTimeMs: number): number {
    return Math.max(0, this.nextReadyAtMs - atTimeMs);
  }

  public getCooldownDuration(): number {
    return this.config.fireRateMs;
  }

  public startReload(atTimeMs: number): boolean {
    if (this.isReloading(atTimeMs) || this.ammoInMagazine === this.config.magazineSize) {
      return false;
    }

    if (this.reserveAmmo === 0) {
      return false;
    }

    this.reloadUntilMs = atTimeMs + this.config.reloadTimeMs;
    return true;
  }

  public cancelReload(atTimeMs: number): boolean {
    this.update(atTimeMs);

    if (!this.isReloading(atTimeMs)) {
      return false;
    }

    this.reloadUntilMs = 0;
    return true;
  }

  public update(atTimeMs: number): void {
    if (this.reloadUntilMs > 0 && atTimeMs >= this.reloadUntilMs) {
      const missingRounds = this.config.magazineSize - this.ammoInMagazine;
      const roundsToLoad = Math.min(missingRounds, this.reserveAmmo);
      this.ammoInMagazine += roundsToLoad;
      this.reserveAmmo -= roundsToLoad;
      this.reloadUntilMs = 0;
    }
  }

  public getAmmoInMagazine(atTimeMs: number): number {
    this.update(atTimeMs);
    return this.ammoInMagazine;
  }

  public getMagazineSize(): number {
    return this.config.magazineSize;
  }

  public getReserveAmmo(atTimeMs: number): number {
    this.update(atTimeMs);
    return this.reserveAmmo;
  }

  public getMaxReserveAmmo(): number {
    return this.config.reserveAmmo;
  }

  public addReserveAmmo(amount: number, atTimeMs: number): number {
    this.update(atTimeMs);

    const missingAmmo = this.config.reserveAmmo - this.reserveAmmo;
    const restoredAmmo = Math.min(Math.max(amount, 0), missingAmmo);
    this.reserveAmmo += restoredAmmo;
    return restoredAmmo;
  }

  public refundRound(atTimeMs: number): void {
    this.update(atTimeMs);
    this.ammoInMagazine = Math.min(this.config.magazineSize, this.ammoInMagazine + 1);
  }

  public restockAllAmmo(atTimeMs: number): void {
    this.update(atTimeMs);
    this.ammoInMagazine = this.config.magazineSize;
    this.reserveAmmo = this.config.reserveAmmo;
    this.reloadUntilMs = 0;
  }

  public isReloading(atTimeMs: number): boolean {
    this.update(atTimeMs);
    return this.reloadUntilMs > atTimeMs;
  }

  public getReloadRemaining(atTimeMs: number): number {
    this.update(atTimeMs);
    return Math.max(0, this.reloadUntilMs - atTimeMs);
  }

  public getReloadDuration(): number {
    return this.config.reloadTimeMs;
  }

  public getProjectileConfig(): ProjectileConfig {
    return this.config.projectile ?? {
      trajectory: "linear",
      speed: this.config.bulletSpeed
    };
  }

  public getRoleProfile(): WeaponRoleProfile | undefined {
    return this.config.roleProfile;
  }

  public getRoleId(): string | null {
    return this.config.roleProfile?.role ?? null;
  }

  public evaluateSelection(context: WeaponSelectionContext, atTimeMs: number): WeaponSelectionEvaluation {
    const reasons: string[] = [];
    let score = 0;

    if (this.isReloading(atTimeMs)) {
      reasons.push("reloading");
      score -= 1000;
    }

    if (this.getAmmoInMagazine(atTimeMs) <= 0) {
      reasons.push("empty-magazine");
      score -= 1000;
    }

    const reserveAmmo = this.getReserveAmmo(atTimeMs);
    if (reserveAmmo <= 0 && this.getAmmoInMagazine(atTimeMs) <= 1) {
      reasons.push("low-total-ammo");
      score -= 80;
    }

    const roleProfile = this.config.roleProfile;
    if (roleProfile === undefined) {
      score += this.getAmmoInMagazine(atTimeMs) * 2;
      reasons.push("default-profile");
      return {
        role: null,
        score,
        ready: score > -1000,
        reasons
      };
    }

    score += this.scoreIdealRange(context.distanceToTarget, roleProfile.idealRange, reasons);
    score += this.scoreIntent(context.tacticalIntent, roleProfile, reasons);
    score += this.scoreSplashRisk(context, roleProfile, reasons);
    score += this.scoreBurst(roleProfile, context, reasons);
    score += this.getAmmoInMagazine(atTimeMs) * 2;

    return {
      role: roleProfile.role,
      score,
      ready: score > -1000,
      reasons
    };
  }

  public reset(): void {
    this.nextReadyAtMs = 0;
    this.ammoInMagazine = this.config.magazineSize;
    this.reserveAmmo = this.config.reserveAmmo;
    this.reloadUntilMs = 0;
  }

  private createAttempt(allowed: boolean, reason: FireAttempt["reason"]): FireAttempt {
    return {
      allowed,
      nextReadyAtMs: this.nextReadyAtMs,
      bulletSpeed: this.config.bulletSpeed,
      damage: this.config.damage,
      ammoInMagazine: this.ammoInMagazine,
      reserveAmmo: this.reserveAmmo,
      reloadUntilMs: this.reloadUntilMs,
      projectile: this.projectileConfig,
      reason
    };
  }

  private resolveProjectileConfig(config: WeaponConfig): ProjectileConfig {
    const projectile: Partial<ProjectileConfig> = config.projectile ?? {};
    return {
      trajectory: projectile?.trajectory ?? "linear",
      speed: projectile?.speed ?? config.bulletSpeed,
      ...(projectile?.gravity !== undefined ? { gravity: projectile.gravity } : {}),
      ...(projectile?.bounceCount !== undefined ? { bounceCount: projectile.bounceCount } : {}),
      ...(projectile?.homingStrength !== undefined ? { homingStrength: projectile.homingStrength } : {}),
      ...(projectile?.blastRadius !== undefined ? { blastRadius: projectile.blastRadius } : config.blastRadius !== undefined ? { blastRadius: config.blastRadius } : {}),
      ...(projectile?.blastDamage !== undefined ? { blastDamage: projectile.blastDamage } : config.blastDamage !== undefined ? { blastDamage: config.blastDamage } : {}),
      ...(projectile?.knockback !== undefined ? { knockback: projectile.knockback } : config.knockback !== undefined ? { knockback: config.knockback } : {}),
      ...(projectile?.pelletCount !== undefined ? { pelletCount: projectile.pelletCount } : config.pelletCount !== undefined ? { pelletCount: config.pelletCount } : {}),
      ...(projectile?.spreadRadians !== undefined ? { spreadRadians: projectile.spreadRadians } : config.spreadRadians !== undefined ? { spreadRadians: config.spreadRadians } : {}),
      ...(projectile?.windMultiplier !== undefined ? { windMultiplier: projectile.windMultiplier } : {})
    };
  }

  private scoreIdealRange(distanceToTarget: number, idealRange: readonly [number, number], reasons: string[]): number {
    const [minRange, maxRange] = idealRange;

    if (distanceToTarget >= minRange && distanceToTarget <= maxRange) {
      reasons.push("ideal-range");
      return 60;
    }

    const rangeSpan = Math.max(1, maxRange - minRange);
    const distanceOutsideRange = distanceToTarget < minRange
      ? minRange - distanceToTarget
      : distanceToTarget - maxRange;
    const penalty = Math.min(70, Math.round((distanceOutsideRange / rangeSpan) * 45));
    reasons.push("range-mismatch");
    return -penalty;
  }

  private scoreIntent(
    tacticalIntent: TacticalIntent | undefined,
    roleProfile: WeaponRoleProfile,
    reasons: string[]
  ): number {
    if (tacticalIntent === undefined) {
      return 0;
    }

    if (roleProfile.tacticalTags?.includes(tacticalIntent) === true) {
      reasons.push(`intent:${tacticalIntent}`);
      return 24;
    }

    if (tacticalIntent === "hold" && roleProfile.tacticalTags?.includes("anchor") === true) {
      reasons.push("intent:anchor");
      return 18;
    }

    if (tacticalIntent === "pressure" && roleProfile.tacticalTags?.includes("denial") === true) {
      reasons.push("intent:denial");
      return 8;
    }

    return 0;
  }

  private scoreSplashRisk(
    context: WeaponSelectionContext,
    roleProfile: WeaponRoleProfile,
    reasons: string[]
  ): number {
    const splashRisk = roleProfile.splashRisk ?? "low";
    const spacing = context.targetSpacing ?? "neutral";
    const tolerance = context.splashRiskTolerance ?? "allow";

    if (tolerance === "allow") {
      if (splashRisk !== "low" && spacing === "spread") {
        reasons.push("spacing-safe");
        return 18;
      }

      return 0;
    }

    const penaltyMap: Record<WeaponSplashRisk, number> = tolerance === "avoid"
      ? { low: 0, medium: 35, high: 70 }
      : { low: 0, medium: 18, high: 36 };

    if (penaltyMap[splashRisk] > 0) {
      reasons.push(`splash:${tolerance}`);
      return -penaltyMap[splashRisk];
    }

    return 0;
  }

  private scoreBurst(
    roleProfile: WeaponRoleProfile,
    context: WeaponSelectionContext,
    reasons: string[]
  ): number {
    const burstSize = roleProfile.burstSize ?? 1;

    if (context.tacticalIntent === "pressure") {
      const bonus = Math.min(16, burstSize * 4);
      if (bonus > 0) {
        reasons.push("burst-pressure");
      }
      return bonus;
    }

    if (context.tacticalIntent === "hold") {
      const penalty = Math.max(0, burstSize - 2) * 3;
      if (penalty > 0) {
        reasons.push("burst-hold");
      }
      return -penalty;
    }

    return 0;
  }
}
