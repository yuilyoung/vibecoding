export type WeatherType = "clear" | "rain" | "fog" | "sandstorm" | "storm";

export interface WeatherTypeConfig {
  readonly weight: number;
  readonly movementMultiplier: number;
  readonly visionRange: number;
  readonly windStrengthMultiplier: number;
  readonly minesDisabled: boolean;
  readonly particleCount: number;
  readonly flashIntervalMs?: number;
}

export interface WeatherConfig {
  readonly rotationMode: "perRound" | "static" | "timed";
  readonly types: Readonly<Record<WeatherType, Readonly<WeatherTypeConfig>>>;
}

export interface WeatherState {
  readonly type: WeatherType;
  readonly movementMultiplier: number;
  readonly visionRange: number;
  readonly windStrengthMultiplier: number;
  readonly minesDisabled: boolean;
}

const WEATHER_TYPES: readonly WeatherType[] = ["clear", "rain", "fog", "sandstorm", "storm"];

export function createWeatherState(type: WeatherType, config: WeatherConfig): WeatherState {
  const weatherType = config.types[type];

  return {
    type,
    movementMultiplier: weatherType.movementMultiplier,
    visionRange: weatherType.visionRange,
    windStrengthMultiplier: weatherType.windStrengthMultiplier,
    minesDisabled: weatherType.minesDisabled
  };
}

export function rotateWeather(previous: WeatherState | null, rng: () => number, config: WeatherConfig): WeatherState {
  const candidates = WEATHER_TYPES.filter((type) => config.types[type].weight > 0);
  const pool = candidates.length === 0 ? (["clear"] as const) : candidates;
  const selectionPool = previous === null
    ? pool
    : (pool.filter((type) => type !== previous.type) as readonly WeatherType[]);
  const effectivePool = selectionPool.length > 0 ? selectionPool : pool;
  const totalWeight = effectivePool.reduce((sum, type) => sum + Math.max(0, config.types[type].weight), 0);

  if (totalWeight <= 0) {
    return createWeatherState(effectivePool[0], config);
  }

  let roll = sanitizeRng(rng) * totalWeight;
  for (const type of effectivePool) {
    roll -= Math.max(0, config.types[type].weight);
    if (roll < 0) {
      return createWeatherState(type, config);
    }
  }

  return createWeatherState(effectivePool[effectivePool.length - 1], config);
}

export function resolveMovementMultiplier(weather: WeatherState): number {
  return weather.movementMultiplier;
}

export function resolveWindMultiplier(weather: WeatherState): number {
  return weather.windStrengthMultiplier;
}

function sanitizeRng(rng: () => number): number {
  const value = rng();
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999999, Math.max(0, value));
}
