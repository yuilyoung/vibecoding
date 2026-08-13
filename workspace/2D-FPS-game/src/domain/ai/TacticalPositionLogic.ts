import { hasLineOfSight, type LineOfSightObstacle, type LineOfSightPoint, findClosestBlockingObstacle } from "./LineOfSightLogic";
import { getCoverLineOfSightObstacle } from "../map/CoverLogic";
import type { MapObjectState } from "../map/MapObjectLogic";

export type TacticalIntent = "hold" | "pressure" | "retreat" | "flank";

export interface TacticalPositionConfig {
  readonly coverSearchRadius: number;
  readonly preferredDistance: number;
  readonly retreatDistance: number;
  readonly flankDistance: number;
  readonly anchorPadding: number;
  readonly weatherCautionMultiplier: number;
}

export interface TacticalPositionInput {
  readonly actor: LineOfSightPoint;
  readonly target: LineOfSightPoint;
  readonly intent: TacticalIntent;
  readonly cover: readonly MapObjectState[];
  readonly blockers?: readonly LineOfSightObstacle[];
  readonly config: TacticalPositionConfig;
}

export interface TacticalPositionCandidate {
  readonly coverId: string;
  readonly anchor: LineOfSightPoint;
  readonly distanceFromActor: number;
  readonly distanceToTarget: number;
  readonly blocksTargetLineOfSight: boolean;
  readonly score: number;
}

export interface TacticalPositionSelection {
  readonly targetX: number;
  readonly targetY: number;
  readonly score: number;
  readonly source: "cover" | "fallback";
  readonly coverId?: string;
  readonly blocksTargetLineOfSight: boolean;
}

const DEFAULT_WEIGHTS: Record<TacticalIntent, { readonly lineBreakBonus: number; readonly distanceWeight: number; readonly rangeWeight: number; readonly flankWeight: number; }> = {
  hold: { lineBreakBonus: 120, distanceWeight: 0.7, rangeWeight: 0.6, flankWeight: 0.2 },
  pressure: { lineBreakBonus: 70, distanceWeight: 0.65, rangeWeight: 0.45, flankWeight: 0.4 },
  retreat: { lineBreakBonus: 180, distanceWeight: 0.3, rangeWeight: 0.15, flankWeight: 0.1 },
  flank: { lineBreakBonus: 110, distanceWeight: 0.55, rangeWeight: 0.35, flankWeight: 0.9 }
};

export function selectTacticalPosition(input: TacticalPositionInput): TacticalPositionSelection {
  const candidates = scoreCoverPositions(input);

  if (candidates.length > 0) {
    const best = candidates[0];
    return {
      targetX: best.anchor.x,
      targetY: best.anchor.y,
      score: best.score,
      source: "cover",
      coverId: best.coverId,
      blocksTargetLineOfSight: best.blocksTargetLineOfSight
    };
  }

  if (input.intent === "flank") {
    return createFlankFallback(input);
  }

  return createRetreatFallback(input);
}

export function scoreCoverPositions(input: TacticalPositionInput): TacticalPositionCandidate[] {
  const weights = DEFAULT_WEIGHTS[input.intent];
  const coverObstacles = input.cover
    .map((cover) => ({ cover, obstacle: getCoverLineOfSightObstacle(cover) }))
    .filter((entry): entry is { readonly cover: MapObjectState; readonly obstacle: LineOfSightObstacle } => entry.obstacle !== undefined);
  const staticBlockers = input.blockers ?? [];
  const results: TacticalPositionCandidate[] = [];

  for (const { cover, obstacle } of coverObstacles) {
    const anchor = createCoverAnchorPoint(cover, input.target, input.config.anchorPadding);
    const distanceFromActor = distanceBetween(input.actor, anchor);

    if (distanceFromActor > input.config.coverSearchRadius) {
      continue;
    }

    const distanceToTarget = distanceBetween(anchor, input.target);
    const blocksTargetLineOfSight = !hasLineOfSight(input.target, anchor, [...staticBlockers, obstacle]);
    const flankOffset = calculateFlankOffset(input.actor, input.target, anchor);
    const score =
      distanceFromActor * weights.distanceWeight +
      Math.abs(distanceToTarget - input.config.preferredDistance) * weights.rangeWeight -
      (blocksTargetLineOfSight ? weights.lineBreakBonus * input.config.weatherCautionMultiplier : 0) -
      flankOffset * weights.flankWeight -
      createIntentDistanceBonus(input.intent, distanceToTarget, input.config) -
      createObstacleProximityBonus(input.actor, anchor, staticBlockers);

    results.push({
      coverId: cover.id,
      anchor,
      distanceFromActor,
      distanceToTarget,
      blocksTargetLineOfSight,
      score
    });
  }

  return results.sort((left, right) => left.score - right.score);
}

