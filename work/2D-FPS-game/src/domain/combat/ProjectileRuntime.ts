import { createCenteredRect, intersectsRect, type Rect } from "../collision/CollisionLogic";

export type ProjectileTrajectory = "linear" | "arc" | "bounce" | "homing" | "aoe-call" | "beam";

export interface ProjectileConfig {
  readonly trajectory: ProjectileTrajectory;
  readonly speed: number;
  readonly gravity?: number;
  readonly bounceCount?: number;
  readonly homingStrength?: number;
  readonly windMultiplier?: number;
}

export interface ProjectileMotionState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly bouncesRemaining?: number;
}

export interface ProjectileTarget {
  readonly x: number;
  readonly y: number;
}

export interface ProjectileRuntimeInput {
  readonly projectile: ProjectileMotionState;
  readonly config: ProjectileConfig;
  readonly deltaSeconds: number;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
  readonly obstacles?: readonly Rect[];
  readonly target?: ProjectileTarget | null;
  readonly windX?: number;
}

export interface ProjectileRuntimeResult {
  readonly projectile: ProjectileMotionState;
  readonly hitObstacle: boolean;
  readonly bounced: boolean;
  readonly expired: boolean;
}

export function advanceProjectile(input: ProjectileRuntimeInput): ProjectileRuntimeResult {
  if (input.config.trajectory === "beam" || input.config.trajectory === "aoe-call") {
    return {
      projectile: input.projectile,
      hitObstacle: false,
      bounced: false,
      expired: true
    };
  }

  const steeredVelocity = getSteeredVelocity(input);
  const nextVelocity = applyArcForces(input, steeredVelocity);
  const nextX = input.projectile.x + nextVelocity.velocityX * input.deltaSeconds;
  const nextY = input.projectile.y + nextVelocity.velocityY * input.deltaSeconds;
  const nextState = {
    ...input.projectile,
    x: nextX,
    y: nextY,
    velocityX: nextVelocity.velocityX,
    velocityY: nextVelocity.velocityY,
    bouncesRemaining: getBouncesRemaining(input.projectile, input.config)
  };

  if (input.config.trajectory !== "bounce") {
    return {
      projectile: nextState,
      hitObstacle: didHitObstacle(nextState, input.obstacles ?? []),
      bounced: false,
      expired: isOutOfArena(nextState, input.arenaWidth, input.arenaHeight)
    };
  }

  return resolveBounce(nextState, input);
}

function getSteeredVelocity(input: ProjectileRuntimeInput): Pick<ProjectileMotionState, "velocityX" | "velocityY"> {
  if (input.config.trajectory !== "homing" || input.target === null || input.target === undefined) {
    return {
      velocityX: input.projectile.velocityX,
      velocityY: input.projectile.velocityY
    };
  }

  const currentSpeed = Math.hypot(input.projectile.velocityX, input.projectile.velocityY) || input.config.speed;
  const desiredAngle = Math.atan2(input.target.y - input.projectile.y, input.target.x - input.projectile.x);
  const currentAngle = Math.atan2(input.projectile.velocityY, input.projectile.velocityX);
  const turnRatio = clamp01((input.config.homingStrength ?? 0) * input.deltaSeconds);
  const nextAngle = currentAngle + wrapRadians(desiredAngle - currentAngle) * turnRatio;

  return {
    velocityX: Math.cos(nextAngle) * currentSpeed,
    velocityY: Math.sin(nextAngle) * currentSpeed
  };
}

function applyArcForces(
  input: ProjectileRuntimeInput,
  velocity: Pick<ProjectileMotionState, "velocityX" | "velocityY">
): Pick<ProjectileMotionState, "velocityX" | "velocityY"> {
  if (input.config.trajectory !== "arc") {
    return velocity;
  }

  return {
    velocityX: velocity.velocityX + (input.windX ?? 0) * (input.config.windMultiplier ?? 0) * input.deltaSeconds,
    velocityY: velocity.velocityY + (input.config.gravity ?? 0) * input.deltaSeconds
  };
}

function resolveBounce(state: ProjectileMotionState, input: ProjectileRuntimeInput): ProjectileRuntimeResult {
  const bouncesRemaining = getBouncesRemaining(input.projectile, input.config);
  const arenaBounceX = state.x < 0 || state.x > input.arenaWidth;
  const arenaBounceY = state.y < 0 || state.y > input.arenaHeight;
  const hitObstacle = didHitObstacle(state, input.obstacles ?? []);
  const bounced = arenaBounceX || arenaBounceY || hitObstacle;

  if (!bounced) {
    return {
      projectile: state,
      hitObstacle: false,
      bounced: false,
      expired: false
    };
  }

  if (bouncesRemaining <= 0) {
    return {
      projectile: state,
      hitObstacle,
      bounced: false,
      expired: true
    };
  }

  const reflectedX = arenaBounceX || hitObstacle ? -state.velocityX : state.velocityX;
  const reflectedY = arenaBounceY ? -state.velocityY : state.velocityY;

  return {
    projectile: {
      ...state,
      x: clamp(state.x, 0, input.arenaWidth),
      y: clamp(state.y, 0, input.arenaHeight),
      velocityX: reflectedX,
      velocityY: reflectedY,
      bouncesRemaining: bouncesRemaining - 1
    },
    hitObstacle,
    bounced: true,
    expired: false
  };
}

function didHitObstacle(projectile: ProjectileMotionState, obstacles: readonly Rect[]): boolean {
  const bounds = createCenteredRect(projectile.x, projectile.y, projectile.width, projectile.height);
  return obstacles.some((obstacle) => intersectsRect(bounds, obstacle));
}

function isOutOfArena(projectile: ProjectileMotionState, arenaWidth: number, arenaHeight: number): boolean {
  return projectile.x < 0 || projectile.x > arenaWidth || projectile.y < 0 || projectile.y > arenaHeight;
}

function getBouncesRemaining(projectile: ProjectileMotionState, config: ProjectileConfig): number {
  return projectile.bouncesRemaining ?? config.bounceCount ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function wrapRadians(angle: number): number {
  let nextAngle = angle;

  while (nextAngle > Math.PI) {
    nextAngle -= Math.PI * 2;
  }

  while (nextAngle < -Math.PI) {
    nextAngle += Math.PI * 2;
  }

  return nextAngle;
}
