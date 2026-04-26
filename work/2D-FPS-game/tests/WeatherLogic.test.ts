import gameBalance from "../assets/data/game-balance.json";
import {
  createWeatherState,
  resolveMovementMultiplier,
  resolveWindMultiplier,
  rotateWeather,
  type WeatherConfig,
  type WeatherType
} from "../src/domain/environment/WeatherLogic";

describe("WeatherLogic", () => {
  const config = gameBalance.weather as WeatherConfig;

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
});
