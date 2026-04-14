export interface HomingTarget {
  readonly x: number;
  readonly y: number;
  readonly valid?: boolean;
}

export interface HomingTrajectoryInput {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly speed: number;
  readonly deltaSeconds: number;
  readonly maxTurnRateRadiansPerSecond: number;
  readonly targets: readonly HomingTarget[];
}

export interface HomingTrajectoryResult {
  readonly velocityX: number;
  readonly velocityY: number;
  readonly target: HomingTarget | null;
}

const EPSILON = 1e-9;

export function steerHomingTrajectory(input: HomingTrajectoryInput): HomingTrajectoryResult {
  const target = selectNearestValidTarget(input.x, input.y, input.targets);

  if (target === null) {
    return {
      velocityX: input.velocityX,
      velocityY: input.velocityY,
      target
    };
  }

  const currentSpeed = Math.hypot(input.velocityX, input.velocityY);
  const speed = currentSpeed > EPSILON ? currentSpeed : Math.max(0, input.speed);

  if (speed <= EPSILON) {
    return {
      velocityX: 0,
      velocityY: 0,
      target
    };
  }

  const currentAngle = Math.atan2(input.velocityY, input.velocityX);
  const desiredAngle = Math.atan2(target.y - input.y, target.x - input.x);
  const maxTurn = Math.max(0, input.maxTurnRateRadiansPerSecond) * Math.max(0, input.deltaSeconds);
  const clampedTurn = clamp(wrapAngle(desiredAngle - currentAngle), -maxTurn, maxTurn);
  const nextAngle = currentAngle + clampedTurn;

  return {
    velocityX: Math.cos(nextAngle) * speed,
    velocityY: Math.sin(nextAngle) * speed,
    target
  };
}

function selectNearestValidTarget(
  originX: number,
  originY: number,
  targets: readonly HomingTarget[]
): HomingTarget | null {
  let bestTarget: HomingTarget | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (!isValidTarget(target)) {
      continue;
    }

    const distanceSquared = distanceSquaredBetween(originX, originY, target.x, target.y);

    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestTarget = target;
    }
  }

  return bestTarget;
}

function isValidTarget(target: HomingTarget): boolean {
  return target.valid !== false && Number.isFinite(target.x) && Number.isFinite(target.y);
}

function distanceSquaredBetween(x1: number, y1: number, x2: number, y2: number): number {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  return deltaX * deltaX + deltaY * deltaY;
}

function wrapAngle(angleRadians: number): number {
  const tau = Math.PI * 2;
  return ((angleRadians + Math.PI) % tau + tau) % tau - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
