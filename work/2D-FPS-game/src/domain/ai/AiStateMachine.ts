export type AiState = "idle" | "pressure" | "hold" | "retreat" | "flank";

export interface AiStateMachineConfig {
  readonly engageRange: number;
  readonly preferredHoldRange: number;
  readonly flankRange: number;
  readonly retreatRange: number;
  readonly lowHealthThreshold: number;
  readonly coverHealthThreshold: number;
  readonly flankCommitMs: number;
  readonly intentCooldownMs: number;
  readonly weatherCautionVisionMultiplier: number;
}

export interface AiStateMachineInput {
  readonly currentState: AiState;
  readonly distanceToTarget: number;
  readonly healthRatio: number;
  readonly hasLineOfSight: boolean;
  readonly hasCoverAvailable: boolean;
  readonly effectiveVisionRange?: number;
  readonly nowMs: number;
  readonly stateEnteredAtMs: number;
}

export class AiStateMachine {
  private readonly config: AiStateMachineConfig;

  public constructor(config: AiStateMachineConfig) {
    this.config = config;
  }

  public evaluate(input: AiStateMachineInput): AiState {
    const desiredState = this.resolveDesiredState(input);

    if (desiredState === "retreat" || desiredState === input.currentState) {
      return desiredState;
    }

    const elapsedMs = Math.max(0, input.nowMs - input.stateEnteredAtMs);
    if (input.currentState === "flank" && elapsedMs < this.config.flankCommitMs) {
      return "flank";
    }

    if (input.currentState !== "idle" && elapsedMs < this.config.intentCooldownMs) {
      return input.currentState;
    }

    return desiredState;
  }

  private resolveDesiredState(input: AiStateMachineInput): AiState {
    if (input.healthRatio <= this.config.lowHealthThreshold || input.distanceToTarget <= this.config.retreatRange) {
      return "retreat";
    }

    if (input.distanceToTarget > this.config.engageRange) {
      return input.hasLineOfSight ? "pressure" : "idle";
    }

    if (this.isVisibilityCompromised(input)) {
      return "hold";
    }

    if (input.hasCoverAvailable && input.healthRatio <= this.config.coverHealthThreshold) {
      return "hold";
    }

    if (input.hasLineOfSight) {
      if (input.hasCoverAvailable && input.distanceToTarget <= this.config.flankRange) {
        return "flank";
      }

      if (input.distanceToTarget > this.config.preferredHoldRange) {
        return "pressure";
      }

      return "hold";
    }

    if (input.hasCoverAvailable && input.distanceToTarget <= this.config.flankRange) {
      return "flank";
    }

    if (input.distanceToTarget > this.config.preferredHoldRange) {
      return "pressure";
    }

    return "hold";
  }

  private isVisibilityCompromised(input: AiStateMachineInput): boolean {
    if (input.effectiveVisionRange === undefined) {
      return false;
    }

    return input.effectiveVisionRange < input.distanceToTarget * this.config.weatherCautionVisionMultiplier;
  }
}
