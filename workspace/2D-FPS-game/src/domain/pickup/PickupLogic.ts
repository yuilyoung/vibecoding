export type PickupKind = "health" | "ammo" | "boost";

export interface PickupDefinition {
  readonly id: string;
  readonly kind: PickupKind;
  readonly amount: number;
  readonly durationMs?: number;
}

export interface PickupPlayerState {
  readonly health: number;
  readonly maxHealth: number;
}

export interface PickupWeaponState {
  readonly reserveAmmo: number;
  readonly maxReserveAmmo: number;
}

export interface PickupBoostState {
  readonly activeUntilMs: number;
  readonly multiplier: number;
}

export interface PickupApplyInput {
  readonly player: PickupPlayerState;
  readonly weapon?: PickupWeaponState;
  readonly boost?: PickupBoostState;
  readonly pickup: PickupDefinition;
  readonly nowMs?: number;
}

export interface PickupApplyResult {
  readonly consumed: boolean;
  readonly player: PickupPlayerState;
  readonly weapon?: PickupWeaponState;
  readonly boost?: PickupBoostState;
  readonly restoredHealth: number;
  readonly restoredAmmo: number;
  readonly boostDurationMs: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export function applyPickup(input: PickupApplyInput): PickupApplyResult {
  const amount = Math.max(0, input.pickup.amount);

  if (input.pickup.kind === "health") {
    return applyHealthPickup(input, amount);
  }

  if (input.pickup.kind === "ammo") {
    return applyAmmoPickup(input, amount);
  }

  return applyBoostPickup(input, amount);
}

function applyHealthPickup(input: PickupApplyInput, amount: number): PickupApplyResult {
  const maxHealth = Math.max(0, input.player.maxHealth);
  const currentHealth = clamp(input.player.health, 0, maxHealth);
  const nextHealth = clamp(currentHealth + amount, 0, maxHealth);
  const restoredHealth = nextHealth - currentHealth;

  return {
    consumed: restoredHealth > 0,
    player: {
      health: nextHealth,
      maxHealth
    },
    weapon: input.weapon,
    boost: input.boost,
    restoredHealth,
    restoredAmmo: 0,
    boostDurationMs: 0
  };
}

function applyAmmoPickup(input: PickupApplyInput, amount: number): PickupApplyResult {
  if (input.weapon === undefined) {
    return unchanged(input);
  }

  const maxReserveAmmo = Math.max(0, input.weapon.maxReserveAmmo);
  const currentReserveAmmo = clamp(input.weapon.reserveAmmo, 0, maxReserveAmmo);
  const nextReserveAmmo = clamp(currentReserveAmmo + amount, 0, maxReserveAmmo);
  const restoredAmmo = nextReserveAmmo - currentReserveAmmo;

  return {
    consumed: restoredAmmo > 0,
    player: normalizePlayer(input.player),
    weapon: {
      reserveAmmo: nextReserveAmmo,
      maxReserveAmmo
    },
    boost: input.boost,
    restoredHealth: 0,
    restoredAmmo,
    boostDurationMs: 0
  };
}

function applyBoostPickup(input: PickupApplyInput, amount: number): PickupApplyResult {
  const durationMs = Math.max(0, input.pickup.durationMs ?? 0);
  const nowMs = input.nowMs ?? 0;
  const currentBoost = input.boost ?? {
    activeUntilMs: 0,
    multiplier: 1
  };
  const boostDurationMs = durationMs > 0 && amount > 0 ? durationMs : 0;
  const activeUntilMs = boostDurationMs > 0 ? Math.max(currentBoost.activeUntilMs, nowMs) + boostDurationMs : currentBoost.activeUntilMs;

  return {
    consumed: boostDurationMs > 0,
    player: normalizePlayer(input.player),
    weapon: input.weapon,
    boost: {
      activeUntilMs,
      multiplier: amount > 0 ? amount : currentBoost.multiplier
    },
    restoredHealth: 0,
    restoredAmmo: 0,
    boostDurationMs
  };
}

function unchanged(input: PickupApplyInput): PickupApplyResult {
  return {
    consumed: false,
    player: normalizePlayer(input.player),
    weapon: input.weapon,
    boost: input.boost,
    restoredHealth: 0,
    restoredAmmo: 0,
    boostDurationMs: 0
  };
}

function normalizePlayer(player: PickupPlayerState): PickupPlayerState {
  const maxHealth = Math.max(0, player.maxHealth);

  return {
    health: clamp(player.health, 0, maxHealth),
    maxHealth
  };
}
