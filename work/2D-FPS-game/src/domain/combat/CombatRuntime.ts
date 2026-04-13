export interface CombatAvailabilityInput {
  readonly isCombatLive: boolean;
  readonly isPlayerDead: boolean;
  readonly isDummyDead: boolean;
  readonly isMatchOver: boolean;
  readonly isPlayerStunned: boolean;
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
