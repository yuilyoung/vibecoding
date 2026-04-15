import {
  createSettingsStorage,
  DEFAULT_SETTINGS,
  deserializeSettingsState,
  SETTINGS_STORAGE_VERSION,
  serializeSettingsState
} from "../src/domain/settings/SettingsStorage";

describe("SettingsStorage", () => {
  function createMemoryStorage() {
    const entries = new Map<string, string>();

    return {
      getItem(key: string): string | null {
        return entries.has(key) ? entries.get(key) ?? null : null;
      },
      setItem(key: string, value: string): void {
        entries.set(key, value);
      },
      removeItem(key: string): void {
        entries.delete(key);
      }
    };
  }

  it("saves, loads, and clears settings through a localStorage-like adapter", () => {
    const memoryStorage = createMemoryStorage();
    const adapter = createSettingsStorage(memoryStorage, "settings:test");
    const state = {
      masterVolume: 0.75,
      sfxVolume: 0.25,
      mouseSensitivity: 2.5
    } as const;

    adapter.save(state);

    expect(memoryStorage.getItem("settings:test")).toBe(serializeSettingsState(state));
    expect(adapter.load()).toEqual(state);

    adapter.clear();

    expect(adapter.load()).toBeNull();
    expect(memoryStorage.getItem("settings:test")).toBeNull();
  });

  it("includes a schema version in the serialized payload", () => {
    const payload = JSON.parse(
      serializeSettingsState({
        masterVolume: 0.5,
        sfxVolume: 0.25,
        mouseSensitivity: 1.5
      })
    ) as {
      version: number;
      settings: {
        masterVolume: number;
        sfxVolume: number;
        mouseSensitivity: number;
      };
    };

    expect(payload.version).toBe(SETTINGS_STORAGE_VERSION);
    expect(payload.settings).toEqual({
      masterVolume: 0.5,
      sfxVolume: 0.25,
      mouseSensitivity: 1.5
    });
  });

  it("normalizes invalid values to defaults and clamps out-of-range values", () => {
    expect(
      deserializeSettingsState(
        JSON.stringify({
          version: SETTINGS_STORAGE_VERSION,
          settings: {
            masterVolume: 9,
            sfxVolume: -1,
            mouseSensitivity: 0.01
          }
        })
      )
    ).toEqual({
      masterVolume: 1,
      sfxVolume: 0,
      mouseSensitivity: 0.1
    });

    expect(
      deserializeSettingsState(
        JSON.stringify({
          version: SETTINGS_STORAGE_VERSION,
          settings: {
            masterVolume: "bad",
            sfxVolume: null,
            mouseSensitivity: undefined
          }
        })
      )
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects invalid or mismatched payloads", () => {
    expect(deserializeSettingsState("not-json")).toBeNull();
    expect(
      deserializeSettingsState(
        JSON.stringify({
          version: 2,
          settings: {
            masterVolume: 0.5,
            sfxVolume: 0.25,
            mouseSensitivity: 1.5
          }
        })
      )
    ).toBeNull();
    expect(
      deserializeSettingsState(
        JSON.stringify({
          version: SETTINGS_STORAGE_VERSION,
          settings: null
        })
      )
    ).toBeNull();
  });
});
