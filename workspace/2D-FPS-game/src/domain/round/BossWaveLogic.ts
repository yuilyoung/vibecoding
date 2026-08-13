import type { StageDefinition } from "../map/StageDefinition";

export interface BossWaveRules {
  readonly intervalRounds: number;
  readonly firstBossRound?: number;
  readonly bossName: string;
  readonly bossHealth: number;
  readonly bossSpeed: number;
  readonly rewardExperience: number;
  readonly rewardUnlockWeaponId?: string;
  readonly rewardLabel?: string;
  readonly spawnLabel?: string;
}

export interface BossWaveReward {
  readonly experience: number;
  readonly unlockWeaponId: string | null;
  readonly label: string;
}

export interface BossSpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface BossWaveSpawnPlan {
  readonly stageId: string;
  readonly stageLabel: string;
  readonly intervalRounds: number;
  readonly firstBossRound: number;
  readonly spawn: BossSpawnPoint;
  readonly boss: BossWaveBossDefinition;
  readonly reward: BossWaveReward;
}

export interface BossWaveBossDefinition {
  readonly name: string;
  readonly health: number;
  readonly speed: number;
}

export function shouldSpawnBoss(roundIndex: number, rules: BossWaveRules): boolean {
  const intervalRounds = normalizePositiveInteger(rules.intervalRounds);

  if (intervalRounds === 0) {
    return false;
  }

  const firstBossRound = normalizePositiveInteger(rules.firstBossRound ?? intervalRounds, intervalRounds, 1);
  const currentRound = normalizePositiveInteger(roundIndex);

  if (currentRound < firstBossRound) {
    return false;
  }

  return (currentRound - firstBossRound) % intervalRounds === 0;
}

export function createBossSpawn(stage: StageDefinition, rules: BossWaveRules): BossWaveSpawnPlan {
  const intervalRounds = normalizePositiveInteger(rules.intervalRounds, 1, 1);
  const firstBossRound = normalizePositiveInteger(rules.firstBossRound ?? intervalRounds, intervalRounds, 1);

  return {
    stageId: stage.id,
    stageLabel: stage.label,
    intervalRounds,
    firstBossRound,
    spawn: resolveBossSpawnPoint(stage, rules),
    boss: {
      name: normalizeLabel(rules.bossName, "Boss"),
      health: normalizePositiveInteger(rules.bossHealth, 1, 1),
      speed: normalizePositiveInteger(rules.bossSpeed, 1)
    },
    reward: resolveBossReward(rules)
  };
}

export function resolveBossReward(rules: BossWaveRules): BossWaveReward {
  const rewardExperience = normalizePositiveInteger(rules.rewardExperience);

  return {
    experience: rewardExperience,
    unlockWeaponId: normalizeOptionalId(rules.rewardUnlockWeaponId),
    label: normalizeLabel(rules.rewardLabel, `${normalizeLabel(rules.bossName, "Boss")} DOWN`)
  };
}

function resolveBossSpawnPoint(stage: StageDefinition, rules: BossWaveRules): BossSpawnPoint {
  const spawnPoints = [...stage.blueSpawns, ...stage.redSpawns];

  if (spawnPoints.length === 0) {
    return {
      x: 0,
      y: 0,
      label: normalizeLabel(rules.spawnLabel, `${stage.label} Boss Lair`)
    };
  }

  const total = spawnPoints.reduce(
    (accumulator, spawnPoint) => ({
      x: accumulator.x + spawnPoint.x,
      y: accumulator.y + spawnPoint.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: Math.round(total.x / spawnPoints.length),
    y: Math.round(total.y / spawnPoints.length),
    label: normalizeLabel(rules.spawnLabel, `${stage.label} Boss Lair`)
  };
}

function normalizePositiveInteger(value: number, fallback = 0, minimum = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function normalizeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
