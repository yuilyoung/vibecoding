import {
  createUnlockState,
  getNewlyUnlockedWeaponIds,
  isWeaponUnlocked,
  resolveUnlockedWeaponIds
} from "../src/domain/progression/UnlockLogic";

describe("UnlockLogic", () => {
  const defaultWeaponIds = ["carbine", "scatter"] as const;
  const rules = [
    { weaponId: "bazooka", requiredLevel: 2 },
    { weaponId: "grenade", requiredLevel: 3 },
    { weaponId: "sniper", requiredLevel: 4 },
    { weaponId: "airStrike", requiredLevel: 5 }
  ] as const;

  it("starts with the default weapon set", () => {
    expect(resolveUnlockedWeaponIds({ level: 1, xp: 0, totalXp: 0 }, rules, defaultWeaponIds)).toEqual([
      "carbine",
      "scatter"
    ]);
  });

  it("unlocks weapons at and above their required level", () => {
    expect(resolveUnlockedWeaponIds({ level: 3, xp: 0, totalXp: 250 }, rules, defaultWeaponIds)).toEqual([
      "carbine",
      "scatter",
      "bazooka",
      "grenade"
    ]);
  });

  it("checks one weapon against default and level-based unlocks", () => {
    const progression = { level: 4, xp: 20, totalXp: 470 };

    expect(isWeaponUnlocked("carbine", progression, rules, defaultWeaponIds)).toBe(true);
    expect(isWeaponUnlocked("sniper", progression, rules, defaultWeaponIds)).toBe(true);
    expect(isWeaponUnlocked("airStrike", progression, rules, defaultWeaponIds)).toBe(false);
  });

  it("reports newly unlocked weapons between states", () => {
    const previous = createUnlockState({ level: 2, xp: 0, totalXp: 100 }, rules, defaultWeaponIds);
    const next = createUnlockState({ level: 4, xp: 0, totalXp: 450 }, rules, defaultWeaponIds);

    expect(getNewlyUnlockedWeaponIds(previous, next)).toEqual(["grenade", "sniper"]);
  });
});
