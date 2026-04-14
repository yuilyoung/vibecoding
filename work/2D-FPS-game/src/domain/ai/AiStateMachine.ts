export type AiState = "idle" | "patrol" | "chase" | "attack" | "retreat";

export interface AiStateMachineConfig {
  readonly engageRange: number;
  readonly attackRange: number;
  readonly retreatRange: number;
  readonly lowHealthThreshold: number;
}

export interface AiStateMachineInput {
  readonly currentState: AiState;
  readonly distanceToTarget: number;
  readonly healthRatio: number;
  readonly hasLineOfSight: boolean;
}

export class AiStateMachine {
  private readonly config: AiStateMachineConfig;

  public constructor(config: AiStateMachineConfig) {
    this.config = config;
  }

  public evaluate(input: AiStateMachineInput): AiState {
    if (input.healthRatio <= this.config.lowHealthThreshold || input.distanceToTarget <= this.config.retreatRange) {
      return "retreat";
    }

    if (input.hasLineOfSight) {
      if (input.distanceToTarget <= this.config.attackRange) {
        return "attack";
      }

      return "chase";
    }

    if (input.distanceToTarget <= this.config.engageRange) {
      return "patrol";
    }

    if (input.currentState === "chase" || input.currentState === "attack" || input.currentState === "patrol") {
      return "patrol";
    }

    return "idle";
  }
}
