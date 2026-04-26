import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    }
  }
}));

import { WeatherRenderer } from "../src/scenes/weather-renderer";
import type { WeatherState } from "../src/domain/environment/WeatherLogic";
import type { GameBalanceWeather } from "../src/scenes/scene-types";

class FakeRectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public alpha: number;
  public visible = true;
  public fillColor: number;
  public fillAlpha: number;
  public destroyed = false;

  public constructor(x: number, y: number, width: number, height: number, fillColor: number, alpha: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fillColor = fillColor;
    this.fillAlpha = alpha;
    this.alpha = alpha;
  }

  public setDepth(): this { return this; }

  public setScrollFactor(): this { return this; }

  public setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  public setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  public setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  public setFillStyle(fillColor: number, alpha: number): this {
    this.fillColor = fillColor;
    this.fillAlpha = alpha;
    return this;
  }

  public destroy(): void {
    this.destroyed = true;
  }
}

interface FakeScene {
  add: {
    rectangle: (x: number, y: number, width: number, height: number, color: number, alpha: number) => FakeRectangle;
  };
  scale: {
    gameSize: {
      width: number;
      height: number;
    };
  };
}

const createWeatherState = (type: WeatherState["type"]): WeatherState => ({
  type,
  movementMultiplier: 1,
  visionRange: 300,
  windStrengthMultiplier: 1,
  minesDisabled: false
});

const createWeatherConfig = (multiplier = 1): GameBalanceWeather & { readonly particleCountMultiplier: number } => ({
  enabled: true,
  rotationMode: "timed",
  durationRangeMs: [60000, 120000],
  particleCountMultiplier: multiplier,
  soundChannels: {
    rain: { cue: "weather.rain.loop", volume: 0.6, fadeMs: 800 },
    sandstorm: { cue: "weather.sandstorm.loop", volume: 0.7, fadeMs: 800 },
    storm: { cue: "weather.storm.loop", volume: 0.65, fadeMs: 800 }
  },
  types: {
    clear: { weight: 1, movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
    rain: { weight: 1, movementMultiplier: 0.85, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: true, particleCount: 50 },
    fog: { weight: 1, movementMultiplier: 1, visionRange: 150, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
    sandstorm: { weight: 1, movementMultiplier: 0.95, visionRange: 220, windStrengthMultiplier: 2, minesDisabled: false, particleCount: 30 },
    storm: { weight: 1, movementMultiplier: 0.9, visionRange: 260, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0, flashIntervalMs: 900 }
  }
});

const createScene = (): { scene: FakeScene; rectangles: FakeRectangle[] } => {
  const rectangles: FakeRectangle[] = [];

  return {
    scene: {
      add: {
        rectangle: (x, y, width, height, color, alpha) => {
          const rectangle = new FakeRectangle(x, y, width, height, color, alpha);
          rectangles.push(rectangle);
          return rectangle;
        }
      },
      scale: {
        gameSize: {
          width: 960,
          height: 540
        }
      }
    },
    rectangles
  };
};

describe("WeatherRenderer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("reuses pooled particles when applyWeather is called with the same weather type", () => {
    const { scene, rectangles } = createScene();
    const renderer = new WeatherRenderer(scene as never, createWeatherConfig());

    renderer.applyWeather(createWeatherState("rain"));
    const particleRects = rectangles.slice(2);
    const firstParticle = particleRects[0];
    const initialCount = particleRects.length;
    const initialPosition = { x: firstParticle.x, y: firstParticle.y };

    renderer.update(16, 480, 270);
    const movedPosition = { x: firstParticle.x, y: firstParticle.y };
    expect(movedPosition.y).toBeGreaterThan(initialPosition.y);

    renderer.applyWeather(createWeatherState("rain"));
    expect(rectangles.slice(2)).toHaveLength(initialCount);
    expect(firstParticle.destroyed).toBe(false);
    expect(firstParticle.x).toBe(movedPosition.x);
    expect(firstParticle.y).toBe(movedPosition.y);
    expect(renderer.getDebugState().particleCount).toBe(50);
  });

  it("applies particleCountMultiplier and hides inactive pooled particles instead of destroying them", () => {
    const { scene, rectangles } = createScene();
    const renderer = new WeatherRenderer(scene as never, createWeatherConfig(0.5));

    renderer.applyWeather(createWeatherState("rain"));
    expect(renderer.getDebugState().particleCount).toBe(25);
    expect(rectangles.slice(2)).toHaveLength(25);

    renderer.applyWeather(createWeatherState("sandstorm"));
    const particleRects = rectangles.slice(2);
    expect(renderer.getDebugState().particleCount).toBe(15);
    expect(particleRects).toHaveLength(25);
    expect(particleRects.slice(0, 15).every((particle) => particle.visible)).toBe(true);
    expect(particleRects.slice(15).every((particle) => !particle.visible && !particle.destroyed)).toBe(true);
  });

  it("reuses the existing pool across weather-type changes and updates visuals for the new particle style", () => {
    const { scene, rectangles } = createScene();
    const renderer = new WeatherRenderer(scene as never, createWeatherConfig());

    renderer.applyWeather(createWeatherState("rain"));
    const rainParticleRects = rectangles.slice(2);

    renderer.applyWeather(createWeatherState("sandstorm"));
    const sandstormParticleRects = rectangles.slice(2);
    expect(sandstormParticleRects).toEqual(rainParticleRects);
    expect(renderer.getDebugState().particleCount).toBe(30);
    expect(sandstormParticleRects[0].width).toBe(6);
    expect(sandstormParticleRects[0].height).toBe(2);
    expect(sandstormParticleRects[0].fillColor).toBe(0xe9c46a);
    expect(sandstormParticleRects.slice(30).every((particle) => !particle.visible)).toBe(true);
  });

  it("destroys all pooled particles and overlays during destroy", () => {
    const { scene, rectangles } = createScene();
    const renderer = new WeatherRenderer(scene as never, createWeatherConfig(1.5));

    renderer.applyWeather(createWeatherState("rain"));
    renderer.applyWeather(createWeatherState("clear"));
    renderer.destroy();

    expect(rectangles.every((rectangle) => rectangle.destroyed)).toBe(true);
    expect(renderer.getDebugState().particleCount).toBe(0);
  });
});
