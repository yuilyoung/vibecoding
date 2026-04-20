import Phaser from "phaser";
import { WeaponLogic } from "../domain/combat/WeaponLogic";
import type { WeaponConfig } from "../domain/combat/WeaponLogic";
import type { ProjectileConfig } from "../domain/combat/ProjectileRuntime";
import type { BalanceWeaponConfig, GameBalance, PlayerWeaponSlot } from "./scene-types";

const DEFAULT_CRIT_CHANCE = 0.15;
const DEFAULT_CRIT_MULTIPLIER = 1.8;

function mergeWeaponConfig(defaultConfig: WeaponConfig, balanceConfig: BalanceWeaponConfig | undefined): WeaponConfig {
  return {
    ...defaultConfig,
    ...balanceConfig,
    bulletSpeed: balanceConfig?.bulletSpeed ?? balanceConfig?.projectile?.speed ?? defaultConfig.bulletSpeed
  };
}

function createWeaponSlot(
  id: string,
  label: string,
  config: WeaponConfig,
  view: {
    readonly bulletColor: number;
    readonly bulletWidth: number;
    readonly bulletHeight: number;
    readonly pelletCount: number;
    readonly spreadRadians: number;
  },
  projectileConfig: ProjectileConfig = {
    trajectory: "linear",
    speed: config.bulletSpeed
  }
): PlayerWeaponSlot {
  return {
    id,
    label,
    logic: new WeaponLogic(config),
    projectileConfig: config.projectile ?? projectileConfig,
    critChance: config.critChance ?? DEFAULT_CRIT_CHANCE,
    critMultiplier: config.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER,
    ...view
  };
}

export function createPlayerWeaponSlots(gameBalance: GameBalance): PlayerWeaponSlot[] {
  const weapons = (gameBalance.weapons ?? {}) as Record<string, BalanceWeaponConfig>;
  return [
    createWeaponSlot("carbine", "Carbine", mergeWeaponConfig({
      fireRateMs: gameBalance.fireRateMs,
      bulletSpeed: gameBalance.bulletSpeed,
      damage: gameBalance.bulletDamage,
      magazineSize: gameBalance.magazineSize,
      reloadTimeMs: gameBalance.reloadTimeMs,
      reserveAmmo: gameBalance.reserveAmmo
    }, weapons.carbine), {
      bulletColor: 0xfff27a,
      bulletWidth: 10,
      bulletHeight: 4,
      pelletCount: 1,
      spreadRadians: 0
    }),
    createWeaponSlot("scatter", "Scatter", mergeWeaponConfig({
      fireRateMs: 620,
      bulletSpeed: gameBalance.bulletSpeed * 0.82,
      damage: 12,
      magazineSize: 2,
      reloadTimeMs: 1450,
      reserveAmmo: 12
    }, weapons.scatter), {
      bulletColor: 0xffb86c,
      bulletWidth: 8,
      bulletHeight: 4,
      pelletCount: 3,
      spreadRadians: Phaser.Math.DegToRad(7)
    }),
    createWeaponSlot("bazooka", "Bazooka", mergeWeaponConfig({
      fireRateMs: 1250,
      bulletSpeed: gameBalance.bulletSpeed * 0.54,
      damage: 45,
      magazineSize: 1,
      reloadTimeMs: 1700,
      reserveAmmo: 5
    }, weapons.bazooka), {
      bulletColor: 0xff8f3f,
      bulletWidth: 16,
      bulletHeight: 8,
      pelletCount: 1,
      spreadRadians: 0
    }),
    createWeaponSlot("grenade", "Grenade", mergeWeaponConfig({
      fireRateMs: 1100,
      bulletSpeed: gameBalance.bulletSpeed * 0.66,
      damage: 35,
      magazineSize: 1,
      reloadTimeMs: 1500,
      reserveAmmo: 6
    }, weapons.grenade), {
      bulletColor: 0x7cff8a,
      bulletWidth: 12,
      bulletHeight: 12,
      pelletCount: 1,
      spreadRadians: 0
    }),
    createWeaponSlot("sniper", "Sniper", mergeWeaponConfig({
      fireRateMs: 2000,
      bulletSpeed: 0,
      damage: 55,
      magazineSize: 1,
      reloadTimeMs: 1900,
      reserveAmmo: 8
    }, weapons.sniper), {
      bulletColor: 0xdff8ff,
      bulletWidth: 14,
      bulletHeight: 3,
      pelletCount: 1,
      spreadRadians: 0
    }),
    createWeaponSlot("airStrike", "Air Strike", mergeWeaponConfig({
      fireRateMs: 15000,
      bulletSpeed: 0,
      damage: 30,
      magazineSize: 1,
      reloadTimeMs: 0,
      reserveAmmo: 3
    }, weapons.airStrike), {
      bulletColor: 0xfff06a,
      bulletWidth: 18,
      bulletHeight: 18,
      pelletCount: 1,
      spreadRadians: 0
    })
  ];
}

export function createDummyWeaponSlots(gameBalance: GameBalance): PlayerWeaponSlot[] {
  return [
    createWeaponSlot("carbine", "Dummy Carbine", {
      fireRateMs: 900,
      bulletSpeed: gameBalance.bulletSpeed * 0.75,
      damage: 12,
      magazineSize: 99,
      reloadTimeMs: 1,
      reserveAmmo: 999
    }, {
      bulletColor: 0xff8b8b,
      bulletWidth: 10,
      bulletHeight: 4,
      pelletCount: 1,
      spreadRadians: 0
    }, {
      trajectory: "linear",
      speed: gameBalance.bulletSpeed * 0.75
    }),
    createWeaponSlot("scatter", "Dummy Scatter", {
      fireRateMs: 1100,
      bulletSpeed: gameBalance.bulletSpeed * 0.68,
      damage: 8,
      magazineSize: 99,
      reloadTimeMs: 1,
      reserveAmmo: 999
    }, {
      bulletColor: 0xffaf73,
      bulletWidth: 8,
      bulletHeight: 4,
      pelletCount: 3,
      spreadRadians: Phaser.Math.DegToRad(8)
    }, {
      trajectory: "linear",
      speed: gameBalance.bulletSpeed * 0.68
    })
  ];
}
