import gameBalance from "../assets/data/game-balance.json";
import {
  createBossSpawn,
  resolveBossReward,
  shouldSpawnBoss
} from "../src/domain/round/BossWaveLogic";
import type { BossWaveRules } from "../src/domain/round/BossWaveLogic";
import type { StageDefinition } from "../src/domain/map/StageDefinition";

const stages = gameBalance.stages as readonly StageDefinition[];

describe("BossWaveLogic", () => {
  it("spawns bosses on the configured first round and interval", () => {
    const rules: BossWaveRules = {
      intervalRounds: 5,
      firstBossRound: 5,
      bossName: "Titan",
      bossHealth: 4200,
      bossSpeed: 180,
      rewardExperience: 1200
    };

    expect(shouldSpawnBoss(4, rules)).toBe(false);
    expect(shouldSpawnBoss(5, rules)).toBe(true);
    expect(shouldSpawnBoss(6, rules)).toBe(false);
    expect(shouldSpawnBoss(10, rules)).toBe(true);
  });

  it("creates a stable boss spawn plan from the current stage", () => {
    const rules: BossWaveRules = {
      intervalRounds: 5,
      firstBossRound: 5,
      bossName: "Titan",
      bossHealth: 4200,
      bossSpeed: 180,
      rewardExperience: 1200,
      rewardUnlockWeaponId: "air-strike",
      rewardLabel: "Titan Down",
      spawnLabel: "Titan Lair"
    };

    const plan = createBossSpawn(stages[0], rules);

    expect(plan).toEqual({
      stageId: "foundry",
      stageLabel: "Foundry",
      intervalRounds: 5,
      firstBossRound: 5,
      spawn: {
        x: 483,
        y: 233,
        label: "Titan Lair"
      },
      boss: {
        name: "Titan",
        health: 4200,
        speed: 180
      },
      reward: {
        experience: 1200,
        unlockWeaponId: "air-strike",
        label: "Titan Down"
      }
    });
  });

  it("normalizes the boss reward payload", () => {
    const reward = resolveBossReward({
      intervalRounds: 3,
      bossName: "  Boss King  ",
      bossHealth: 1,
      bossSpeed: 1,
      rewardExperience: 1199.8,
      rewardUnlockWeaponId: "  bazooka  ",
      rewardLabel: "  Victory Cache  "
    });

    expect(reward).toEqual({
      experience: 1199,
      unlockWeaponId: "bazooka",
      label: "Victory Cache"
    });
  });
});
