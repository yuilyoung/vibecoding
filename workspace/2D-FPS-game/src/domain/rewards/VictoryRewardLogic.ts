export type RankId = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface RankBadge { readonly id: RankId; readonly label: string; readonly minimumScore: number; readonly color: string; }
export interface VictoryRewardInput { readonly roundsWon: number; readonly roundsLost: number; readonly elapsedSeconds: number; }
export interface VictoryReward { readonly score: number; readonly coins: number; readonly rankPoints: number; readonly newlyUnlocked: readonly string[]; }
export interface RewardState { readonly totalScore: number; readonly coins: number; readonly rankPoints: number; readonly ownedWeaponIds: readonly string[]; readonly ownedSkinIds: readonly string[]; readonly purchasedItemIds: readonly string[]; }
export interface RewardWeapon { readonly id: string; readonly label: string; readonly description: string; readonly requiredRank: RankId; }
export interface RewardShopItem { readonly id: string; readonly label: string; readonly description: string; readonly price: number; readonly effect: "max-health" | "movement-speed"; readonly amount: number; }
export interface RewardSkin { readonly id: string; readonly label: string; readonly description: string; readonly requiredRank: RankId; readonly palette: readonly [string, string, string]; }
export interface PurchaseResult { readonly success: boolean; readonly state: RewardState; readonly item: RewardShopItem | null; readonly reason: "PURCHASED" | "ALREADY_OWNED" | "INSUFFICIENT_COINS" | "UNKNOWN_ITEM"; }

export const RANK_BADGES: readonly RankBadge[] = Object.freeze([
  { id: "bronze", label: "Bronze Spark", minimumScore: 0, color: "#c88962" },
  { id: "silver", label: "Silver Star", minimumScore: 1200, color: "#b9d2e2" },
  { id: "gold", label: "Gold Comet", minimumScore: 5000, color: "#ffd166" },
  { id: "platinum", label: "Platinum Pulse", minimumScore: 12000, color: "#8de8ff" },
  { id: "diamond", label: "Diamond Nova", minimumScore: 25000, color: "#d8b4fe" }
]);
export const VICTORY_WEAPONS: readonly RewardWeapon[] = Object.freeze([
  { id: "tracking-missile", label: "Tracking Missile", description: "A friendly lock-on rocket for moving targets.", requiredRank: "silver" },
  { id: "machine-gun", label: "Machine Gun", description: "Fast fire rate with compact damage per shot.", requiredRank: "gold" },
  { id: "prism-beam", label: "Prism Beam", description: "A short, bright beam with a long cooldown.", requiredRank: "platinum" }
]);
export const SHOP_ITEMS: readonly RewardShopItem[] = Object.freeze([
  { id: "hp-boost", label: "Heart Battery", description: "+10 maximum HP", price: 120, effect: "max-health", amount: 10 },
  { id: "speed-boost", label: "Turbo Sneakers", description: "+5% movement speed", price: 160, effect: "movement-speed", amount: 0.05 }
]);
export const VICTORY_SKINS: readonly RewardSkin[] = Object.freeze([
  { id: "bubble-pop", label: "Bubble Pop", description: "A soft candy palette for quick arcade sessions.", requiredRank: "bronze", palette: ["#ff9fbe", "#ffe6a7", "#74d7e8"] },
  { id: "neon-kitten", label: "Neon Kitten", description: "Bright night colors and a playful accent.", requiredRank: "silver", palette: ["#b892ff", "#ff74b8", "#70f0d0"] },
  { id: "sunny-pup", label: "Sunny Pup", description: "Warm yellow, sky blue, and a cheerful badge.", requiredRank: "gold", palette: ["#ffd166", "#79c7ff", "#ff8c69"] },
  { id: "pixel-cloud", label: "Pixel Cloud", description: "A calm pastel skin for relaxed play.", requiredRank: "platinum", palette: ["#d8f3ff", "#9fb8ff", "#c4f1be"] }
]);

export function createRewardState(overrides: Partial<RewardState> = {}): RewardState {
  return { totalScore: 0, coins: 0, rankPoints: 0, ownedWeaponIds: [], ownedSkinIds: ["bubble-pop"], purchasedItemIds: [], ...overrides };
}

export function getRankForScore(score: number): RankBadge {
  const normalized = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  return [...RANK_BADGES].reverse().find((rank) => normalized >= rank.minimumScore) ?? RANK_BADGES[0];
}

export function resolveVictoryReward(input: VictoryRewardInput): VictoryReward {
  const roundsWon = Math.max(1, Math.floor(input.roundsWon));
  const roundsLost = Math.max(0, Math.floor(input.roundsLost));
  const elapsedSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
  const speedBonus = elapsedSeconds <= 90 ? 30 : 0;
  const score = Math.max(100, 150 + roundsWon * 100 - roundsLost * 20 + speedBonus);
  const rankPoints = Math.max(10, 100 + roundsWon * 10 - roundsLost * 5);
  return { score, coins: Math.floor(score / 10), rankPoints, newlyUnlocked: [] };
}

export function applyVictoryReward(state: RewardState, reward: VictoryReward): RewardState {
  const owned = new Set(state.ownedWeaponIds);
  reward.newlyUnlocked.forEach((id) => owned.add(id));
  return { ...state, totalScore: state.totalScore + Math.max(0, reward.score), coins: state.coins + Math.max(0, reward.coins), rankPoints: state.rankPoints + Math.max(0, reward.rankPoints), ownedWeaponIds: [...owned] };
}

export function purchaseRewardItem(state: RewardState, itemId: string): PurchaseResult {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId) ?? null;
  if (item === null) return { success: false, state, item: null, reason: "UNKNOWN_ITEM" };
  if (state.purchasedItemIds.includes(item.id)) return { success: false, state, item, reason: "ALREADY_OWNED" };
  if (state.coins < item.price) return { success: false, state, item, reason: "INSUFFICIENT_COINS" };
  return { success: true, state: { ...state, coins: state.coins - item.price, purchasedItemIds: [...state.purchasedItemIds, item.id] }, item, reason: "PURCHASED" };
}
