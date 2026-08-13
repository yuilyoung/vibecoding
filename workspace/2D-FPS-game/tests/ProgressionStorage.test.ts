import {
  createProgressionStorage,
  deserializeProgressionState,
  PROGRESSION_STORAGE_VERSION,
  serializeProgressionState
} from "../src/domain/progression/ProgressionStorage";

describe("ProgressionStorage", () => {
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

  it("saves, loads, and clears progression data through a localStorage-like adapter", () => {
    const memoryStorage = createMemoryStorage();
    const adapter = createProgressionStorage(memoryStorage, "progression:test");
    const state = {
      level: 3,
      xp: 10,
      totalXp: 260
    } as const;

    adapter.save(state);

    expect(memoryStorage.getItem("progression:test")).toBe(
      serializeProgressionState(state)
    );
    expect(adapter.load()).toEqual(state);

    adapter.clear();

    expect(adapter.load()).toBeNull();
    expect(memoryStorage.getItem("progression:test")).toBeNull();
  });

  it("includes a schema version in the serialized payload", () => {
    const payload = JSON.parse(
      serializeProgressionState({
        level: 2,
        xp: 5,
        totalXp: 105
      })
    ) as {
      version: number;
      progression: {
        level: number;
        xp: number;
        totalXp: number;
      };
    };

    expect(payload.version).toBe(PROGRESSION_STORAGE_VERSION);
    expect(payload.progression).toEqual({
      level: 2,
      xp: 5,
      totalXp: 105
    });
  });

  it("rejects invalid or mismatched payloads", () => {
    expect(deserializeProgressionState("not-json")).toBeNull();
    expect(
      deserializeProgressionState(
        JSON.stringify({
          version: 2,
          progression: {
            level: 2,
            xp: 5,
            totalXp: 105
          }
        })
      )
    ).toBeNull();
    expect(
      deserializeProgressionState(
        JSON.stringify({
          version: PROGRESSION_STORAGE_VERSION,
          progression: {
            level: "bad",
            xp: 5,
            totalXp: 105
          }
        })
      )
    ).toBeNull();
  });
});
