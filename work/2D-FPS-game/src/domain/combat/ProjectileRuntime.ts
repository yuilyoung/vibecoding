import { createCenteredRect, intersectsRect, type Rect } from "../collision/CollisionLogic";

export type ProjectileTrajectory = "linear" | "arc" | "bounce" | "homing" | "aoe-call" | "beam";

export interface ProjectileConfig {
  readonly trajectory: ProjectileTrajectory;
  readonly speed: number;
  readonly gravity?: number;
  readonly bounceCount?: number;
  readonly homingStrength?: number;
  readonly blastRadius?: number;
  readonly blastDamage?: number;
  readonly knockback?: number;
  readonly pelletCount?: number;
  readonly spreadRadians?: number;
  readonly windMultiplier?: number;
  readonly beamRange?: number;
  readonly aoeCount?: number;
  readonly aoeIntervalMs?: number;
  readonly aoeSpreadRadius?: number;
}

export interface ProjectileRuntimeState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly trajectory: ProjectileTrajectory;
  readonly bouncesRemaining: number;
}

export interface ProjectileStepInput {
  readonly projectile: ProjectileRuntimeState;
  readonly config: ProjectileConfig;
  readonly deltaSeconds: number;
  readonly obstacles: readonly Rect[];
  readonly arenaBounds: Rect;
  readonly target?: {
    readonly x: number;
    readonly y: number;
  };
  readonly windX?: number;
}

export interface ProjectileStepResult {
  readonly projectile: ProjectileRuntimeState;
  readonly hitObstacle: boolean;
  readonly outOfBounds: boolean;
  readonly shouldExplode: boolean;
}

export interface BeamTarget {
  readonly id: string;
  readonly bounds: Rect;
}

export interface BeamCastInput {
  readonly originX: number;
  readonly originY: number;
  readonly angleRadians: number;
  readonly range: number;
  readonly obstacles: readonly Rect[];
  readonly targets: readonly BeamTarget[];
}

export interface BeamCastResult {
  readonly hitType: "target" | "obstacle" | "none";
  readonly targetId: string | null;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

export interface AoeCallImpact {
  readonly x: number;
  readonly y: number;
  readonly triggerAtMs: number;
}

export function createProjectileRuntimeState(input: {
  readonly x: number;
  readonly y: number;
  readonly angleRadians: number;
  readonly width: number;
  readonly height: number;
  readonly config: ProjectileConfig;
}): ProjectileRuntimeState {
  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    velocityX: Math.cos(input.angleRadians) * input.config.speed,
    velocityY: Math.sin(input.angleRadians) * input.config.speed,
    trajectory: input.config.trajectory,
    bouncesRemaining: input.config.bounceCount ?? 0
  };
}

