import type { ProgressionState } from "./ProgressionLogic";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProgressionStorageAdapter {
  save(state: ProgressionState): void;
  load(): ProgressionState | null;
  clear(): void;
}

interface ProgressionStoragePayloadV1 {
  readonly version: 1;
  readonly progression: ProgressionState;
}

export const DEFAULT_PROGRESSION_STORAGE_KEY = "2d-fps-game:progression";
export const PROGRESSION_STORAGE_VERSION = 1;

export function createProgressionStorage(
  storage: StorageLike,
  key = DEFAULT_PROGRESSION_STORAGE_KEY
): ProgressionStorageAdapter {
  return {
    save(state: ProgressionState): void {
      const payload: ProgressionStoragePayloadV1 = {
        version: PROGRESSION_STORAGE_VERSION,
        progression: state
      };

      storage.setItem(key, JSON.stringify(payload));
    },
    load(): ProgressionState | null {
      const rawValue = storage.getItem(key);

      if (rawValue === null) {
        return null;
      }

      return deserializeProgressionState(rawValue);
    },
    clear(): void {
      storage.removeItem(key);
    }
  };
}

export function serializeProgressionState(state: ProgressionState): string {
  const payload: ProgressionStoragePayloadV1 = {
    version: PROGRESSION_STORAGE_VERSION,
    progression: state
  };

  return JSON.stringify(payload);
}

export function deserializeProgressionState(rawValue: string): ProgressionState | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<ProgressionStoragePayloadV1> | null;

    if (
      parsed === null ||
      parsed.version !== PROGRESSION_STORAGE_VERSION ||
      parsed.progression === undefined
    ) {
      return null;
    }

    const progression = parsed.progression;

    if (
      typeof progression !== "object" ||
      progression === null ||
      !Number.isFinite((progression as ProgressionState).level) ||
      !Number.isFinite((progression as ProgressionState).xp) ||
      !Number.isFinite((progression as ProgressionState).totalXp)
    ) {
      return null;
    }

    return {
      level: Math.max(1, Math.floor((progression as ProgressionState).level)),
      xp: Math.max(0, Math.floor((progression as ProgressionState).xp)),
      totalXp: Math.max(0, Math.floor((progression as ProgressionState).totalXp))
    };
  } catch {
    return null;
  }
}
