import type { StorageLike } from "../progression/ProgressionStorage";
import { createRewardState, type RewardState } from "./VictoryRewardLogic";

export interface RewardStorageAdapter { save(state: RewardState): void; load(): RewardState | null; clear(): void; }
const VERSION = 1;

export function createRewardStorage(storage: StorageLike, key = "2d-fps-game:rewards"): RewardStorageAdapter {
  return {
    save: (state) => storage.setItem(key, JSON.stringify({ version: VERSION, rewards: state })),
    load: () => deserializeRewardState(storage.getItem(key)),
    clear: () => storage.removeItem(key)
  };
}

export function deserializeRewardState(raw: string | null): RewardState | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; rewards?: Partial<RewardState> };
    const rewards = parsed.rewards;
    if (parsed.version !== VERSION || rewards === undefined || typeof rewards !== "object" || rewards === null) return null;
    return createRewardState({
      totalScore: finiteInteger(rewards.totalScore),
      coins: finiteInteger(rewards.coins),
      rankPoints: finiteInteger(rewards.rankPoints),
      ownedWeaponIds: cleanIds(rewards.ownedWeaponIds),
      ownedSkinIds: cleanIds(rewards.ownedSkinIds),
      purchasedItemIds: cleanIds(rewards.purchasedItemIds)
    });
  } catch { return null; }
}

function finiteInteger(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
function cleanIds(value: unknown): readonly string[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))] : []; }
