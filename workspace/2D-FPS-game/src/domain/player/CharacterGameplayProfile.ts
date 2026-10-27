export type CharacterGameplayId = "arcade-bunny" | "arcade-bear" | "arcade-fox" | "arcade-cat";

export interface CharacterGameplayProfile {
  readonly id: CharacterGameplayId | "neutral";
  readonly traitLabel: string;
  readonly traitDescription: string;
  readonly magazineBonus: number;
  readonly reserveAmmoBonus: number;
  readonly movementSpeedMultiplier: number;
  readonly maxHealthBonus: number;
  readonly reloadTimeMultiplier: number;
}

export interface CharacterWeaponStats {
  readonly magazineSize: number;
  readonly reserveAmmo: number;
  readonly reloadTimeMs: number;
}

const NEUTRAL_PROFILE: CharacterGameplayProfile = Object.freeze({
  id: "neutral",
  traitLabel: "Standard loadout",
  traitDescription: "Uses the selected game balance without character bonuses.",
  magazineBonus: 0,
  reserveAmmoBonus: 0,
  movementSpeedMultiplier: 1,
  maxHealthBonus: 0,
  reloadTimeMultiplier: 1
});

export const CHARACTER_GAMEPLAY_PROFILES: Readonly<Record<CharacterGameplayId, CharacterGameplayProfile>> = Object.freeze({
  "arcade-bunny": Object.freeze({
    id: "arcade-bunny",
    traitLabel: "Quick paws",
    traitDescription: "+2 magazine · +12 reserve · +8% move · 10% faster reload",
    magazineBonus: 2,
    reserveAmmoBonus: 12,
    movementSpeedMultiplier: 1.08,
    maxHealthBonus: 0,
    reloadTimeMultiplier: 0.9
  }),
  "arcade-bear": Object.freeze({
    id: "arcade-bear",
    traitLabel: "Cozy tank",
    traitDescription: "+4 magazine · +24 reserve · +36 HP · 10% slower move · 12% slower reload",
    magazineBonus: 4,
    reserveAmmoBonus: 24,
    movementSpeedMultiplier: 0.9,
    maxHealthBonus: 36,
    reloadTimeMultiplier: 1.12
  }),
  "arcade-fox": Object.freeze({
    id: "arcade-fox",
    traitLabel: "Dash scout",
    traitDescription: "+1 magazine · +8 reserve · +18% move · +8 HP · 18% faster reload",
    magazineBonus: 1,
    reserveAmmoBonus: 8,
    movementSpeedMultiplier: 1.18,
    maxHealthBonus: 8,
    reloadTimeMultiplier: 0.82
  }),
  "arcade-cat": Object.freeze({
    id: "arcade-cat",
    traitLabel: "Smooth loader",
    traitDescription: "+3 magazine · +16 reserve · +4% move · +18 HP · 28% faster reload",
    magazineBonus: 3,
    reserveAmmoBonus: 16,
    movementSpeedMultiplier: 1.04,
    maxHealthBonus: 18,
    reloadTimeMultiplier: 0.72
  })
});

export function getCharacterGameplayProfile(id: string | null | undefined): CharacterGameplayProfile {
  const normalized = id?.trim().toLowerCase();
  return normalized !== undefined && normalized in CHARACTER_GAMEPLAY_PROFILES
    ? CHARACTER_GAMEPLAY_PROFILES[normalized as CharacterGameplayId]
    : NEUTRAL_PROFILE;
}

export function getCharacterMaxHealth(baseHealth: number, profile: CharacterGameplayProfile): number {
  return Math.max(0, Math.floor(baseHealth + profile.maxHealthBonus));
}

export function applyCharacterWeaponProfile(
  stats: CharacterWeaponStats,
  profile: CharacterGameplayProfile
): CharacterWeaponStats {
  return {
    magazineSize: Math.max(0, Math.floor(stats.magazineSize + profile.magazineBonus)),
    reserveAmmo: Math.max(0, Math.floor(stats.reserveAmmo + profile.reserveAmmoBonus)),
    reloadTimeMs: stats.reloadTimeMs === 0
      ? 0
      : Math.max(1, Math.round(stats.reloadTimeMs * profile.reloadTimeMultiplier))
  };
}
