export type CombatActorId = "player" | "dummy";
export type CombatRoundWinner = "PLAYER" | "DUMMY";

export interface BulletResolutionInput {
  readonly owner: CombatActorId;
  readonly hitDummy: boolean;
  readonly hitPlayer: boolean;
  readonly hitObstacle: boolean;
  readonly outOfBounds: boolean;
  readonly damage: number;
  readonly targetDied: boolean;
}

export interface BulletResolutionResult {
  readonly destroyBullet: boolean;
  readonly damagedActor: CombatActorId | null;
  readonly combatEvent: string | null;
  readonly soundTarget: CombatActorId | null;
  readonly roundWinner: CombatRoundWinner | null;
}

export interface HazardResolutionInput {
  readonly actorId: CombatActorId;
  readonly triggered: boolean;
  readonly damage: number;
  readonly actorDied: boolean;
}

export interface HazardResolutionResult {
  readonly combatEvent: string | null;
  readonly roundWinner: CombatRoundWinner | null;
}

export function resolveBulletCollision(input: BulletResolutionInput): BulletResolutionResult {
  if (input.hitDummy && input.owner === "player") {
    return {
      destroyBullet: true,
      damagedActor: "dummy",
      combatEvent: input.targetDied ? "TARGET DOWN" : `HIT ${input.damage}`,
      soundTarget: "dummy",
      roundWinner: input.targetDied ? "PLAYER" : null
    };
  }

  if (input.hitPlayer && input.owner === "dummy") {
    return {
      destroyBullet: true,
      damagedActor: "player",
      combatEvent: input.targetDied ? "PLAYER DOWN" : `STUNNED ${input.damage}`,
      soundTarget: "player",
      roundWinner: input.targetDied ? "DUMMY" : null
    };
  }

  if (input.hitObstacle) {
    return {
      destroyBullet: true,
      damagedActor: null,
      combatEvent: "SHOT BLOCKED",
      soundTarget: null,
      roundWinner: null
    };
  }

  if (input.outOfBounds) {
    return {
      destroyBullet: true,
      damagedActor: null,
      combatEvent: null,
      soundTarget: null,
      roundWinner: null
    };
  }

  return {
    destroyBullet: false,
    damagedActor: null,
    combatEvent: null,
    soundTarget: null,
    roundWinner: null
  };
}

export function resolveHazardOutcome(input: HazardResolutionInput): HazardResolutionResult {
  if (!input.triggered) {
    return {
      combatEvent: null,
      roundWinner: null
    };
  }

  return {
    combatEvent: `${input.actorId.toUpperCase()} HAZARD -${input.damage}`,
    roundWinner: input.actorDied
      ? input.actorId === "player"
        ? "DUMMY"
        : "PLAYER"
      : null
  };
}
