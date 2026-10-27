import { describe, expect, it } from "vitest";
import { ARCADE_WEAPON_BALANCE, applyArcadeWeaponBalance } from "../src/domain/combat/ArcadeWeaponBalance";
import type { WeaponConfig } from "../src/domain/combat/WeaponLogic";

describe("arcade weapon balance", () => {
  it("keeps the requested damage ladder and distinct impact radii", () => {
    expect(ARCADE_WEAPON_BALANCE).toMatchObject({
      carbine: { damage: 2, hitRadius: 2 },
      scatter: { damage: 1, hitRadius: 5 },
      bazooka: { damage: 5, hitRadius: 7, blastDamage: 5, blastRadius: 76 },
      grenade: { damage: 4, hitRadius: 6, blastDamage: 4, blastRadius: 64 },
      sniper: { damage: 7, hitRadius: 0 },
      airStrike: { damage: 10, hitRadius: 0, blastDamage: 10, blastRadius: 112 }
    });
  });

  it("applies arcade tuning to the projectile contract without mutating the source config", () => {
    const source: WeaponConfig = {
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24,
      projectile: { trajectory: "linear", speed: 540 }
    };

    const tuned = applyArcadeWeaponBalance(source, "bazooka");

    expect(tuned).toMatchObject({
      damage: 5,
      projectile: { hitRadius: 7, blastRadius: 76, blastDamage: 5 }
    });
    expect(source).toEqual({
      fireRateMs: 180,
      bulletSpeed: 540,
      damage: 20,
      magazineSize: 6,
      reloadTimeMs: 1200,
      reserveAmmo: 24,
      projectile: { trajectory: "linear", speed: 540 }
    });
  });
});
