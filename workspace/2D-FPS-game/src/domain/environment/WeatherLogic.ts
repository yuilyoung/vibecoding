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
  readonly durationRangeMs: readonly [number, number];
  readonly particleCountMultiplier: number;
  readonly soundChannels: Readonly<Partial<Record<Extract<WeatherType, "rain" | "sandstorm" | "storm">, {
    readonly cue: string;
    readonly volume: number;
    readonly fadeMs: number;
  }>>>;
  readonly types: Readonly<Record<WeatherType, Readonly<WeatherTypeConfig>>>;
}

export interface WeatherState {
  readonly type: WeatherType;
  readonly movementMultiplier: number;
  readonly visionRange: number;
  readonly windStrengthMultiplier: number;
  readonly minesDisabled: boolean;
}

export interface WeatherTimer {
  readonly weather: WeatherState;
  readonly durationMs: number;
  readonly startedAtMs: number;
  readonly nextChangeAtMs: number;
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

export function createWeatherTimer(
  previous: WeatherState | null,
  nowMs: number,
  rng: () => number,
  config: WeatherConfig
): WeatherTimer {
  const weather = previous ?? rotateWeather(null, rng, config);
  const durationMs = resolveDurationMs(config, rng);

  return {
    weather,
    durationMs,
    startedAtMs: nowMs,
    nextChangeAtMs: nowMs + durationMs
  };
}

export function tickWeatherTimer(
  timer: WeatherTimer,
  nowMs: number,
  rng: () => number,
  config: WeatherConfig
): WeatherTimer {
  if (config.rotationMode !== "timed" || nowMs < timer.nextChangeAtMs) {
    return timer;
  }

  let nextWeather = timer.weather;
  let startedAtMs = timer.startedAtMs;
  let nextChangeAtMs = timer.nextChangeAtMs;
  let durationMs = timer.durationMs;

  while (nowMs >= nextChangeAtMs) {
    nextWeather = rotateWeather(nextWeather, rng, config);
    startedAtMs = nextChangeAtMs;
    durationMs = resolveDurationMs(config, rng);
    nextChangeAtMs = startedAtMs + durationMs;
  }

  return {
    weather: nextWeather,
    durationMs,
    startedAtMs,
    nextChangeAtMs
  };
}

function sanitizeRng(rng: () => number): number {
  const value = rng();
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999999, Math.max(0, value));
}

function resolveDurationMs(config: WeatherConfig, rng: () => number): number {
  const range = config.durationRangeMs ?? [0, 0];
  const min = Math.max(0, Math.min(range[0] ?? 0, range[1] ?? 0));
  const max = Math.max(min, Math.max(range[0] ?? 0, range[1] ?? 0));

  if (min === max) {
    return min;
  }

  return Math.round(min + (max - min) * sanitizeRng(rng));
}
