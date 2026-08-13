export interface RespawnFxState {
  readonly alpha: number;
  readonly scale: number;
}

export interface PlayerVisualInput {
  readonly isDead: boolean;
  readonly isStunned: boolean;
  readonly isSprinting: boolean;
  readonly muzzleFlashActive: boolean;
  readonly respawnFx: RespawnFxState;
}

export interface ActorVisualState {
  readonly tint: number;
  readonly alpha: number;
  readonly scale: number;
}

export type DummyDecisionVisualMode = "chase" | "retreat" | "strafe" | "flank" | "avoid-hazard" | "cover" | "reposition";

export function getRespawnFxState(now: number, untilMs: number, durationMs: number): RespawnFxState {
  if (now >= untilMs) {
    return {
      alpha: 1,
      scale: 1
    };
  }

  const progress = 1 - Math.max(0, untilMs - now) / durationMs;
  return {
    alpha: 0.68 + progress * 0.32,
    scale: 1.18 - progress * 0.18
  };
}

export function getPlayerVisualState(input: PlayerVisualInput): ActorVisualState {
  if (input.isDead) {
    return {
      tint: 0x5a6a75,
      alpha: 0.35,
      scale: 0.82
    };
  }

  if (input.isStunned) {
    return {
      tint: 0xfff27a,
      alpha: 1,
      scale: 0.94
    };
  }

  const flashScale = input.muzzleFlashActive ? 1.04 : 1;
  return {
    tint: 0xffffff,
    alpha: input.respawnFx.alpha,
    scale: (input.isSprinting ? 1.08 : 1) * input.respawnFx.scale * flashScale
  };
}

export function getDummyVisualState(input: {
  readonly isDead: boolean;
  readonly healthRatio: number;
  readonly decision: DummyDecisionVisualMode;
  readonly respawnFxScale: number;
}): ActorVisualState {
  if (input.isDead) {
    return {
      tint: interpolateTint(0x4f1717, 0xffffff, input.healthRatio),
      alpha: 0.35,
      scale: 0.82
    };
  }

  const scale = input.decision === "flank"
    ? 1.06 * input.respawnFxScale
    : input.decision === "avoid-hazard"
      ? 1.12 * input.respawnFxScale
      : input.respawnFxScale;

  return {
    tint: interpolateTint(0x4f1717, 0xffffff, input.healthRatio),
    alpha: 1,
    scale
  };
}

function interpolateTint(from: number, to: number, ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;

  const r = Math.round(fromR + (toR - fromR) * clamped);
  const g = Math.round(fromG + (toG - fromG) * clamped);
  const b = Math.round(fromB + (toB - fromB) * clamped);

  return (r << 16) | (g << 8) | b;
}
