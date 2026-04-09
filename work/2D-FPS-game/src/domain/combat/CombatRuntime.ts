import { createCenteredRect, intersectsRect, type Rect } from "../collision/CollisionLogic";

export interface CombatAvailabilityInput {
  readonly isCombatLive: boolean;
  readonly isPlayerDead: boolean;
  readonly isDummyDead: boolean;
  readonly isMatchOver: boolean;
  readonly isPlayerStunned: boolean;
}

export interface ProjectileRuntimeState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly owner: "player" | "dummy";
}

export interface ProjectileFrameInput {
  readonly projectile: ProjectileRuntimeState;
  readonly deltaSeconds: number;
  readonly arenaWidth: number;
  readonly arenaHeight: number;
  readonly obstacles: readonly Rect[];
  readonly playerBounds: Rect | null;
  readonly dummyBounds: Rect | null;
}

export interface ProjectileFrameResult {
  readonly nextX: number;
  readonly nextY: number;
  readonly outOfBounds: boolean;
  readonly hitObstacle: boolean;
  readonly hitPlayer: boolean;
  readonly hitDummy: boolean;
}

export function canPlayerReload(input: CombatAvailabilityInput): boolean {
  return input.isCombatLive && !input.isPlayerDead && !input.isMatchOver && !input.isPlayerStunned;
}

export function canInterruptReload(input: Omit<CombatAvailabilityInput, "isDummyDead">): boolean {
  return input.isCombatLive && !input.isPlayerDead && !input.isMatchOver;
}

export function canPlayerFire(input: CombatAvailabilityInput): boolean {
  return input.isCombatLive && !input.isDummyDead && !input.isPlayerDead && !input.isMatchOver && !input.isPlayerStunned;
}

export function canDummyFire(input: CombatAvailabilityInput): boolean {
  return input.isCombatLive && !input.isDummyDead && !input.isPlayerDead && !input.isMatchOver;
}

export function canPlayerUseCombatInteraction(input: Omit<CombatAvailabilityInput, "isDummyDead" | "isPlayerStunned">): boolean {
  return input.isCombatLive && !input.isPlayerDead && !input.isMatchOver;
}

export function canApplyHazard(input: Omit<CombatAvailabilityInput, "isPlayerStunned">): boolean {
  return input.isCombatLive && !input.isMatchOver;
}

export function isGateInteractionAllowed(distanceToGate: number, maxDistance: number): boolean {
  return distanceToGate <= maxDistance;
}

export function evaluateProjectileFrame(input: ProjectileFrameInput): ProjectileFrameResult {
  const nextX = input.projectile.x + input.projectile.velocityX * input.deltaSeconds;
  const nextY = input.projectile.y + input.projectile.velocityY * input.deltaSeconds;
  const bounds = createCenteredRect(nextX, nextY, input.projectile.width, input.projectile.height);

  return {
    nextX,
    nextY,
    outOfBounds: nextX < 0 || nextX > input.arenaWidth || nextY < 0 || nextY > input.arenaHeight,
    hitObstacle: input.obstacles.some((obstacle) => intersectsRect(bounds, obstacle)),
    hitPlayer: input.playerBounds !== null && intersectsRect(bounds, input.playerBounds),
    hitDummy: input.dummyBounds !== null && intersectsRect(bounds, input.dummyBounds)
  };
}
