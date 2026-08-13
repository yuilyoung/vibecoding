export interface ProgressionConfig {
  readonly xpPerKill: number;
  readonly xpPerRoundClear: number;
  readonly levelCurve: readonly number[];
}

export interface ProgressionState {
  readonly level: number;
  readonly xp: number;
  readonly totalXp: number;
}

export interface ProgressionGainResult {
  readonly state: ProgressionState;
  readonly leveledUp: boolean;
  readonly levelsGained: number;
}

export const DEFAULT_PROGRESSION_STATE: ProgressionState = {
  level: 1,
  xp: 0,
  totalXp: 0
};

export function createProgressionState(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return normalizeProgressionState({
    ...DEFAULT_PROGRESSION_STATE,
    ...overrides
  });
}

export function addXp(
  state: ProgressionState,
  amount: number,
  config: ProgressionConfig
): ProgressionGainResult {
  const normalizedState = normalizeProgressionState(state);
  const xpAwarded = normalizeXpAmount(amount);

  if (xpAwarded === 0) {
    return {
      state: normalizedState,
      leveledUp: false,
      levelsGained: 0
    };
  }

  let nextLevel = normalizedState.level;
  let currentXp = normalizedState.xp + xpAwarded;
  let levelsGained = 0;

  while (true) {
    const xpRequired = getXpRequiredForLevel(nextLevel, config.levelCurve);

    if (xpRequired === null || currentXp < xpRequired) {
      break;
    }

    currentXp -= xpRequired;
    nextLevel += 1;
    levelsGained += 1;
  }

  return {
    state: {
      level: nextLevel,
      xp: currentXp,
      totalXp: normalizedState.totalXp + xpAwarded
    },
    leveledUp: levelsGained > 0,
    levelsGained
  };
}

export function awardKillXp(state: ProgressionState, config: ProgressionConfig): ProgressionGainResult {
  return addXp(state, config.xpPerKill, config);
}

export function awardRoundClearXp(state: ProgressionState, config: ProgressionConfig): ProgressionGainResult {
  return addXp(state, config.xpPerRoundClear, config);
}

export function getXpRequiredForNextLevel(state: ProgressionState, config: ProgressionConfig): number | null {
  const normalizedState = normalizeProgressionState(state);
  return getXpRequiredForLevel(normalizedState.level, config.levelCurve);
}

export function isMaxLevel(state: ProgressionState, config: ProgressionConfig): boolean {
  return getXpRequiredForNextLevel(state, config) === null;
}

function getXpRequiredForLevel(level: number, levelCurve: readonly number[]): number | null {
  const index = Math.max(0, Math.floor(level) - 1);
  if (index < 0 || index >= levelCurve.length) {
    return null;
  }

  return normalizeThreshold(levelCurve[index]);
}

function normalizeProgressionState(state: ProgressionState): ProgressionState {
  return {
    level: Math.max(1, Math.floor(Number.isFinite(state.level) ? state.level : 1)),
    xp: normalizeXpAmount(state.xp),
    totalXp: normalizeXpAmount(state.totalXp)
  };
}

function normalizeXpAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.floor(amount);
}

function normalizeThreshold(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 1;
  }

  return Math.max(1, Math.floor(amount));
}
