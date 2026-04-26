import gameBalance from "../assets/data/game-balance.json";
import {
  createWeatherTimer,
  createWeatherState,
  resolveMovementMultiplier,
  resolveWindMultiplier,
  rotateWeather,
  tickWeatherTimer,
  type WeatherConfig,
  type WeatherType
} from "../src/domain/environment/WeatherLogic";

describe("WeatherLogic", () => {
  const config = gameBalance.weather as unknown as WeatherConfig;

  it("creates weather state from balance config", () => {
    expect(createWeatherState("rain", config)).toEqual({
      type: "rain",
      movementMultiplier: 0.85,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: true
    });
  });

  it("rotates deterministically with weighted selection", () => {
    expect(rotateWeather(null, () => 0, config).type).toBe("clear" satisfies WeatherType);
    expect(rotateWeather(null, () => 0.99, config).type).toBe("storm" satisfies WeatherType);
  });

  it("avoids repeating the immediate previous weather when alternatives exist", () => {
    expect(rotateWeather(createWeatherState("clear", config), () => 0, config).type).toBe("rain");
  });

  it("exposes movement and wind multipliers from weather state", () => {
    const weather = createWeatherState("sandstorm", config);

    expect(resolveMovementMultiplier(weather)).toBe(0.95);
    expect(resolveWindMultiplier(weather)).toBe(2);
  });

  it("creates a timed weather timer with a sampled duration", () => {
    const timedConfig: WeatherConfig = {
      ...config,
      rotationMode: "timed",
      durationRangeMs: [1000, 2000]
    };
    const rngValues = [0, 0.5];
    let rngIndex = 0;
    const timer = createWeatherTimer(null, 5000, () => rngValues[rngIndex++] ?? 0, timedConfig);

    expect(timer).toEqual({
      weather: createWeatherState("clear", timedConfig),
      durationMs: 1500,
      startedAtMs: 5000,
      nextChangeAtMs: 6500
    });
  });

  it("rotates timed weather when the timer elapses and reschedules the next window", () => {
    const timedConfig: WeatherConfig = {
      ...config,
      rotationMode: "timed",
      durationRangeMs: [1000, 1000]
    };
    const timer = createWeatherTimer(createWeatherState("clear", timedConfig), 100, () => 0, timedConfig);
    const nextTimer = tickWeatherTimer(timer, 1100, () => 0, timedConfig);

    expect(nextTimer).toEqual({
      weather: createWeatherState("rain", timedConfig),
      durationMs: 1000,
      startedAtMs: 1100,
      nextChangeAtMs: 2100
    });
  });

  it("leaves timed weather unchanged before expiry and ignores non-timed rotation modes", () => {
    const timedConfig: WeatherConfig = {
      ...config,
      rotationMode: "timed",
      durationRangeMs: [1000, 1000]
    };
    const timer = createWeatherTimer(createWeatherState("fog", timedConfig), 0, () => 0, timedConfig);

    expect(tickWeatherTimer(timer, 999, () => 0.99, timedConfig)).toBe(timer);
    expect(tickWeatherTimer(timer, 2000, () => 0.99, { ...timedConfig, rotationMode: "perRound" })).toBe(timer);
  });
});
