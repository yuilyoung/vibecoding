import gameBalance from "../assets/data/game-balance.json";
import type { ProjectileConfig, ProjectileTrajectory } from "../src/domain/combat/ProjectileRuntime";
import { WeaponLogic, type WeaponConfig } from "../src/domain/combat/WeaponLogic";

interface BalanceWeapon {
  readonly label: string;
  readonly fireRateMs: number;
  readonly damage: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly magazineSize: number;
  readonly reloadTimeMs: number;
  readonly reserveAmmo: number;
  readonly projectile: ProjectileConfig;
}

const weapons = gameBalance.weapons as Record<string, BalanceWeapon>;

describe("game-balance weapons", () => {
  it("defines the Phase 1 six-weapon roster", () => {
    expect(Object.keys(weapons)).toEqual([
      "carbine",
      "scatter",
      "bazooka",
      "grenade",
      "sniper",
      "airStrike"
    ]);
  });

  it("covers the required Phase 1 projectile trajectories", () => {
    const trajectories = new Set<ProjectileTrajectory>(
      Object.values(weapons).map((weapon) => weapon.projectile.trajectory)
    );

    expect(trajectories).toEqual(new Set([
      "linear",
      "arc",
      "bounce",
      "beam",
      "aoe-call"
    ]));
  });

  it("defines critical hit tuning for every weapon", () => {
    for (const weapon of Object.values(weapons)) {
      expect(weapon.critChance).toBeGreaterThanOrEqual(0);
      expect(weapon.critChance).toBeLessThanOrEqual(1);
      expect(weapon.critMultiplier).toBeGreaterThanOrEqual(1);
    }
  });

  it("can hydrate WeaponLogic with projectile configs", () => {
    const bazookaConfig: WeaponConfig = {
      ...weapons.bazooka,
      bulletSpeed: weapons.bazooka.projectile.speed
    };
    const bazooka = new WeaponLogic(bazookaConfig);

    expect(bazooka.getProjectileConfig()).toMatchObject({
      trajectory: "arc",
      speed: 360,
      gravity: 300,
      blastRadius: 60,
      knockback: 90
    });
    expect(bazooka.tryFire(0)).toMatchObject({
      allowed: true,
      damage: 45,
      bulletSpeed: 360
    });
  });
});

describe("game-balance map objects", () => {
  it("defines barrel, mine, and crate tuning", () => {
    expect(gameBalance.mapObjects.barrel).toMatchObject({
      hp: 40,
      blastRadius: 80,
      blastDamage: 40,
      triggerRadius: 70,
      chainDelayMs: 150
    });
    expect(gameBalance.mapObjects.mine).toMatchObject({
      armDelayMs: 500,
      proximityRadius: 40,
      fuseMs: 1000,
      blastRadius: 50,
      blastDamage: 50
    });
    expect(gameBalance.mapObjects.crate.hp).toBe(25);
  });

  it("keeps the crate drop table normalized", () => {
    const total = Object.values(gameBalance.mapObjects.crate.dropTable)
      .reduce((sum, chance) => sum + chance, 0);

    expect(total).toBeCloseTo(1);
  });
});
