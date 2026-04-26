import Phaser from "phaser";
import type { WeatherState } from "../domain/environment/WeatherLogic";
import type { GameBalanceWeather } from "./scene-types";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

interface WeatherParticle {
  readonly sprite: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
  visualType: "rain" | "sandstorm" | null;
}

export class WeatherRenderer {
  private readonly particles: WeatherParticle[] = [];
  private readonly fogOverlay: Phaser.GameObjects.Rectangle;
  private readonly flashOverlay: Phaser.GameObjects.Rectangle;
  private currentWeather: WeatherState;
  private activeParticleCount = 0;
  private flashClockMs = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly weatherConfig: GameBalanceWeather
  ) {
    this.currentWeather = {
      type: "clear",
      movementMultiplier: 1,
      visionRange: VIEW_WIDTH,
      windStrengthMultiplier: 1,
      minesDisabled: false
    };
    this.fogOverlay = this.scene.add.rectangle(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5, VIEW_WIDTH, VIEW_HEIGHT, 0xbfd7ea, 0)
      .setDepth(40)
      .setScrollFactor(0);
    this.flashOverlay = this.scene.add.rectangle(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5, VIEW_WIDTH, VIEW_HEIGHT, 0xf8fafc, 0)
      .setDepth(41)
      .setScrollFactor(0);
  }

  public applyWeather(nextWeather: WeatherState): void {
    const previousType = this.currentWeather.type;
    this.currentWeather = nextWeather;
    this.syncParticlePool(previousType !== nextWeather.type);
    this.fogOverlay.setAlpha(nextWeather.type === "fog" ? 0.34 : 0);
    if (nextWeather.type !== "storm") {
      this.flashClockMs = 0;
      this.flashOverlay.setAlpha(0);
    }
  }

  public update(deltaMs: number, focusX: number, focusY: number): void {
    const dt = Math.max(0.001, deltaMs / 1000);
    const sceneWidth = Number(this.scene.scale.gameSize.width) || VIEW_WIDTH;
    const sceneHeight = Number(this.scene.scale.gameSize.height) || VIEW_HEIGHT;
    const fogAlpha = this.currentWeather.type === "fog"
      ? Phaser.Math.Clamp(0.15 + ((sceneWidth - Math.min(sceneWidth, this.currentWeather.visionRange)) / sceneWidth) * 0.35, 0.18, 0.5)
      : 0;

    this.fogOverlay
      .setAlpha(fogAlpha)
      .setPosition(sceneWidth * 0.5, sceneHeight * 0.5);
    this.flashOverlay.setPosition(sceneWidth * 0.5, sceneHeight * 0.5);

    for (let index = 0; index < this.activeParticleCount; index += 1) {
      const particle = this.particles[index];
      particle.sprite.x += particle.velocityX * dt;
      particle.sprite.y += particle.velocityY * dt;
      if (particle.sprite.x < -24 || particle.sprite.x > sceneWidth + 24 || particle.sprite.y < -24 || particle.sprite.y > sceneHeight + 24) {
        this.resetParticle(particle, sceneWidth, sceneHeight);
      }
    }

    if (this.currentWeather.type === "storm") {
      const flashIntervalMs = this.weatherConfig.types.storm.flashIntervalMs ?? 900;
      this.flashClockMs = (this.flashClockMs + deltaMs) % flashIntervalMs;
      this.flashOverlay.setAlpha(this.flashClockMs < 100 ? 0.18 : 0);
    }

    if (this.currentWeather.type === "fog") {
      this.fogOverlay.setPosition(sceneWidth * 0.5 + (focusX - sceneWidth * 0.5) * 0.02, sceneHeight * 0.5 + (focusY - sceneHeight * 0.5) * 0.02);
    }
  }

  public getDebugState(): { type: WeatherState["type"]; particleCount: number; fogActive: boolean; flashActive: boolean } {
    return {
      type: this.currentWeather.type,
      particleCount: this.activeParticleCount,
      fogActive: this.currentWeather.type === "fog" && this.fogOverlay.alpha > 0,
      flashActive: this.currentWeather.type === "storm" && this.flashOverlay.alpha > 0
    };
  }

  public destroy(): void {
    for (const particle of this.particles) {
      particle.sprite.destroy();
    }
    this.particles.length = 0;
    this.activeParticleCount = 0;
    this.fogOverlay.destroy();
    this.flashOverlay.destroy();
  }

  private syncParticlePool(weatherTypeChanged: boolean): void {
    const previousActiveCount = this.activeParticleCount;
    const targetCount = this.getTargetParticleCount();
    const visualType = this.getParticleVisualType();
    this.ensureParticlePool(targetCount, visualType);
    this.activeParticleCount = targetCount;

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      if (index < targetCount) {
        particle.sprite.setVisible(true);
        const needsReset = weatherTypeChanged || index >= previousActiveCount || particle.visualType !== visualType;
        this.applyParticleVisual(particle, visualType);
        if (needsReset) {
          this.resetParticle(particle, VIEW_WIDTH, VIEW_HEIGHT, true);
        }
        continue;
      }

      this.deactivateParticle(particle);
    }
  }

  private getTargetParticleCount(): number {
    if (this.currentWeather.type === "rain" || this.currentWeather.type === "sandstorm") {
      const baseCount = Math.max(0, this.weatherConfig.types[this.currentWeather.type].particleCount);
      const multiplier = this.getParticleCountMultiplier();
      return Math.max(0, Math.round(baseCount * multiplier));
    }

    return 0;
  }

  private getParticleCountMultiplier(): number {
    const value = (this.weatherConfig as GameBalanceWeather & { readonly particleCountMultiplier?: number }).particleCountMultiplier;
    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.max(0, value ?? 1);
  }

  private getParticleVisualType(): WeatherParticle["visualType"] {
    return this.currentWeather.type === "rain" || this.currentWeather.type === "sandstorm"
      ? this.currentWeather.type
      : null;
  }

  private ensureParticlePool(targetCount: number, visualType: WeatherParticle["visualType"]): void {
    while (this.particles.length < targetCount) {
      const sprite = this.scene.add.rectangle(0, 0, 2, 2, 0xffffff, 0)
        .setDepth(39)
        .setScrollFactor(0)
        .setVisible(false);
      const particle: WeatherParticle = { sprite, velocityX: 0, velocityY: 0, visualType: null };
      this.applyParticleVisual(particle, visualType);
      this.deactivateParticle(particle);
      this.particles.push(particle);
    }
  }

  private applyParticleVisual(particle: WeatherParticle, visualType: WeatherParticle["visualType"]): void {
    if (visualType === null) {
      particle.visualType = null;
      return;
    }

    const isRain = visualType === "rain";
    particle.sprite
      .setSize(isRain ? 2 : 6, isRain ? 16 : 2)
      .setFillStyle(isRain ? 0xbde0fe : 0xe9c46a, isRain ? 0.42 : 0.38);
    particle.visualType = visualType;
  }

  private deactivateParticle(particle: WeatherParticle): void {
    particle.sprite.setVisible(false);
    particle.sprite.x = -32;
    particle.sprite.y = -32;
    particle.velocityX = 0;
    particle.velocityY = 0;
  }

  private resetParticle(particle: WeatherParticle, width: number, height: number, randomY = false): void {
    particle.sprite.x = Math.random() * width;
    particle.sprite.y = randomY ? Math.random() * height : -12;

    if (this.currentWeather.type === "sandstorm") {
      particle.velocityX = 120 + Math.random() * 80;
      particle.velocityY = -12 + Math.random() * 24;
      return;
    }

    particle.velocityX = -14 + Math.random() * 28;
    particle.velocityY = 220 + Math.random() * 120;
  }
}
