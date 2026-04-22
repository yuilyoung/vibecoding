export interface WindState {
  readonly angleDegrees: number;
  readonly strength: number;
}

export interface WindConfig {
  readonly strengthRange: readonly [number, number];
  readonly angleStepDegrees: number;
}

export function createWindState(input: { readonly angleDegrees: number; readonly strength: number }): WindState {
  return {
    angleDegrees: normalizeAngle(input.angleDegrees),
    strength: normalizeStrength(input.strength)
  };
}

export function rotateWind(previous: WindState | null, rng: () => number, config: WindConfig): WindState {
  const stepDegrees = Math.max(1, Math.floor(config.angleStepDegrees));
  const angleStepCount = Math.max(1, Math.floor(360 / stepDegrees));
  const maxStrength = Math.max(0, Math.floor(config.strengthRange[1]));
  const nextAngle = previous === null
    ? randomIndex(rng, angleStepCount) * stepDegrees
    : previous.angleDegrees + randomIndex(rng, angleStepCount) * stepDegrees;

  return createWindState({
    angleDegrees: nextAngle,
    strength: randomIndex(rng, maxStrength + 1)
  });
}

export function computeForce(state: WindState, forceScale: number): { x: number; y: number } {
  const magnitude = Math.max(0, forceScale) * Math.max(0, state.strength);
  const angleRadians = (normalizeAngle(state.angleDegrees) * Math.PI) / 180;
  return {
    x: Math.cos(angleRadians) * magnitude,
    y: Math.sin(angleRadians) * magnitude
  };
}

function normalizeAngle(angleDegrees: number): number {
  const normalized = angleDegrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeStrength(strength: number): number {
  return Math.max(0, Math.round(strength));
}

function randomIndex(rng: () => number, length: number): number {
  if (length <= 1) {
    return 0;
  }

  const value = rng();
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
}
