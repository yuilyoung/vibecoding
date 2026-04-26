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

export interface StageWindDefinition {
  readonly angleDegrees: number;
  readonly strength: number;
}

export type StageWeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

export interface StageWeatherDefinition {
  readonly type: StageWeatherType;
}

export interface StageDefinition {
  readonly id: string;
  readonly label: string;
  readonly weight?: number;
  readonly blueSpawns: readonly StageSpawnPoint[];
  readonly redSpawns: readonly StageSpawnPoint[];
  readonly obstacles: readonly StageObstacleDefinition[];
  readonly wind?: StageWindDefinition;
  readonly weather?: StageWeatherDefinition;
}

export function isValidStageDefinition(stage: StageDefinition): boolean {
  const validWeatherTypes: readonly StageWeatherType[] = ["clear", "rain", "fog", "sandstorm", "storm"];
  return (
    stage.id.trim().length > 0 &&
    stage.label.trim().length > 0 &&
    stage.blueSpawns.length > 0 &&
    stage.redSpawns.length > 0 &&
    (stage.wind === undefined || (stage.wind.strength >= 0 && stage.wind.strength <= 3)) &&
    (stage.weather === undefined || validWeatherTypes.includes(stage.weather.type))
  );
}
