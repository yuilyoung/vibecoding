import { getRankForScore, type RankId } from "./VictoryRewardLogic";

export interface LeaderboardEntry { readonly id: string; readonly name: string; readonly score: number; readonly rank: RankId; }
export interface LeaderboardState { readonly entries: readonly LeaderboardEntry[]; }

export function createLeaderboardState(entries: readonly LeaderboardEntry[] = []): LeaderboardState {
  return { entries: normalizeEntries(entries) };
}

export function submitLeaderboardScore(state: LeaderboardState, input: { readonly id: string; readonly name: string; readonly score: number }): LeaderboardState {
  const withoutPlayer = state.entries.filter((entry) => entry.id !== input.id);
  const score = Math.max(0, Math.floor(Number.isFinite(input.score) ? input.score : 0));
  return { entries: normalizeEntries([...withoutPlayer, { id: input.id, name: input.name.trim() || "PLAYER", score, rank: getRankForScore(score).id }]) };
}

export function getLeaderboardPosition(state: LeaderboardState, id: string): number | null {
  const index = state.entries.findIndex((entry) => entry.id === id);
  return index < 0 ? null : index + 1;
}

function normalizeEntries(entries: readonly LeaderboardEntry[]): readonly LeaderboardEntry[] {
  return [...entries].map((entry) => ({ ...entry, score: Math.max(0, Math.floor(entry.score)), rank: getRankForScore(entry.score).id })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 10);
}
