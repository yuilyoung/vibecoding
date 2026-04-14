export interface LineOfSightPoint {
  readonly x: number;
  readonly y: number;
}

export interface LineOfSightObstacle extends LineOfSightPoint {
  readonly width: number;
  readonly height: number;
}

export function hasLineOfSight(
  observer: LineOfSightPoint,
  target: LineOfSightPoint,
  obstacles: readonly LineOfSightObstacle[]
): boolean {
  return !obstacles.some((obstacle) => lineIntersectsObstacle(observer, target, obstacle));
}

export function lineIntersectsObstacle(
  start: LineOfSightPoint,
  end: LineOfSightPoint,
  obstacle: LineOfSightObstacle
): boolean {
  const left = obstacle.x;
  const right = obstacle.x + obstacle.width;
  const top = obstacle.y;
  const bottom = obstacle.y + obstacle.height;

  if (pointInsideRect(start.x, start.y, left, right, top, bottom) || pointInsideRect(end.x, end.y, left, right, top, bottom)) {
    return true;
  }

  return (
    linesIntersect(start.x, start.y, end.x, end.y, left, top, right, top) ||
    linesIntersect(start.x, start.y, end.x, end.y, right, top, right, bottom) ||
    linesIntersect(start.x, start.y, end.x, end.y, right, bottom, left, bottom) ||
    linesIntersect(start.x, start.y, end.x, end.y, left, bottom, left, top)
  );
}

function pointInsideRect(x: number, y: number, left: number, right: number, top: number, bottom: number): boolean {
  return x >= left && x <= right && y >= top && y <= bottom;
}

function linesIntersect(
  aStartX: number,
  aStartY: number,
  aEndX: number,
  aEndY: number,
  bStartX: number,
  bStartY: number,
  bEndX: number,
  bEndY: number
): boolean {
  const denominator = (aEndX - aStartX) * (bEndY - bStartY) - (aEndY - aStartY) * (bEndX - bStartX);

  if (denominator === 0) {
    return false;
  }

  const numeratorA = (aStartY - bStartY) * (bEndX - bStartX) - (aStartX - bStartX) * (bEndY - bStartY);
  const numeratorB = (aStartY - bStartY) * (aEndX - aStartX) - (aStartX - bStartX) * (aEndY - aStartY);
  const scalarA = numeratorA / denominator;
  const scalarB = numeratorB / denominator;

  return scalarA >= 0 && scalarA <= 1 && scalarB >= 0 && scalarB <= 1;
}
