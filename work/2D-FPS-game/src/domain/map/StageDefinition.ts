export interface StageSpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface StageObstacleDefinition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface StageDefinition {
  readonly id: string;
  readonly label: string;
  readonly weight?: number;
  readonly blueSpawns: readonly StageSpawnPoint[];
  readonly redSpawns: readonly StageSpawnPoint[];
  readonly obstacles: readonly StageObstacleDefinition[];
}

export function isValidStageDefinition(stage: StageDefinition): boolean {
  return (
    stage.id.trim().length > 0 &&
    stage.label.trim().length > 0 &&
    stage.blueSpawns.length > 0 &&
    stage.redSpawns.length > 0
  );
}