export function selectRetreatAnchor(input: Omit<TacticalPositionInput, "intent">): TacticalPositionSelection {
  return selectTacticalPosition({
    ...input,
    intent: "retreat"
  });
}

export function selectFlankPosition(input: Omit<TacticalPositionInput, "intent">): TacticalPositionSelection {
  return selectTacticalPosition({
    ...input,
    intent: "flank"
  });
}

function createCoverAnchorPoint(cover: MapObjectState, target: LineOfSightPoint, padding: number): LineOfSightPoint {
  const deltaX = cover.x - target.x;
  const deltaY = cover.y - target.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const axisX = deltaX / distance;
  const axisY = deltaY / distance;

  return {
    x: cover.x + axisX * padding,
    y: cover.y + axisY * padding
  };
}

function createRetreatFallback(input: TacticalPositionInput): TacticalPositionSelection {
  const deltaX = input.actor.x - input.target.x;
  const deltaY = input.actor.y - input.target.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;

  return {
    targetX: input.actor.x + (deltaX / distance) * input.config.retreatDistance,
    targetY: input.actor.y + (deltaY / distance) * input.config.retreatDistance,
    score: Number.POSITIVE_INFINITY,
    source: "fallback",
    blocksTargetLineOfSight: false
  };
}

function createFlankFallback(input: TacticalPositionInput): TacticalPositionSelection {
  const deltaX = input.target.x - input.actor.x;
  const deltaY = input.target.y - input.actor.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const normalizedX = deltaX / distance;
  const normalizedY = deltaY / distance;
  const side = Math.abs(deltaX) >= Math.abs(deltaY) ? 1 : -1;
  const target = {
    x: input.target.x + (-normalizedY * side) * input.config.flankDistance,
    y: input.target.y + (normalizedX * side) * input.config.flankDistance
  };
  const blockingObstacle = findClosestBlockingObstacle(input.actor, target, input.blockers ?? []);

  return {
    targetX: blockingObstacle === undefined ? target.x : input.actor.x + (-normalizedY * side) * input.config.flankDistance,
    targetY: blockingObstacle === undefined ? target.y : input.actor.y + (normalizedX * side) * input.config.flankDistance,
    score: Number.POSITIVE_INFINITY,
    source: "fallback",
    blocksTargetLineOfSight: blockingObstacle !== undefined
  };
}

function calculateFlankOffset(actor: LineOfSightPoint, target: LineOfSightPoint, anchor: LineOfSightPoint): number {
  const toTargetX = target.x - actor.x;
  const toTargetY = target.y - actor.y;
  const toAnchorX = anchor.x - actor.x;
  const toAnchorY = anchor.y - actor.y;
  const directDistance = Math.hypot(toTargetX, toTargetY) || 1;
  return Math.abs(toTargetX * toAnchorY - toTargetY * toAnchorX) / directDistance;
}

function createIntentDistanceBonus(intent: TacticalIntent, distanceToTarget: number, config: TacticalPositionConfig): number {
  if (intent === "retreat") {
    return distanceToTarget * 0.35;
  }

  if (intent === "flank") {
    return Math.min(distanceToTarget, config.flankDistance) * 0.2;
  }

  if (intent === "pressure") {
    return -Math.max(0, distanceToTarget - config.preferredDistance) * 0.15;
  }

  return 0;
}

function createObstacleProximityBonus(
  actor: LineOfSightPoint,
  anchor: LineOfSightPoint,
  blockers: readonly LineOfSightObstacle[]
): number {
  const blocker = findClosestBlockingObstacle(actor, anchor, blockers);

  if (blocker === undefined) {
    return 0;
  }

  const blockerCenter = {
    x: blocker.x + blocker.width / 2,
    y: blocker.y + blocker.height / 2
  };
  return Math.max(0, 24 - distanceBetween(anchor, blockerCenter)) * 0.25;
}

function distanceBetween(left: LineOfSightPoint, right: LineOfSightPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}
