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
}
