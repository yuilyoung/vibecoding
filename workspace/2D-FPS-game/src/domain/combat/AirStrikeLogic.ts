import { resolveExplosion } from "./ExplosionLogic";

export interface AirStrikeConfig {
  readonly blastCount?: number;
  readonly blastDelayMs?: number;
  readonly spreadRadius?: number;
  readonly blastRadius?: number;
  readonly damage?: number;
  readonly knockback?: number;
}

export interface AirStrikeBlast {
  readonly index: number;
  readonly scheduledAtMs: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly damage: number;
  readonly knockback: number;
  readonly impacts: ReturnType<typeof resolveExplosion>;
}

export interface AirStrikeState {
  readonly targetX: number;
  readonly targetY: number;
  readonly config: Required<AirStrikeConfig>;
  readonly elapsedMs: number;
  readonly nextBlastIndex: number;
  readonly completed: boolean;
}

export interface AirStrikeAdvanceResult {
  readonly state: AirStrikeState;
  readonly blasts: readonly AirStrikeBlast[];
}

const DEFAULT_CONFIG: Required<AirStrikeConfig> = {
  blastCount: 5,
  blastDelayMs: 320,
  spreadRadius: 48,
  blastRadius: 60,
  damage: 30,
  knockback: 120
};

const DEFAULT_OFFSET_PATTERN: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 0 },
  { x: -0.58, y: -0.24 },
  { x: 0.42, y: -0.38 },
  { x: -0.35, y: 0.46 },
  { x: 0.52, y: 0.31 }
];

export function createAirStrike(targetX: number, targetY: number, config: AirStrikeConfig = {}): AirStrikeState {
  return {
    targetX,
    targetY,
    config: {
      ...DEFAULT_CONFIG,
      ...config
    },
    elapsedMs: 0,
    nextBlastIndex: 0,
    completed: false
  };
}

export function advanceAirStrike(state: AirStrikeState, deltaMs: number): AirStrikeAdvanceResult {
  if (state.completed) {
    return {
      state,
      blasts: []
    };
  }

  const nextElapsedMs = Math.max(0, state.elapsedMs + deltaMs);
  const readyBlastCount = Math.min(
    state.config.blastCount,
    Math.floor(nextElapsedMs / state.config.blastDelayMs)
  );
  const blasts: AirStrikeBlast[] = [];

  for (let index = state.nextBlastIndex; index < readyBlastCount; index += 1) {
    const offset = getOffset(index, state.config.spreadRadius);
    const blastX = state.targetX + offset.x;
    const blastY = state.targetY + offset.y;

    blasts.push({
      index,
      scheduledAtMs: (index + 1) * state.config.blastDelayMs,
      x: blastX,
      y: blastY,
      radius: state.config.blastRadius,
      damage: state.config.damage,
      knockback: state.config.knockback,
      impacts: resolveExplosion({
        centerX: blastX,
        centerY: blastY,
        blastRadius: state.config.blastRadius,
        baseDamage: state.config.damage,
        knockback: state.config.knockback,
        targets: []
      })
    });
  }

  const nextBlastIndex = state.nextBlastIndex + blasts.length;
  const completed = nextBlastIndex >= state.config.blastCount;

  return {
    state: {
      ...state,
      elapsedMs: nextElapsedMs,
      nextBlastIndex,
      completed
    },
    blasts
  };
}

function getOffset(index: number, spreadRadius: number): { readonly x: number; readonly y: number } {
  const pattern = DEFAULT_OFFSET_PATTERN[index] ?? { x: 0, y: 0 };
  return {
    x: pattern.x * spreadRadius,
    y: pattern.y * spreadRadius
  };
}
