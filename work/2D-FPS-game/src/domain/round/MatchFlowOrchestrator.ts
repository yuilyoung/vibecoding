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

function idleStageFlowDecision(): StageFlowDecision {
  return {
    enterStage: false,
    previewTeam: null,
    confirmDeployment: false,
    startCombat: false,
    combatEvent: null
  };
}
