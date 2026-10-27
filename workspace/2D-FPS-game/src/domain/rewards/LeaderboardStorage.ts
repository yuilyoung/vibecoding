import type { StorageLike } from "../progression/ProgressionStorage";
import { createLeaderboardState, type LeaderboardState } from "./LeaderboardLogic";

export interface LeaderboardStorageAdapter { save(state: LeaderboardState): void; load(): LeaderboardState | null; }

export function createLeaderboardStorage(storage: StorageLike, key = "2d-fps-game:leaderboard"): LeaderboardStorageAdapter {
  return { save: (state) => storage.setItem(key, JSON.stringify({ version: 1, leaderboard: state })), load: () => deserializeLeaderboard(storage.getItem(key)) };
}

function deserializeLeaderboard(raw: string | null): LeaderboardState | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; leaderboard?: LeaderboardState };
    return parsed.version === 1 && parsed.leaderboard?.entries !== undefined ? createLeaderboardState(parsed.leaderboard.entries) : null;
  } catch { return null; }
}
