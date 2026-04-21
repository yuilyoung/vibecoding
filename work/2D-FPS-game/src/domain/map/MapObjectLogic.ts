export type MapObjectKind = "barrel" | "mine" | "crate";

export interface MapObjectState {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly active: boolean;
  readonly armedAt?: number;
  readonly fuseStartedAt?: number;
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
}

const DEFAULT_HP_BY_KIND: Record<MapObjectKind, number> = {
  barrel: 60,
  mine: 25,
  crate: 40
};

export function createMapObject(input: CreateMapObjectInput): MapObjectState {
  const hp = normalizeHp(input.hp ?? DEFAULT_HP_BY_KIND[input.kind]);

  return {
    id: input.id,
    kind: input.kind,
    x: input.x,
    y: input.y,
    hp,
    active: (input.active ?? true) && hp > 0,
    armedAt: input.armedAt,
    fuseStartedAt: input.fuseStartedAt
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
