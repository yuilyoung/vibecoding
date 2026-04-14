import { isValidStageDefinition, type StageDefinition } from "./StageDefinition";

export interface StageRotationState {
  readonly currentIndex: number;
  readonly history: readonly string[];
}

export interface StageRotationResult {
  readonly stage: StageDefinition;
  readonly state: StageRotationState;
}

export function createStageRotationState(initialIndex = -1): StageRotationState {
  return {
    currentIndex: initialIndex,
    history: []
  };
}

export function selectNextStage(
  stages: readonly StageDefinition[],
  state: StageRotationState = createStageRotationState()
): StageRotationResult {
  const validStages = stages.filter(isValidStageDefinition);

  if (validStages.length === 0) {
    throw new Error("Stage rotation requires at least one valid stage.");
  }

  const nextIndex = (state.currentIndex + 1) % validStages.length;
  const stage = validStages[nextIndex];

  return {
    stage,
    state: {
      currentIndex: nextIndex,
      history: [...state.history, stage.id]
    }
  };
}

export function selectStageById(stages: readonly StageDefinition[], stageId: string): StageDefinition | null {
  return stages.find((stage) => stage.id === stageId && isValidStageDefinition(stage)) ?? null;
}
