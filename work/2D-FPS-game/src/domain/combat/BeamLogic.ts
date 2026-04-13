import type { Rect } from "../collision/CollisionLogic";

export interface BeamOrigin {
  readonly x: number;
  readonly y: number;
}

export interface BeamTarget extends Rect {
  readonly id: string;
}

export interface BeamHitPoint {
  readonly x: number;
  readonly y: number;
}

export interface BeamHitResult {
  readonly kind: "none" | "actor" | "obstacle";
  readonly hitPoint: BeamHitPoint;
  readonly distance: number;
  readonly targetId: string | null;
  readonly targetRect: Rect | null;
  readonly targetType: "actor" | "obstacle" | null;
}

export function castBeam(
  origin: BeamOrigin,
  angleRadians: number,
  maxRange: number,
  obstacles: readonly Rect[],
  actors: readonly BeamTarget[]
): BeamHitResult {
  const directionX = Math.cos(angleRadians);
  const directionY = Math.sin(angleRadians);
  const candidates: Array<BeamCandidate> = [];

  for (const [index, obstacle] of obstacles.entries()) {
    const hit = intersectRayRect(origin, directionX, directionY, maxRange, obstacle);

    if (hit !== null) {
      candidates.push({
        distance: hit.distance,
        hitPoint: hit.hitPoint,
        kind: "obstacle",
        targetId: null,
        targetRect: obstacle,
        targetType: "obstacle",
        order: index
      });
    }
  }

  for (const [index, actor] of actors.entries()) {
    const hit = intersectRayRect(origin, directionX, directionY, maxRange, actor);

    if (hit !== null) {
      candidates.push({
        distance: hit.distance,
        hitPoint: hit.hitPoint,
        kind: "actor",
        targetId: actor.id,
        targetRect: actor,
        targetType: "actor",
        order: obstacles.length + index
      });
    }
  }

  if (candidates.length === 0) {
    return {
      kind: "none",
      hitPoint: {
        x: origin.x + directionX * maxRange,
        y: origin.y + directionY * maxRange
      },
      distance: maxRange,
      targetId: null,
      targetRect: null,
      targetType: null
    };
  }

  candidates.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }

    return left.order - right.order;
  });

  const hit = candidates[0];

  return {
    kind: hit.kind,
    hitPoint: hit.hitPoint,
    distance: hit.distance,
    targetId: hit.targetId,
    targetRect: hit.targetRect,
    targetType: hit.targetType
  };
}

interface BeamCandidate {
  readonly distance: number;
  readonly hitPoint: BeamHitPoint;
  readonly kind: "actor" | "obstacle";
  readonly targetId: string | null;
  readonly targetRect: Rect;
  readonly targetType: "actor" | "obstacle";
  readonly order: number;
}

interface RayHit {
  readonly distance: number;
  readonly hitPoint: BeamHitPoint;
}

function intersectRayRect(
  origin: BeamOrigin,
  directionX: number,
  directionY: number,
  maxRange: number,
  rect: Rect
): RayHit | null {
  const epsilon = 1e-9;
  const minX = rect.x;
  const maxX = rect.x + rect.width;
  const minY = rect.y;
  const maxY = rect.y + rect.height;

  let tMin = 0;
  let tMax = maxRange;

  if (Math.abs(directionX) < epsilon) {
    if (origin.x < minX || origin.x > maxX) {
      return null;
    }
  } else {
    const invX = 1 / directionX;
    let t1 = (minX - origin.x) * invX;
    let t2 = (maxX - origin.x) * invX;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (Math.abs(directionY) < epsilon) {
    if (origin.y < minY || origin.y > maxY) {
      return null;
    }
  } else {
    const invY = 1 / directionY;
    let t1 = (minY - origin.y) * invY;
    let t2 = (maxY - origin.y) * invY;

    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (tMax < tMin) {
    return null;
  }

  const distance = clamp(tMin, 0, maxRange);

  if (distance > maxRange) {
    return null;
  }

  return {
    distance,
    hitPoint: {
      x: origin.x + directionX * distance,
      y: origin.y + directionY * distance
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
