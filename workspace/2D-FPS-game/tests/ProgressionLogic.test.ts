import {
  addXp,
  awardKillXp,
  awardRoundClearXp,
  createProgressionState,
  getXpRequiredForNextLevel,
  isMaxLevel
} from "../src/domain/progression/ProgressionLogic";

describe("ProgressionLogic", () => {
  const config = {
    xpPerKill: 25,
    xpPerRoundClear: 80,
    levelCurve: [100, 150, 200]
  } as const;

  it("creates a normalized default progression state", () => {
    expect(createProgressionState()).toEqual({
      level: 1,
      xp: 0,
      totalXp: 0
    });
  });

  it("adds XP, carries overflow, and records the number of levels gained", () => {
    const result = addXp(createProgressionState(), 260, config);

    expect(result.state).toEqual({
      level: 3,
      xp: 10,
      totalXp: 260
    });
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(2);
  });

  it("awards kill and round-clear XP using the balance config", () => {
    const killResult = awardKillXp(createProgressionState(), config);
    const roundResult = awardRoundClearXp(killResult.state, config);

    expect(killResult.state).toEqual({
      level: 1,
      xp: 25,
      totalXp: 25
    });
    expect(roundResult.state).toEqual({
      level: 2,
      xp: 5,
      totalXp: 105
    });
    expect(roundResult.leveledUp).toBe(true);
  });

  it("stops leveling when the curve is exhausted but still tracks total XP", () => {
    const state = createProgressionState({ level: 4, xp: 190, totalXp: 540 });
    const result = addXp(state, 50, config);

    expect(result.state).toEqual({
      level: 4,
      xp: 240,
      totalXp: 590
    });
    expect(result.leveledUp).toBe(false);
    expect(result.levelsGained).toBe(0);
    expect(getXpRequiredForNextLevel(result.state, config)).toBeNull();
    expect(isMaxLevel(result.state, config)).toBe(true);
  });
});
