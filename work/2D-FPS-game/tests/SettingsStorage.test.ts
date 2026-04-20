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
      mouseSensitivity: 2.5,
      tutorialDismissed: true
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
        mouseSensitivity: 1.5,
        tutorialDismissed: true
      })
    ) as {
      version: number;
      settings: {
        masterVolume: number;
        sfxVolume: number;
        mouseSensitivity: number;
        tutorialDismissed: boolean;
      };
    };

    expect(payload.version).toBe(SETTINGS_STORAGE_VERSION);
    expect(payload.settings).toEqual({
      masterVolume: 0.5,
      sfxVolume: 0.25,
      mouseSensitivity: 1.5,
      tutorialDismissed: true
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
            mouseSensitivity: 0.01,
            tutorialDismissed: true
          }
        })
      )
    ).toEqual({
      masterVolume: 1,
      sfxVolume: 0,
      mouseSensitivity: 0.1,
      tutorialDismissed: true
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

  describe("edge cases (Phase 3 QA audit)", () => {
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

    it("returns null (caller falls back to defaults) for malformed JSON without throwing", () => {
      // Documents actual behavior: load() returns null on corrupted JSON,
      // and the caller (SettingsPanel/MainScene) substitutes DEFAULT_SETTINGS.
      const corruptedPayloads = ["not a json", "[1,2,3]", "42", "null", '"string"', ""];

      for (const raw of corruptedPayloads) {
        const memoryStorage = createMemoryStorage();
        memoryStorage.setItem("settings:test", raw);
        const adapter = createSettingsStorage(memoryStorage, "settings:test");

        expect(() => adapter.load()).not.toThrow();
        expect(adapter.load()).toBeNull();
      }
    });

    it("swallows quota-exceeded errors from save() so the settings flow keeps running", () => {
      const throwingStorage = {
        getItem(): string | null {
          return null;
        },
        setItem(): void {
          const error = new Error("QuotaExceededError");
          error.name = "QuotaExceededError";
          throw error;
        },
        removeItem(): void {}
      };

      const adapter = createSettingsStorage(throwingStorage, "settings:test");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() =>
        adapter.save({
          masterVolume: 0.5,
          sfxVolume: 0.5,
          mouseSensitivity: 1,
          tutorialDismissed: false
        })
      ).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith("[SettingsStorage] save failed:", expect.any(Error));

      warnSpy.mockRestore();
    });

    it("rejects payloads missing the version field", () => {
      expect(
        deserializeSettingsState(
          JSON.stringify({
            settings: { masterVolume: 0.5, sfxVolume: 0.5, mouseSensitivity: 1, tutorialDismissed: false }
          })
        )
      ).toBeNull();
    });

    it("normalizes Infinity, NaN, and negative volume to defaults or clamped values", () => {
      const result = deserializeSettingsState(
        JSON.stringify({
          version: SETTINGS_STORAGE_VERSION,
          settings: {
            masterVolume: Number.POSITIVE_INFINITY,
            sfxVolume: Number.NaN,
            mouseSensitivity: -10,
            tutorialDismissed: false
          }
        })
      );

      // Infinity / NaN serialize to null in JSON → fall back to defaults.
      expect(result).not.toBeNull();
      expect(result?.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
      expect(result?.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
      // Negative values are clamped to the minimum.
      expect(result?.mouseSensitivity).toBeCloseTo(0.1, 5);
    });

    it("rejects negative volume passed directly to the in-memory normalizer path", () => {
      const memoryStorage = createMemoryStorage();
      const adapter = createSettingsStorage(memoryStorage, "settings:test");

      adapter.save({
        masterVolume: -5,
        sfxVolume: -0.1,
        mouseSensitivity: 1,
        tutorialDismissed: false
      });

      const loaded = adapter.load();
      expect(loaded?.masterVolume).toBe(0);
      expect(loaded?.sfxVolume).toBe(0);
    });
  });
});
