import gameBalance from "../assets/data/game-balance.json";
import { createWeatherState, type WeatherConfig } from "../src/domain/environment/WeatherLogic";
import { pointInCircle, pointInPolygon, resolveZoneWeather } from "../src/domain/map/MapZoneLogic";
import type { StageWeatherZoneDefinition } from "../src/domain/map/StageDefinition";

describe("MapZoneLogic", () => {
  const config = gameBalance.weather as unknown as WeatherConfig;

  it("treats polygon boundary points as inside", () => {
    const polygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ] as const;

    expect(pointInPolygon([0, 5], polygon)).toBe(true);
    expect(pointInPolygon([10, 10], polygon)).toBe(true);
  });

  it("distinguishes polygon interior from exterior points", () => {
    const polygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ] as const;

    expect(pointInPolygon([5, 5], polygon)).toBe(true);
    expect(pointInPolygon([15, 5], polygon)).toBe(false);
  });

  it("treats circle boundary points as inside", () => {
    expect(pointInCircle([3, 4], 0, 0, 5)).toBe(true);
    expect(pointInCircle([5.01, 0], 0, 0, 5)).toBe(false);
  });

  it("resolves the highest priority matching zone weather", () => {
    const globalWeather = createWeatherState("clear", config);
    const zones: readonly StageWeatherZoneDefinition[] = [
      {
        weather: "rain",
        priority: 1,
        shape: {
          kind: "circle",
          cx: 50,
          cy: 50,
          radius: 30
        }
      },
      {
        weather: "storm",
        priority: 5,
        shape: {
          kind: "polygon",
          points: [
            [25, 25],
            [75, 25],
            [75, 75],
            [25, 75]
          ]
        }
      }
    ];

    const resolved = resolveZoneWeather([50, 50], globalWeather, zones, config);

    expect(resolved.type).toBe("storm");
    expect(resolved).toEqual(createWeatherState("storm", config));
  });

  it("falls back to the global weather when no zone matches", () => {
    const globalWeather = createWeatherState("fog", config);
    const zones: readonly StageWeatherZoneDefinition[] = [{
      weather: "rain",
      shape: {
        kind: "polygon",
        points: [
          [100, 100],
          [140, 100],
          [140, 140],
          [100, 140]
        ]
      }
    }];

    expect(resolveZoneWeather([10, 10], globalWeather, zones, config)).toBe(globalWeather);
  });

  it("returns the global weather immediately when zones are undefined or empty", () => {
    const globalWeather = createWeatherState("sandstorm", config);

    expect(resolveZoneWeather([10, 10], globalWeather, undefined, config)).toBe(globalWeather);
    expect(resolveZoneWeather([10, 10], globalWeather, [], config)).toBe(globalWeather);
  });
});
