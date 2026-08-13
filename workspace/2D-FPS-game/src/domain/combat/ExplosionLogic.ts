export interface ExplosionTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly mass?: number;
}

export interface ExplosionHit {
  readonly id: string;
  readonly distance: number;
  readonly damage: number;
  readonly knockbackX: number;
  readonly knockbackY: number;
}

export interface ExplosionInput {
  readonly centerX: number;
  readonly centerY: number;
  readonly baseDamage: number;
  readonly blastRadius: number;
  readonly knockback: number;
  readonly targets: readonly ExplosionTarget[];
}

export interface ExplosiveObject {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly triggerRadius: number;
}

export interface ChainExplosionInput {
  readonly originId: string;
  readonly objects: readonly ExplosiveObject[];
  readonly maxDepth: number;
}

const MAX_CHAIN_EXPLOSION_DEPTH = 5;

export function resolveExplosion(input: ExplosionInput): readonly ExplosionHit[] {
  if (input.blastRadius <= 0 || input.baseDamage <= 0) {
    return [];
  }

  return input.targets.flatMap((target) => {
    const deltaX = target.x - input.centerX;
    const deltaY = target.y - input.centerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > input.blastRadius) {
      return [];
    }

    const falloff = 1 - distance / input.blastRadius;
    const damage = Math.max(0, input.baseDamage * falloff);
    const directionLength = distance === 0 ? 1 : distance;
    const directionX = distance === 0 ? 1 : deltaX / directionLength;
    const directionY = distance === 0 ? 0 : deltaY / directionLength;
    const mass = Math.max(target.mass ?? 1, 0.001);
    const knockbackDistance = input.knockback * falloff / mass;

    return [{
      id: target.id,
      distance,
      damage,
      knockbackX: directionX * knockbackDistance,
      knockbackY: directionY * knockbackDistance
    }];
  });
}

export function resolveChainExplosion(input: ChainExplosionInput): readonly string[] {
  const origin = input.objects.find((object) => object.id === input.originId);
  const maxDepth = Math.min(Math.floor(input.maxDepth), MAX_CHAIN_EXPLOSION_DEPTH);

  if (origin === undefined || !Number.isFinite(input.maxDepth) || maxDepth <= 0) {
    return [];
  }

  const triggered = new Set<string>([origin.id]);
  let frontier = [origin];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const nextFrontier: ExplosiveObject[] = [];

    for (const active of frontier) {
      if (!Number.isFinite(active.triggerRadius) || active.triggerRadius <= 0) {
        continue;
      }

      for (const candidate of input.objects) {
        if (triggered.has(candidate.id)) {
          continue;
        }

        const distance = Math.hypot(candidate.x - active.x, candidate.y - active.y);
        if (distance <= active.triggerRadius) {
          triggered.add(candidate.id);
          nextFrontier.push(candidate);
        }
      }
    }

    frontier = nextFrontier;
  }

  return [...triggered];
}
