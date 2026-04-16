export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SettingsState {
  masterVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  tutorialDismissed: boolean;
}

export interface SettingsStorageAdapter {
  save(state: SettingsState): void;
  load(): SettingsState | null;
  clear(): void;
}

interface SettingsStoragePayloadV1 {
  readonly version: 1;
  readonly settings: SettingsState;
}

export const DEFAULT_SETTINGS_STORAGE_KEY = "2d-fps-game:settings";
export const SETTINGS_STORAGE_VERSION = 1;

export const DEFAULT_SETTINGS: SettingsState = {
  masterVolume: 1,
  sfxVolume: 1,
  mouseSensitivity: 1,
  tutorialDismissed: false
};

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;
const MIN_MOUSE_SENSITIVITY = 0.1;
const MAX_MOUSE_SENSITIVITY = 5;

export function createSettingsStorage(
  storage: StorageLike,
  key = DEFAULT_SETTINGS_STORAGE_KEY
): SettingsStorageAdapter {
  return {
    save(state: SettingsState): void {
      const payload: SettingsStoragePayloadV1 = {
        version: SETTINGS_STORAGE_VERSION,
        settings: normalizeSettings(state)
      };

      storage.setItem(key, JSON.stringify(payload));
    },
    load(): SettingsState | null {
      const rawValue = storage.getItem(key);

      if (rawValue === null) {
        return null;
      }

      return deserializeSettingsState(rawValue);
    },
    clear(): void {
      storage.removeItem(key);
    }
  };
}

export function serializeSettingsState(state: SettingsState): string {
  const payload: SettingsStoragePayloadV1 = {
    version: SETTINGS_STORAGE_VERSION,
    settings: normalizeSettings(state)
  };

  return JSON.stringify(payload);
}

export function deserializeSettingsState(rawValue: string): SettingsState | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<SettingsStoragePayloadV1> | null;

    if (
      parsed === null ||
      parsed.version !== SETTINGS_STORAGE_VERSION ||
      parsed.settings === undefined
    ) {
      return null;
    }

    const settings = parsed.settings;

    if (typeof settings !== "object" || settings === null) {
      return null;
    }

    return normalizeSettings(settings as Partial<SettingsState>);
  } catch {
    return null;
  }
}

function normalizeSettings(state: Partial<SettingsState>): SettingsState {
  return {
    masterVolume: clampVolume(state.masterVolume, DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clampVolume(state.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    mouseSensitivity: clampMouseSensitivity(
      state.mouseSensitivity,
      DEFAULT_SETTINGS.mouseSensitivity
    ),
    tutorialDismissed: state.tutorialDismissed === true
  };
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.fround(value), MIN_VOLUME, MAX_VOLUME);
}

function clampMouseSensitivity(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.fround(value), MIN_MOUSE_SENSITIVITY, MAX_MOUSE_SENSITIVITY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
