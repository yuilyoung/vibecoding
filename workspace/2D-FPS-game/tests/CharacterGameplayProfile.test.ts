import { describe, expect, it } from "vitest";
import {
  CHARACTER_GAMEPLAY_PROFILES,
  applyCharacterWeaponProfile,
  getCharacterMaxHealth,
  getCharacterGameplayProfile,
  type CharacterWeaponStats
} from "../src/domain/player/CharacterGameplayProfile";

describe("CharacterGameplayProfile", () => {
  it("defines four arcade profiles with deterministic combat traits", () => {
    expect(Object.keys(CHARACTER_GAMEPLAY_PROFILES)).toEqual([
      "arcade-bunny",
      "arcade-bear",
      "arcade-fox",
      "arcade-cat"
    ]);
    expect(getCharacterGameplayProfile("arcade-bunny")).toMatchObject({
      magazineBonus: 2,
      reserveAmmoBonus: 12,
      movementSpeedMultiplier: 1.08,
      maxHealthBonus: 0,
      reloadTimeMultiplier: 0.9
    });
    expect(getCharacterGameplayProfile("arcade-bear")).toMatchObject({
      magazineBonus: 4,
      reserveAmmoBonus: 24,
      movementSpeedMultiplier: 0.9,
      maxHealthBonus: 36,
      reloadTimeMultiplier: 1.12
    });
    expect(getCharacterGameplayProfile("arcade-fox")).toMatchObject({
      magazineBonus: 1,
      reserveAmmoBonus: 8,
      movementSpeedMultiplier: 1.18,
      maxHealthBonus: 8,
      reloadTimeMultiplier: 0.82
    });
    expect(getCharacterGameplayProfile("arcade-cat")).toMatchObject({
      magazineBonus: 3,
      reserveAmmoBonus: 16,
      movementSpeedMultiplier: 1.04,
      maxHealthBonus: 18,
      reloadTimeMultiplier: 0.72
    });
  });

  it("falls back to neutral traits for unsupported or classic actor ids", () => {
    expect(getCharacterGameplayProfile("legacy-vehicle")).toEqual(getCharacterGameplayProfile(null));
    expect(getCharacterGameplayProfile("unsupported")).toMatchObject({
      magazineBonus: 0,
      reserveAmmoBonus: 0,
      movementSpeedMultiplier: 1,
      maxHealthBonus: 0,
      reloadTimeMultiplier: 1
    });
  });

  it("transforms weapon capacity and reload duration without mutating the input", () => {
    const base: CharacterWeaponStats = { magazineSize: 6, reserveAmmo: 24, reloadTimeMs: 1_000 };
    const transformed = applyCharacterWeaponProfile(base, getCharacterGameplayProfile("arcade-cat"));

    expect(transformed).toEqual({ magazineSize: 9, reserveAmmo: 40, reloadTimeMs: 720 });
    expect(base).toEqual({ magazineSize: 6, reserveAmmo: 24, reloadTimeMs: 1_000 });
  });

  it("adds the selected character health bonus to the base health", () => {
    expect(getCharacterMaxHealth(100, getCharacterGameplayProfile("arcade-bear"))).toBe(136);
    expect(getCharacterMaxHealth(100, getCharacterGameplayProfile("arcade-bunny"))).toBe(100);
  });

  it("never produces a zero or negative reload duration for timed weapons", () => {
    expect(applyCharacterWeaponProfile({ magazineSize: 1, reserveAmmo: 3, reloadTimeMs: 1 }, getCharacterGameplayProfile("arcade-fox")).reloadTimeMs).toBe(1);
    expect(applyCharacterWeaponProfile({ magazineSize: 1, reserveAmmo: 3, reloadTimeMs: 0 }, getCharacterGameplayProfile("arcade-cat")).reloadTimeMs).toBe(0);
  });
});
