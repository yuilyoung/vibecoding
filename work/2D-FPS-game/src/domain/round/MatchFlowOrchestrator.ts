import type { StageDefinition } from "../map/StageDefinition";
import type { BossWaveRules, BossWaveSpawnPlan } from "./BossWaveLogic";
import type { MatchFlowPhase, TeamId } from "./MatchFlowLogic";

export interface StageFlowInput {
  readonly phase: MatchFlowPhase;
  readonly selectedTeam: TeamId | null;
  readonly confirmPressed: boolean;
  readonly selectBluePressed: boolean;
  readonly selectRedPressed: boolean;
  readonly roundStarting: boolean;
}

export interface StageFlowDecision {
  readonly enterStage: boolean;
  readonly previewTeam: TeamId | null;
  readonly confirmDeployment: boolean;
  readonly startCombat: boolean;
  readonly combatEvent: string | null;
}

export interface RoundResetPlan {
  readonly clearBullets: boolean;
  readonly matchConfirmAtMs: number | null;
  readonly matchConfirmReadyCueSent: boolean;
  readonly roundResetAtMs: number | null;
  readonly combatEvent: string | null;
}

export interface BossWaveOverlayDecision {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
  readonly combatEvent: string | null;
}

export interface WindStateLike {
  readonly angleDegrees: number;
  readonly strength: number;
}

export interface WindConfigLike {
  readonly enabled: boolean;
  readonly strengthRange: readonly [number, number];
  readonly angleStepDegrees: number;
  readonly rotationMode: string;
  readonly defaultMultiplier: number;
  readonly forceScale: number;
}

export interface RoundStartWindInput {
  readonly stage: StageDefinition;
  readonly previousWind: WindStateLike | null;
  readonly rng: () => number;
  readonly windConfig: WindConfigLike;
}

export interface RoundSnapshot<TWind extends WindStateLike = WindStateLike> {
  readonly wind: TWind;
}

export interface RoundStartWindDecision<TWind extends WindStateLike = WindStateLike> {
  readonly wind: TWind;
  readonly snapshot: RoundSnapshot<TWind>;
  readonly source: "stage-override" | "rotation";
}

export function resolveStageFlow(input: StageFlowInput): StageFlowDecision {
  if (input.phase === "stage-entry") {
    if (!input.confirmPressed) {
      return idleStageFlowDecision();
    }

    return {
      enterStage: true,
      previewTeam: "BLUE",
      confirmDeployment: false,
      startCombat: false,
      combatEvent: "SELECT TEAM: 1 BLUE / 2 RED"
    };
  }

  if (input.phase === "team-select") {
    if (input.selectBluePressed) {
      return {
        enterStage: false,
        previewTeam: "BLUE",
        confirmDeployment: false,
        startCombat: false,
        combatEvent: "TEAM PREVIEW BLUE"
      };
    }

    if (input.selectRedPressed) {
      return {
        enterStage: false,
        previewTeam: "RED",
        confirmDeployment: false,
        startCombat: false,
        combatEvent: "TEAM PREVIEW RED"
      };
    }

    if (input.confirmPressed && input.selectedTeam !== null) {
      return {
        enterStage: false,
        previewTeam: null,
        confirmDeployment: true,
        startCombat: false,
        combatEvent: `DEPLOYING ${input.selectedTeam}`
      };
    }
  }

  if (input.phase === "deploying" && !input.roundStarting) {
    return {
      enterStage: false,
      previewTeam: null,
      confirmDeployment: false,
      startCombat: true,
      combatEvent: "COMBAT LIVE"
    };
  }

  return idleStageFlowDecision();
}

export function planRoundReset(input: {
  readonly isMatchOver: boolean;
  readonly matchWinner: string | null;
  readonly now: number;
  readonly matchResetDelayMs: number;
  readonly respawnDelayMs: number;
}): RoundResetPlan {
  if (input.isMatchOver) {
    return {
      clearBullets: true,
      matchConfirmAtMs: input.now + input.matchResetDelayMs,
      matchConfirmReadyCueSent: false,
      roundResetAtMs: null,
      combatEvent: `${input.matchWinner ?? "MATCH"} LOCKED`
    };
  }

  return {
    clearBullets: true,
    matchConfirmAtMs: null,
    matchConfirmReadyCueSent: false,
    roundResetAtMs: input.now + input.respawnDelayMs,
    combatEvent: null
  };
}

export function resolveBossWaveOverlay(input: {
  readonly roundNumber: number;
  readonly stage: StageDefinition | null;
  readonly bossWaveRules: BossWaveRules | null;
  readonly bossWavePlan: BossWaveSpawnPlan | null;
}): BossWaveOverlayDecision {
  if (input.stage === null || input.bossWaveRules === null || input.bossWavePlan === null) {
    return idleBossWaveOverlayDecision();
  }

  if (!isBossWaveRound(input.roundNumber, input.bossWavePlan)) {
    return idleBossWaveOverlayDecision();
  }

  const bossName = input.bossWavePlan.boss.name;

  return {
    visible: true,
    title: "BOSS WAVE",
    subtitle: `${bossName} incoming. HP ${input.bossWavePlan.boss.health}. Reward ${input.bossWavePlan.reward.label}.`,
    combatEvent: `${bossName.toUpperCase()} WAVE`
  };
}

function idleStageFlowDecision(): StageFlowDecision {
  return {
    enterStage: false,
    previewTeam: null,
    confirmDeployment: false,
    startCombat: false,
    combatEvent: null
  };
}

function idleBossWaveOverlayDecision(): BossWaveOverlayDecision {
  return {
    visible: false,
    title: "",
    subtitle: "",
    combatEvent: null
  };
}

function isBossWaveRound(roundNumber: number, plan: BossWaveSpawnPlan): boolean {
  if (roundNumber < plan.firstBossRound) {
    return false;
  }

  return (roundNumber - plan.firstBossRound) % plan.intervalRounds === 0;
}

export function resolveRoundStartWind<TWind extends WindStateLike = WindStateLike>(
  input: RoundStartWindInput & {
    readonly createWindState: (wind: WindStateLike) => TWind;
    readonly rotateWind: (previous: WindStateLike | null, rng: () => number, config: WindConfigLike) => TWind;
  }
): RoundStartWindDecision<TWind> {
  const stageWind = readStageWindOverride(input.stage);
  if (stageWind !== null) {
    const wind = input.createWindState(stageWind);

    return {
      wind,
      snapshot: createRoundSnapshot({ wind }),
      source: "stage-override"
    };
  }

  const wind = input.rotateWind(input.previousWind, input.rng, input.windConfig);

  return {
    wind,
    snapshot: createRoundSnapshot({ wind }),
    source: "rotation"
  };
}

export function createRoundSnapshot<TWind extends WindStateLike>(input: {
  readonly wind: TWind;
}): RoundSnapshot<TWind> {
  return {
    wind: input.wind
  };
}

function readStageWindOverride(stage: StageDefinition): WindStateLike | null {
  const candidate = (stage as StageDefinition & {
    readonly wind?: Partial<WindStateLike> | null;
  }).wind;

  if (
    candidate === undefined ||
    candidate === null ||
    typeof candidate.angleDegrees !== "number" ||
    typeof candidate.strength !== "number"
  ) {
    return null;
  }

  return {
    angleDegrees: candidate.angleDegrees,
    strength: candidate.strength
  };
}
