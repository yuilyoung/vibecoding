import {
  createWeatherSoundStopItem,
  resolveWeatherSoundContract,
  resolveWeatherSoundQueueItem
} from "../src/audio/sound-cue-contract";
import type { GameBalanceWeather } from "../src/scenes/scene-types";
import type { HudWeatherChangedDetail } from "../src/ui/hud-events";

describe("SoundCueContract", () => {
  const weatherConfig = {
    enabled: true,
    rotationMode: "perRound",
    durationRangeMs: [60000, 120000],
    particleCountMultiplier: 1,
    soundChannels: {
      rain: { cue: "weather.rain.loop", volume: 0.6, fadeMs: 800 },
      sandstorm: { cue: "weather.sandstorm.loop", volume: 0.7, fadeMs: 750 },
      storm: { cue: "weather.storm.loop", volume: 0.65, fadeMs: 900 }
    },
    types: {
      clear: { weight: 3, movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
      rain: { weight: 2, movementMultiplier: 0.85, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: true, particleCount: 50 },
      fog: { weight: 2, movementMultiplier: 1, visionRange: 150, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
      sandstorm: { weight: 1, movementMultiplier: 0.95, visionRange: 220, windStrengthMultiplier: 2, minesDisabled: false, particleCount: 30 },
      storm: { weight: 1, movementMultiplier: 0.9, visionRange: 260, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 }
    }
  } as const satisfies GameBalanceWeather & {
    readonly soundChannels: {
      readonly rain: { readonly cue: "weather.rain.loop"; readonly volume: 0.6; readonly fadeMs: 800 };
      readonly sandstorm: { readonly cue: "weather.sandstorm.loop"; readonly volume: 0.7; readonly fadeMs: 750 };
      readonly storm: { readonly cue: "weather.storm.loop"; readonly volume: 0.65; readonly fadeMs: 900 };
    };
  };

  const rainDetail: HudWeatherChangedDetail = {
    type: "rain",
    movementMultiplier: 0.85,
    visionRange: 300,
    windStrengthMultiplier: 1,
    minesDisabled: true
  };

  it("maps rain, sandstorm, and storm channels from weather balance config", () => {
    expect(resolveWeatherSoundContract(weatherConfig)).toEqual({
      rain: { cue: "weather.rain.loop", volume: 0.6, fadeMs: 800 },
      sandstorm: { cue: "weather.sandstorm.loop", volume: 0.7, fadeMs: 750 },
      storm: { cue: "weather.storm.loop", volume: 0.65, fadeMs: 900 }
    });
  });

  it("builds play queue items only for weather types with sound channels", () => {
    expect(resolveWeatherSoundQueueItem(weatherConfig, rainDetail)).toEqual({
      action: "play",
      weatherType: "rain",
      cue: "weather.rain.loop",
      volume: 0.6,
      fadeMs: 800,
      priority: 18
    });

    expect(resolveWeatherSoundQueueItem(weatherConfig, {
      ...rainDetail,
      type: "fog"
    })).toBeNull();
  });

  it("builds stop queue items for clear/reset transitions at the same weather priority", () => {
    expect(createWeatherSoundStopItem("weather.storm.loop", 900, "MATCH_RESET")).toEqual({
      action: "stop",
      cue: "weather.storm.loop",
      fadeMs: 900,
      priority: 18,
      reason: "MATCH_RESET"
    });
  });
});
