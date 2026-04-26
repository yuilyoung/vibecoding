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

export interface StageWeatherZoneCircle {
  readonly kind: "circle";
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

export interface StageWeatherZonePolygon {
  readonly kind: "polygon";
  readonly points: ReadonlyArray<readonly [number, number]>;
}

export type StageWeatherZoneShape = StageWeatherZoneCircle | StageWeatherZonePolygon;

export interface StageWeatherZoneDefinition {
  readonly weather: StageWeatherType;
  readonly shape: StageWeatherZoneShape;
  readonly priority?: number;
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
  readonly weatherZones?: ReadonlyArray<StageWeatherZoneDefinition>;
}

export function isValidStageDefinition(stage: StageDefinition): boolean {
  const validWeatherTypes: readonly StageWeatherType[] = ["clear", "rain", "fog", "sandstorm", "storm"];
  return (
    stage.id.trim().length > 0 &&
    stage.label.trim().length > 0 &&
    stage.blueSpawns.length > 0 &&
    stage.redSpawns.length > 0 &&
    (stage.wind === undefined || (stage.wind.strength >= 0 && stage.wind.strength <= 3)) &&
    (stage.weather === undefined || validWeatherTypes.includes(stage.weather.type)) &&
    (stage.weatherZones === undefined || stage.weatherZones.every((zone) => isValidWeatherZone(zone, validWeatherTypes)))
  );
}

function isValidWeatherZone(
  zone: StageWeatherZoneDefinition,
  validWeatherTypes: readonly StageWeatherType[]
): boolean {
  if (!validWeatherTypes.includes(zone.weather)) {
    return false;
  }

  if (zone.priority !== undefined && !Number.isFinite(zone.priority)) {
    return false;
  }

  if (zone.shape.kind === "circle") {
    return (
      Number.isFinite(zone.shape.cx) &&
      Number.isFinite(zone.shape.cy) &&
      Number.isFinite(zone.shape.radius) &&
      zone.shape.radius > 0
    );
  }

  if (zone.shape.kind === "polygon") {
    return zone.shape.points.length >= 3 && zone.shape.points.every((point) => isValidPoint(point));
  }

  return false;
}

function isValidPoint(point: readonly [number, number]): boolean {
  return point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}
