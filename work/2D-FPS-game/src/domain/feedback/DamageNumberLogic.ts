export interface DamageNumberConfig {
  readonly text: string;
  readonly color: string;
  readonly fontSize: number;
  readonly floatDistance: number;
  readonly durationMs: number;
}

export function resolveDamageNumber(
  damage: number,
  isCritical: boolean,
  isSelfHarm = false,
): DamageNumberConfig {
  if (damage <= 0) {
    return { text: "0", color: "#aaaaaa", fontSize: 12, floatDistance: 20, durationMs: 400 };
  }
  if (isCritical) {
    return { text: String(damage), color: "#ffcc00", fontSize: 18, floatDistance: 35, durationMs: 700 };
  }
  return {
    text: String(damage),
    color: isSelfHarm ? "#ff8844" : "#ffffff",
    fontSize: 14,
    floatDistance: 28,
    durationMs: 600,
  };
}
