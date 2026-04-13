export interface ExplosionActorInput {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface ExplosionInput {
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly damage: number;
  readonly knockback: number;
  readonly actors: readonly ExplosionActorInput[];
}

export interface ExplosionActorResult {
  readonly id: string;
  readonly distance: number;
  readonly damage: number;
  readonly knockbackX: number;
  readonly knockbackY: number;
}

export function resolveExplosion(input: ExplosionInput): ExplosionActorResult[] {
  return input.actors
    .map((actor) => resolveActorExplosion(actor, input))
    .filter((result) => result.damage > 0 || result.knockbackX !== 0 || result.knockbackY !== 0);
}

function resolveActorExplosion(actor: ExplosionActorInput, input: ExplosionInput): ExplosionActorResult {
  const offsetX = actor.x - input.centerX;
  const offsetY = actor.y - input.centerY;
  const distance = Math.hypot(offsetX, offsetY);
  const falloff = input.radius <= 0 ? 0 : Math.max(0, 1 - distance / input.radius);
  const damage = Math.floor(input.damage * falloff);
  const knockbackMagnitude = input.knockback * falloff;
  const direction = getDirection(offsetX, offsetY);

  return {
    id: actor.id,
    distance,
    damage,
    knockbackX: direction.x * knockbackMagnitude,
    knockbackY: direction.y * knockbackMagnitude
  };
}

function getDirection(offsetX: number, offsetY: number): { x: number; y: number } {
  const length = Math.hypot(offsetX, offsetY);

  if (length === 0) {
    return { x: 0, y: -1 };
  }

  return {
    x: offsetX / length,
    y: offsetY / length
  };
}
