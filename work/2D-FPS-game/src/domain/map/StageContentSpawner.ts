import type {
  StageContentDefinition,
  StageDefinitionWithContent,
  StageGateDefinition,
  StageHazardDefinition,
  StageMapObjectDefinition,
  StagePickupDefinition
} from "./StageContentDefinition";
import { normalizeStageContentDefinition } from "./StageContentDefinition";
import type { StageDefinition } from "./StageDefinition";

export interface StageContentSpawnPlan {
  readonly stageId: string;
  readonly stageLabel: string;
  readonly hazards: readonly StageHazardDefinition[];
  readonly pickups: readonly StagePickupDefinition[];
  readonly gates: readonly StageGateDefinition[];
  readonly mapObjects: readonly StageMapObjectDefinition[];
}

export class StageContentSpawner {
  private activePlan: StageContentSpawnPlan | null;

  public constructor() {
    this.activePlan = null;
  }

  public spawn(stage: StageDefinition | StageDefinitionWithContent, content?: unknown): StageContentSpawnPlan {
    const stageContent = normalizeStageContentDefinition(content ?? getStageContent(stage));

    const plan: StageContentSpawnPlan = {
      stageId: stage.id,
      stageLabel: stage.label,
      hazards: [...stageContent.hazards],
      pickups: [...stageContent.pickups],
      gates: [...stageContent.gates],
      mapObjects: [...stageContent.mapObjects]
    };

    this.activePlan = plan;
    return plan;
  }

  public clear(): void {
    this.activePlan = null;
  }

  public getActivePlan(): StageContentSpawnPlan | null {
    return this.activePlan;
  }
}

function getStageContent(stage: StageDefinition | StageDefinitionWithContent): StageContentDefinition | undefined {
  return "content" in stage ? stage.content : undefined;
}
