import type { ProgressionState } from "./ProgressionLogic";

export interface WeaponUnlockRule {
  readonly weaponId: string;
  readonly requiredLevel: number;
}

export interface UnlockState {
  readonly unlockedWeaponIds: readonly string[];
}

export function createUnlockState(
  progression: ProgressionState,
  rules: readonly WeaponUnlockRule[],
  defaultWeaponIds: readonly string[]
): UnlockState {
  return {
    unlockedWeaponIds: resolveUnlockedWeaponIds(progression, rules, defaultWeaponIds)
  };
}

export function resolveUnlockedWeaponIds(
  progression: ProgressionState,
  rules: readonly WeaponUnlockRule[],
  defaultWeaponIds: readonly string[]
): readonly string[] {
  const unlocked = new Set(defaultWeaponIds);

  for (const rule of rules) {
    if (progression.level >= rule.requiredLevel) {
      unlocked.add(rule.weaponId);
    }
  }

  return [...unlocked];
}

export function isWeaponUnlocked(
  weaponId: string,
  progression: ProgressionState,
  rules: readonly WeaponUnlockRule[],
  defaultWeaponIds: readonly string[]
): boolean {
  return resolveUnlockedWeaponIds(progression, rules, defaultWeaponIds).includes(weaponId);
}

export function getNewlyUnlockedWeaponIds(
  previous: UnlockState,
  next: UnlockState
): readonly string[] {
  const previousIds = new Set(previous.unlockedWeaponIds);
  return next.unlockedWeaponIds.filter((weaponId) => !previousIds.has(weaponId));
}
