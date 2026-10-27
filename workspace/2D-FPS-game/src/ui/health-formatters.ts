export function formatHealthValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return String(Math.max(0, Math.round(value)));
}

export function formatHealthPair(value: number, maxValue: number): string {
  return `${formatHealthValue(value)}/${formatHealthValue(maxValue)}`;
}