export function stepProjectile(input: ProjectileStepInput): ProjectileStepResult {
  const deltaSeconds = Number.isFinite(input.deltaSeconds) && input.deltaSeconds > 0 ? input.deltaSeconds : 0;
  const velocity = resolveVelocity(input.projectile, input.config, deltaSeconds, input.target, input.windX ?? 0);
  const nextX = input.projectile.x + velocity.x * deltaSeconds;
  const nextY = input.projectile.y + velocity.y * deltaSeconds;
  const nextBounds = createCenteredRect(nextX, nextY, input.projectile.width, input.projectile.height);
  const hitObstacle = input.obstacles.some((obstacle) => intersectsRect(nextBounds, obstacle));
  const outOfBounds = !intersectsRect(nextBounds, input.arenaBounds);

  if (input.projectile.trajectory === "bounce" && hitObstacle && input.projectile.bouncesRemaining > 0) {
    const bouncedVelocity = reflectVelocity(input.projectile, nextBounds, input.obstacles);
    return {
      projectile: {
        ...input.projectile,
        velocityX: bouncedVelocity.x,
        velocityY: bouncedVelocity.y,
        bouncesRemaining: input.projectile.bouncesRemaining - 1
      },
      hitObstacle: true,
      outOfBounds,
      shouldExplode: false
    };
  }

  return {
    projectile: {
      ...input.projectile,
      x: nextX,
      y: nextY,
      velocityX: velocity.x,
      velocityY: velocity.y
    },
    hitObstacle,
    outOfBounds,
    shouldExplode: hitObstacle || outOfBounds
  };
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

export interface ProjectileRuntimeInput {
  readonly projectile: ProjectileMotionState;
  readonly config: ProjectileConfig;
  readonly deltaSeconds: number;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
  readonly obstacles?: readonly Rect[];
  readonly target?: { readonly x: number; readonly y: number } | null;
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

  const result = stepProjectile({
    projectile: {
      ...input.projectile,
      trajectory: input.config.trajectory,
      bouncesRemaining: input.projectile.bouncesRemaining ?? input.config.bounceCount ?? 0
    },
    config: input.config,
    deltaSeconds: input.deltaSeconds,
    obstacles: input.obstacles ?? [],
    arenaBounds: { x: 0, y: 0, width: input.arenaWidth, height: input.arenaHeight },
    target: input.target ?? undefined,
    windX: input.windX
  });
  const bounced = result.projectile.bouncesRemaining < (input.projectile.bouncesRemaining ?? input.config.bounceCount ?? 0);

  return {
    projectile: {
      x: result.projectile.x,
      y: result.projectile.y,
      width: result.projectile.width,
      height: result.projectile.height,
      velocityX: result.projectile.velocityX,
      velocityY: result.projectile.velocityY,
      bouncesRemaining: result.projectile.bouncesRemaining
    },
    hitObstacle: result.hitObstacle,
    bounced,
    expired: result.outOfBounds || result.shouldExplode
  };
}

export function castBeam(input: BeamCastInput): BeamCastResult {
  const directionX = Math.cos(input.angleRadians);
  const directionY = Math.sin(input.angleRadians);
  let best: BeamCastResult = {
    hitType: "none",
    targetId: null,
    x: input.originX + directionX * input.range,
    y: input.originY + directionY * input.range,
    distance: input.range
  };

  for (const obstacle of input.obstacles) {
    const distance = intersectRayWithRect(input.originX, input.originY, directionX, directionY, obstacle, input.range);
    if (distance !== null && distance < best.distance) {
      best = {
        hitType: "obstacle",
        targetId: null,
        x: input.originX + directionX * distance,
        y: input.originY + directionY * distance,
        distance
      };
    }
  }

  for (const target of input.targets) {
    const distance = intersectRayWithRect(input.originX, input.originY, directionX, directionY, target.bounds, input.range);
    if (distance !== null && distance < best.distance) {
      best = {
        hitType: "target",
        targetId: target.id,
        x: input.originX + directionX * distance,
        y: input.originY + directionY * distance,
        distance
      };
    }
  }

  return best;
}

export function planAoeCall(input: {
  readonly targetX: number;
  readonly targetY: number;
  readonly startAtMs: number;
  readonly config: ProjectileConfig;
}): readonly AoeCallImpact[] {
  const count = input.config.aoeCount ?? 1;
  const intervalMs = input.config.aoeIntervalMs ?? 0;
  const spreadRadius = input.config.aoeSpreadRadius ?? 0;

  return Array.from({ length: count }, (_, index) => {
    if (count === 1 || spreadRadius === 0) {
      return {
        x: input.targetX,
        y: input.targetY,
        triggerAtMs: input.startAtMs + index * intervalMs
      };
    }

    const angle = (Math.PI * 2 * index) / count;
    const radius = index === 0 ? 0 : spreadRadius;
    return {
      x: input.targetX + Math.cos(angle) * radius,
      y: input.targetY + Math.sin(angle) * radius,
      triggerAtMs: input.startAtMs + index * intervalMs
    };
  });
}

function resolveVelocity(
  projectile: ProjectileRuntimeState,
  config: ProjectileConfig,
  deltaSeconds: number,
  target: ProjectileStepInput["target"],
  windX: number
): { x: number; y: number } {
  if (projectile.trajectory === "arc") {
    return {
      x: projectile.velocityX + windX * (config.windMultiplier ?? 0) * deltaSeconds,
      y: projectile.velocityY + (config.gravity ?? 0) * deltaSeconds
    };
  }

  if (projectile.trajectory === "homing" && target !== undefined) {
    const desiredX = target.x - projectile.x;
    const desiredY = target.y - projectile.y;
    const desiredLength = Math.hypot(desiredX, desiredY) || 1;
    const currentSpeed = Math.hypot(projectile.velocityX, projectile.velocityY) || config.speed;
    const blend = Math.min(1, Math.max(0, config.homingStrength ?? 0) * deltaSeconds);
    const targetVelocityX = (desiredX / desiredLength) * currentSpeed;
    const targetVelocityY = (desiredY / desiredLength) * currentSpeed;

    return {
      x: projectile.velocityX + (targetVelocityX - projectile.velocityX) * blend,
      y: projectile.velocityY + (targetVelocityY - projectile.velocityY) * blend
    };
  }

  return {
    x: projectile.velocityX,
    y: projectile.velocityY
  };
}

function reflectVelocity(
  projectile: ProjectileRuntimeState,
  nextBounds: Rect,
  obstacles: readonly Rect[]
): { x: number; y: number } {
  const obstacle = obstacles.find((candidate) => intersectsRect(nextBounds, candidate));

  if (obstacle === undefined) {
    return {
      x: -projectile.velocityX,
      y: -projectile.velocityY
    };
  }

  const previousBounds = createCenteredRect(projectile.x, projectile.y, projectile.width, projectile.height);
  const wasClearHorizontally = previousBounds.x + previousBounds.width <= obstacle.x || previousBounds.x >= obstacle.x + obstacle.width;
  const wasClearVertically = previousBounds.y + previousBounds.height <= obstacle.y || previousBounds.y >= obstacle.y + obstacle.height;

  if (wasClearHorizontally && !wasClearVertically) {
    return {
      x: -projectile.velocityX,
      y: projectile.velocityY
    };
  }

  if (wasClearVertically && !wasClearHorizontally) {
    return {
      x: projectile.velocityX,
      y: -projectile.velocityY
    };
  }

  return {
    x: -projectile.velocityX,
    y: -projectile.velocityY
  };
}

function intersectRayWithRect(
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  rect: Rect,
  maxDistance: number
): number | null {
  const tx1 = directionX === 0 ? -Infinity : (rect.x - originX) / directionX;
  const tx2 = directionX === 0 ? Infinity : (rect.x + rect.width - originX) / directionX;
  const ty1 = directionY === 0 ? -Infinity : (rect.y - originY) / directionY;
  const ty2 = directionY === 0 ? Infinity : (rect.y + rect.height - originY) / directionY;
  const entry = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
  const exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));

  if (exit < 0 || entry > exit || entry > maxDistance) {
    return null;
  }

  return Math.max(0, entry);
}
