import { describe, expect, it } from "vitest";
import { applyVictoryReward, createRewardState, getRankForScore, purchaseRewardItem, resolveVictoryReward, SHOP_ITEMS, VICTORY_SKINS, VICTORY_WEAPONS } from "../src/domain/rewards/VictoryRewardLogic";

describe("VictoryRewardLogic", () => {
  it("awards a short-session score, coins, and ranking points for a win", () => {
    const reward = resolveVictoryReward({ roundsWon: 3, roundsLost: 1, elapsedSeconds: 94 });
    expect(reward.score).toBe(430);
    expect(reward.coins).toBe(43);
    expect(reward.rankPoints).toBe(125);
  });

  it("maps cumulative score to badge ranks", () => {
    expect(getRankForScore(0).id).toBe("bronze");
    expect(getRankForScore(1200).id).toBe("silver");
    expect(getRankForScore(5000).id).toBe("gold");
  });

  it("keeps the reward catalog data-driven for weapons, shop items, and skins", () => {
    expect(VICTORY_WEAPONS.map((item) => item.id)).toEqual(expect.arrayContaining(["tracking-missile", "machine-gun"]));
    expect(SHOP_ITEMS.map((item) => item.id)).toEqual(expect.arrayContaining(["hp-boost", "speed-boost"]));
    expect(VICTORY_SKINS.length).toBeGreaterThanOrEqual(4);
  });

  it("applies a reward without duplicating owned unlocks", () => {
    const next = applyVictoryReward(createRewardState(), { score: 430, coins: 43, rankPoints: 115, newlyUnlocked: ["machine-gun"] });
    expect(next.totalScore).toBe(430);
    expect(next.coins).toBe(43);
    expect(next.ownedWeaponIds).toContain("machine-gun");
    expect(applyVictoryReward(next, { score: 10, coins: 1, rankPoints: 1, newlyUnlocked: ["machine-gun"] }).ownedWeaponIds).toHaveLength(1);
  });

  it("purchases a shop upgrade once and rejects an unaffordable repeat", () => {
    const result = purchaseRewardItem(createRewardState({ coins: 200 }), "hp-boost");
    expect(result.success).toBe(true);
    expect(result.state.coins).toBe(80);
    expect(result.state.purchasedItemIds).toContain("hp-boost");
    expect(purchaseRewardItem(result.state, "hp-boost").success).toBe(false);
  });
});
