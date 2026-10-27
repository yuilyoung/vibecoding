import type { ProjectileConfig } from "./ProjectileRuntime";
import type { WeaponConfig } from "./WeaponLogic";

export interface ArcadeWeaponBalance {
  readonly damage: number;
  readonly hitRadius: number;
  readonly blastDamage?: number;
  readonly blastRadius?: number;
}

export const ARCADE_WEAPON_BALANCE: Readonly<Record<string, ArcadeWeaponBalance>> = Object.freeze({
  carbine: Object.freeze({ damage: 2, hitRadius: 2 }),
  scatter: Object.freeze({ damage: 1, hitRadius: 5 }),
  bazooka: Object.freeze({ damage: 5, hitRadius: 7, blastDamage: 5, blastRadius: 76 }),
  grenade: Object.freeze({ damage: 4, hitRadius: 6, blastDamage: 4, blastRadius: 64 }),
  sniper: Object.freeze({ damage: 7, hitRadius: 0 }),
  airStrike: Object.freeze({ damage: 10, hitRadius: 0, blastDamage: 10, blastRadius: 112 })
});

export function applyArcadeWeaponBalance(config: WeaponConfig, weaponId: string): WeaponConfig {
  const balance = ARCADE_WEAPON_BALANCE[weaponId];
  if (balance === undefined) {
    return config;
  }

  const projectile: ProjectileConfig = {
    ...(config.projectile ?? { trajectory: "linear", speed: config.bulletSpeed }),
    hitRadius: balance.hitRadius,
    ...(balance.blastRadius === undefined ? {} : { blastRadius: balance.blastRadius }),
    ...(balance.blastDamage === undefined ? {} : { blastDamage: balance.blastDamage })
  };

  return {
    ...config,
    damage: balance.damage,
    projectile
  };
}
