import { describe, expect, it } from "vitest";
import { createLeaderboardState, getLeaderboardPosition, submitLeaderboardScore } from "../src/domain/rewards/LeaderboardLogic";

describe("LeaderboardLogic", () => {
  it("sorts scores, derives badges, and keeps the player in the top ten", () => {
    const state = submitLeaderboardScore(createLeaderboardState([
      { id: "bot", name: "Mochi", score: 1200, rank: "silver" }
    ]), { id: "player", name: "YOU", score: 5000 });
    expect(state.entries[0]).toMatchObject({ id: "player", rank: "gold" });
    expect(getLeaderboardPosition(state, "player")).toBe(1);
  });

  it("updates an existing player entry instead of duplicating it", () => {
    const first = submitLeaderboardScore(createLeaderboardState(), { id: "player", name: "YOU", score: 100 });
    const second = submitLeaderboardScore(first, { id: "player", name: "YOU", score: 900 });
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].score).toBe(900);
  });
});
