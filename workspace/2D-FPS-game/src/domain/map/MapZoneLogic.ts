import { createWeatherState, type WeatherConfig, type WeatherState } from "../environment/WeatherLogic";
import type { StageWeatherZoneDefinition, StageWeatherZonePolygon } from "./StageDefinition";

type Point = readonly [number, number];

export function pointInPolygon(point: Point, polygon: ReadonlyArray<Point>): boolean {
  if (polygon.length < 3) {
    return false;
  }

  const [px, py] = point;
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[previousIndex];

    if (isPointOnSegment(point, polygon[index], polygon[previousIndex])) {
      return true;
    }

    const intersects = ((ay > py) !== (by > py)) &&
      (px <= (((bx - ax) * (py - ay)) / ((by - ay) || Number.EPSILON)) + ax);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function pointInCircle(point: Point, cx: number, cy: number, radius: number): boolean {
  const dx = point[0] - cx;
  const dy = point[1] - cy;

  return (dx * dx) + (dy * dy) <= radius * radius;
}

export function resolveZoneWeather(
  position: Point,
  globalWeather: WeatherState,
  zones: ReadonlyArray<StageWeatherZoneDefinition> | undefined,
  config: WeatherConfig
): WeatherState {
  if (zones === undefined || zones.length === 0) {
    return globalWeather;
  }

  const sortedZones = [...zones].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));

  for (const zone of sortedZones) {
    if (!matchesZone(position, zone)) {
      continue;
    }

    return createWeatherState(zone.weather, config);
  }

  return globalWeather;
}

function matchesZone(position: Point, zone: StageWeatherZoneDefinition): boolean {
  if (zone.shape.kind === "circle") {
    return pointInCircle(position, zone.shape.cx, zone.shape.cy, zone.shape.radius);
  }

  return matchesPolygonZone(position, zone.shape);
}

function matchesPolygonZone(position: Point, polygon: StageWeatherZonePolygon): boolean {
  const bounds = getPolygonBounds(polygon.points);

  if (
    position[0] < bounds.minX ||
    position[0] > bounds.maxX ||
    position[1] < bounds.minY ||
    position[1] > bounds.maxY
  ) {
    return false;
  }

  return pointInPolygon(position, polygon.points);
}

function getPolygonBounds(points: ReadonlyArray<Point>): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  let minX = points[0][0];
  let maxX = points[0][0];
  let minY = points[0][1];
  let maxY = points[0][1];

  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY
  };
}

function isPointOnSegment(point: Point, start: Point, end: Point): boolean {
  const cross = ((point[1] - start[1]) * (end[0] - start[0])) - ((point[0] - start[0]) * (end[1] - start[1]));

  if (Math.abs(cross) > Number.EPSILON) {
    return false;
  }

  const dot = ((point[0] - start[0]) * (end[0] - start[0])) + ((point[1] - start[1]) * (end[1] - start[1]));
  if (dot < 0) {
    return false;
  }

  const squaredLength = ((end[0] - start[0]) * (end[0] - start[0])) + ((end[1] - start[1]) * (end[1] - start[1]));
  return dot <= squaredLength;
}
