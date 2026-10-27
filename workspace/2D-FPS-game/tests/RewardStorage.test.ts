import { describe, expect, it } from "vitest";
import { createRewardStorage, deserializeRewardState } from "../src/domain/rewards/RewardStorage";
import { createRewardState } from "../src/domain/rewards/VictoryRewardLogic";
import type { StorageLike } from "../src/domain/progression/ProgressionStorage";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

describe("RewardStorage", () => {
  it("round-trips reward state and removes duplicate ids", () => {
    const storage = createRewardStorage(memoryStorage());
    storage.save(createRewardState({ totalScore: 430, coins: 43, ownedWeaponIds: ["machine-gun", "machine-gun"] }));
    expect(storage.load()).toMatchObject({ totalScore: 430, coins: 43, ownedWeaponIds: ["machine-gun"] });
  });

  it("rejects malformed payloads", () => {
    expect(deserializeRewardState("not-json")).toBeNull();
    expect(deserializeRewardState(JSON.stringify({ version: 99, rewards: {} }))).toBeNull();
  });
});
