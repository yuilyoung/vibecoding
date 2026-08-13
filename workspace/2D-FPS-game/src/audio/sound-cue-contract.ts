import type { GameBalanceWeather } from "../scenes/scene-types";
import type { HudWeatherChangedDetail } from "../ui/hud-events";

export type WeatherSoundCueKey =
  | "weather.rain.loop"
  | "weather.sandstorm.loop"
  | "weather.storm.loop";

export type WeatherSoundWeatherType = Extract<HudWeatherChangedDetail["type"], "rain" | "sandstorm" | "storm">;

export interface WeatherSoundChannelConfig {
  readonly cue: WeatherSoundCueKey;
  readonly volume: number;
  readonly fadeMs: number;
}

export interface WeatherSoundContract {
  readonly rain?: WeatherSoundChannelConfig;
  readonly sandstorm?: WeatherSoundChannelConfig;
  readonly storm?: WeatherSoundChannelConfig;
}

export type WeatherSoundQueueItem =
  | {
      readonly action: "play";
      readonly weatherType: WeatherSoundWeatherType;
      readonly cue: WeatherSoundCueKey;
      readonly volume: number;
      readonly fadeMs: number;
      readonly priority: 18;
    }
  | {
      readonly action: "stop";
      readonly cue: WeatherSoundCueKey;
      readonly fadeMs: number;
      readonly priority: 18;
      readonly reason: "WEATHER_CLEAR" | "MATCH_RESET";
    };

const WEATHER_SOUND_PRIORITY = 18 as const;
const WEATHER_SOUND_TYPES = ["rain", "sandstorm", "storm"] as const;

type WeatherSoundConfigSource = GameBalanceWeather;

export function resolveWeatherSoundContract(weather: WeatherSoundConfigSource): WeatherSoundContract {
  const contract: Partial<Record<WeatherSoundWeatherType, WeatherSoundChannelConfig>> = {};

  for (const type of WEATHER_SOUND_TYPES) {
    const channel = weather.soundChannels?.[type];
    if (channel === undefined || channel === null) {
      continue;
    }

    const cue = isWeatherSoundCueKey(channel.cue) ? channel.cue : defaultWeatherSoundCue(type);
    contract[type] = {
      cue,
      volume: typeof channel.volume === "number" && Number.isFinite(channel.volume) ? clampVolume(channel.volume) : 1,
      fadeMs: typeof channel.fadeMs === "number" && Number.isFinite(channel.fadeMs) ? Math.max(0, channel.fadeMs) : 0
    };
  }

  return contract;
}

export function resolveWeatherSoundQueueItem(
  weather: WeatherSoundConfigSource,
  nextWeather: HudWeatherChangedDetail,
  reason?: HudWeatherChangedDetail["soundResetReason"]
): WeatherSoundQueueItem | null {
  if (reason === "MATCH_RESET") {
    return null;
  }

  const channel = resolveWeatherSoundContract(weather)[nextWeather.type as WeatherSoundWeatherType];
  if (channel === undefined) {
    return null;
  }

  return {
    action: "play",
    weatherType: nextWeather.type as WeatherSoundWeatherType,
    cue: channel.cue,
    volume: channel.volume,
    fadeMs: channel.fadeMs,
    priority: WEATHER_SOUND_PRIORITY
  };
}

export function createWeatherSoundStopItem(
  cue: WeatherSoundCueKey,
  fadeMs: number,
  reason: "WEATHER_CLEAR" | "MATCH_RESET"
): WeatherSoundQueueItem {
  return {
    action: "stop",
    cue,
    fadeMs: Math.max(0, fadeMs),
    priority: WEATHER_SOUND_PRIORITY,
    reason
  };
}

function defaultWeatherSoundCue(type: WeatherSoundWeatherType): WeatherSoundCueKey {
  switch (type) {
    case "rain":
      return "weather.rain.loop";
    case "sandstorm":
      return "weather.sandstorm.loop";
    case "storm":
      return "weather.storm.loop";
  }
}

function isWeatherSoundCueKey(value: unknown): value is WeatherSoundCueKey {
  return value === "weather.rain.loop" || value === "weather.sandstorm.loop" || value === "weather.storm.loop";
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
