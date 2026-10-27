import type { Rect } from "../collision/CollisionLogic";
import type { TeamId } from "../round/MatchFlowLogic";

export interface ProjectileImpactActor {
  readonly id: string;
  readonly team: TeamId;
  readonly alive: boolean;
  readonly bounds: Rect;
}

export interface ProjectileImpactWorldTarget {
  readonly id: string;
  readonly bounds: Rect;
}

export interface ProjectileImpactInput {
  readonly previous: Readonly<{ x: number; y: number }>;
  readonly next: Readonly<{ x: number; y: number }>;
  readonly projectileWidth: number;
  readonly projectileHeight: number;
  readonly hitRadius?: number;
  readonly ownerId: string;
  readonly ownerTeam: TeamId;
  readonly actors: readonly ProjectileImpactActor[];
  readonly world: readonly ProjectileImpactWorldTarget[];
}

export interface ProjectileImpact {
  readonly kind: "actor" | "world";
  readonly id: string;
  readonly fraction: number;
  readonly x: number;
  readonly y: number;
}

interface ImpactCandidate {
  readonly kind: ProjectileImpact["kind"];
  readonly id: string;
  readonly fraction: number;
}

export function selectEarliestProjectileImpact(input: ProjectileImpactInput): ProjectileImpact | null {
  const paddingX = Math.max(0, input.projectileWidth) / 2 + Math.max(0, input.hitRadius ?? 0);
  const paddingY = Math.max(0, input.projectileHeight) / 2 + Math.max(0, input.hitRadius ?? 0);
  let selected: ImpactCandidate | null = null;

  for (const target of input.world) {
    selected = chooseEarlier(selected, createCandidate("world", target.id, input, expandRect(target.bounds, paddingX, paddingY)));
  }

  for (const target of input.actors) {
    if (!target.alive || target.id === input.ownerId || target.team === input.ownerTeam) continue;
    selected = chooseEarlier(selected, createCandidate("actor", target.id, input, expandRect(target.bounds, paddingX, paddingY)));
  }

  if (selected === null) return null;

  return {
    ...selected,
    x: input.previous.x + (input.next.x - input.previous.x) * selected.fraction,
    y: input.previous.y + (input.next.y - input.previous.y) * selected.fraction
  };
}

function createCandidate(
  kind: ProjectileImpact["kind"],
  id: string,
  input: ProjectileImpactInput,
  bounds: Rect
): ImpactCandidate | null {
  const fraction = intersectSegmentWithRect(input.previous, input.next, bounds);
  return fraction === null ? null : { kind, id, fraction };
}

function chooseEarlier(current: ImpactCandidate | null, candidate: ImpactCandidate | null): ImpactCandidate | null {
  if (candidate === null) return current;
  if (current === null || candidate.fraction < current.fraction) return candidate;
  if (candidate.fraction === current.fraction && candidate.kind === "world" && current.kind === "actor") return candidate;
  return current;
}

function expandRect(rect: Rect, paddingX: number, paddingY: number): Rect {
  return {
    x: rect.x - paddingX,
    y: rect.y - paddingY,
    width: rect.width + paddingX * 2,
    height: rect.height + paddingY * 2
  };
}

function intersectSegmentWithRect(
  previous: Readonly<{ x: number; y: number }>,
  next: Readonly<{ x: number; y: number }>,
  rect: Rect
): number | null {
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  let entry = 0;
  let exit = 1;

  const xRange = intersectAxis(previous.x, deltaX, rect.x, rect.x + rect.width);
  if (xRange === null) return null;
  entry = Math.max(entry, xRange.entry);
  exit = Math.min(exit, xRange.exit);

  const yRange = intersectAxis(previous.y, deltaY, rect.y, rect.y + rect.height);
  if (yRange === null) return null;
  entry = Math.max(entry, yRange.entry);
  exit = Math.min(exit, yRange.exit);

  return entry <= exit && exit >= 0 && entry <= 1 ? Math.max(0, entry) : null;
}

function intersectAxis(origin: number, delta: number, min: number, max: number): { entry: number; exit: number } | null {
  if (delta === 0) return origin >= min && origin <= max ? { entry: -Infinity, exit: Infinity } : null;
  const first = (min - origin) / delta;
  const second = (max - origin) / delta;
  return { entry: Math.min(first, second), exit: Math.max(first, second) };
}
