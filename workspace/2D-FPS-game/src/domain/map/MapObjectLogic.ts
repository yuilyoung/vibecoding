export type MapObjectKind = "barrel" | "mine" | "crate" | "cover" | "bounce-wall" | "teleporter";

export interface MapObjectState {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly active: boolean;
  readonly armedAt?: number;
  readonly fuseStartedAt?: number;
  readonly pairId?: string;
  readonly angleDegrees?: number;
  readonly reflectionsRemaining?: number;
  readonly cooldownUntil?: number;
  readonly cooldownMs?: number;
}

export interface CreateMapObjectInput {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly x: number;
  readonly y: number;
  readonly hp?: number;
  readonly active?: boolean;
  readonly armedAt?: number;
  readonly fuseStartedAt?: number;
  readonly pairId?: string;
  readonly angleDegrees?: number;
  readonly reflectionsRemaining?: number;
  readonly cooldownUntil?: number;
  readonly cooldownMs?: number;
}

const DEFAULT_HP_BY_KIND: Record<MapObjectKind, number> = {
  barrel: 60,
  mine: 25,
  crate: 40,
  cover: 60,
  "bounce-wall": 1,
  teleporter: 1
};

const DEFAULT_REFLECTIONS_REMAINING = 3;
const DEFAULT_TELEPORTER_COOLDOWN_MS = 1_500;

export function createMapObject(input: CreateMapObjectInput): MapObjectState {
  const hp = normalizeHp(input.hp ?? DEFAULT_HP_BY_KIND[input.kind]);
  const pairId = normalizeOptionalString(input.pairId);
  const angleDegrees = normalizeAngleDegrees(input.angleDegrees);
  const reflectionsRemaining =
    input.kind === "bounce-wall"
      ? normalizeCounter(input.reflectionsRemaining, DEFAULT_REFLECTIONS_REMAINING)
      : undefined;
  const cooldownUntil = normalizeCooldownUntil(input.cooldownUntil);
  const cooldownMs =
    input.kind === "teleporter"
      ? normalizeCounter(input.cooldownMs, DEFAULT_TELEPORTER_COOLDOWN_MS)
      : undefined;

  return {
    id: input.id,
    kind: input.kind,
    x: input.x,
    y: input.y,
    hp,
    active: (input.active ?? true) && hp > 0,
    armedAt: input.armedAt,
    fuseStartedAt: input.fuseStartedAt,
    ...(pairId !== undefined ? { pairId } : {}),
    ...(angleDegrees !== undefined ? { angleDegrees } : {}),
    ...(reflectionsRemaining !== undefined ? { reflectionsRemaining } : {}),
    ...(cooldownUntil !== undefined ? { cooldownUntil } : {}),
    ...(cooldownMs !== undefined ? { cooldownMs } : {})
  };
}

export function damageMapObject(object: MapObjectState, damage: number): MapObjectState {
  if (!object.active) {
    return object;
  }

  const damageAmount = Math.max(0, damage);
  const hp = normalizeHp(object.hp - damageAmount);

  if (hp <= 0) {
    return destroyMapObject(object);
  }

  return {
    ...object,
    hp
  };
}

export function destroyMapObject(object: MapObjectState): MapObjectState {
  return {
    ...object,
    hp: 0,
    active: false
  };
}

function normalizeHp(hp: number): number {
  return Math.max(0, hp);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAngleDegrees(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value as number;
}

function normalizeCounter(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value as number));
}

function normalizeCooldownUntil(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value;
}
