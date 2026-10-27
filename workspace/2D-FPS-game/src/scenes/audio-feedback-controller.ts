import Phaser from "phaser";
import { AudioCueLogic, type AudioCueRuleOverride, type AudioCueState } from "../domain/audio/AudioCueLogic";
import { GeneratedAudioCuePlayer, type AmbientCueKey, type GeneratedToneOverride } from "../domain/audio/GeneratedAudioCuePlayer";
import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "../domain/audio/SoundCueLogic";
import { resolveCameraFeedback, type CameraFeedbackEvent } from "../domain/feedback/CameraFeedbackLogic";
import { createWeatherSoundStopItem, type WeatherSoundCueKey, type WeatherSoundQueueItem } from "../audio/sound-cue-contract";
import type { AudioRuntimeSnapshot, GameBalanceAudio } from "./scene-types";

interface AudioFeedbackConfig {
  readonly maxSimultaneous?: number;
  readonly weatherLoopCooldownMs?: number;
  readonly cueProfiles?: Partial<Record<SoundCueKey, GeneratedToneOverride>>;
  readonly cueRules?: Partial<Record<SoundCueKey, AudioCueRuleOverride>>;
}

export class AudioFeedbackController {
  private readonly soundCueLogic: SoundCueLogic;
  private readonly audioCueLogic: AudioCueLogic;
  private readonly audioCuePlayer: GeneratedAudioCuePlayer;
  private audioCueState: AudioCueState;
  private lastSoundCue: SoundCueKey | "NONE";
  private weatherSoundQueue: WeatherSoundQueueItem[];
  private activeWeatherSoundCue: WeatherSoundCueKey | null;
  private readonly weatherLoopCooldownMs: number;
  private lastWeatherLoopStartedAtMsByCue: Partial<Record<WeatherSoundCueKey, number>>;
  private lastDroppedCue: string | null;
  private lastHazardCueStickyUntilMs: number;
  private cameraHitPauseUntilMs: number;
  private ambientCue: AmbientCueKey;
  private activeAmbientCue: AmbientCueKey | null;
  private destroyed: boolean;

  public constructor(
    private readonly scene: Phaser.Scene,
    config?: GameBalanceAudio | AudioFeedbackConfig,
    ambientCue: AmbientCueKey = "ambient.casual"
  ) {
    this.soundCueLogic = new SoundCueLogic();
    this.audioCueLogic = new AudioCueLogic(config?.cueRules);
    this.audioCuePlayer = new GeneratedAudioCuePlayer(config?.cueProfiles);
    this.audioCueState = {
      maxSimultaneous: Number.isFinite(config?.maxSimultaneous) ? Math.max(1, Math.floor(config?.maxSimultaneous as number)) : 3,
      lastPlayedAtMsByCue: {}
    };
    this.lastSoundCue = "NONE";
    this.weatherSoundQueue = [];
    this.activeWeatherSoundCue = null;
    this.weatherLoopCooldownMs = Number.isFinite(config?.weatherLoopCooldownMs)
      ? Math.max(0, Math.floor(config?.weatherLoopCooldownMs as number))
      : 1200;
    this.lastWeatherLoopStartedAtMsByCue = {};
    this.lastDroppedCue = null;
    this.lastHazardCueStickyUntilMs = 0;
    this.cameraHitPauseUntilMs = 0;
    this.ambientCue = ambientCue;
    this.activeAmbientCue = null;
    this.destroyed = false;
  }

  public setVolume(volume: number): void {
    this.audioCuePlayer.setVolume(volume);
  }

  public getLastSoundCue(): SoundCueKey | "NONE" {
    return this.lastSoundCue;
  }

  public getActiveWeatherSoundCue(): WeatherSoundCueKey | null {
    return this.activeWeatherSoundCue;
  }

  public getCameraHitPauseUntilMs(): number {
    return this.cameraHitPauseUntilMs;
  }

  public queueWeatherSoundCue(item: WeatherSoundQueueItem): void {
    if (this.destroyed) return;
    const now = this.scene.time.now;

    if (item.action === "stop") {
      if (this.activeWeatherSoundCue !== item.cue) {
        this.lastDroppedCue = item.cue;
        return;
      }

      this.weatherSoundQueue.push(item);
      this.audioCuePlayer.stopWeatherLoop(item.fadeMs);
      this.activeWeatherSoundCue = null;
      delete this.lastWeatherLoopStartedAtMsByCue[item.cue];
      this.lastDroppedCue = null;
      return;
    }

    if (this.activeWeatherSoundCue === item.cue) {
      this.lastDroppedCue = item.cue;
      return;
    }

    const lastStartedAtMs = this.lastWeatherLoopStartedAtMsByCue[item.cue];
    if (lastStartedAtMs !== undefined && now - lastStartedAtMs < this.weatherLoopCooldownMs) {
      this.lastDroppedCue = item.cue;
      return;
    }

    if (this.activeWeatherSoundCue !== null) {
      this.weatherSoundQueue.push(createWeatherSoundStopItem(this.activeWeatherSoundCue, item.fadeMs, "WEATHER_CLEAR"));
      this.audioCuePlayer.stopWeatherLoop(item.fadeMs);
      delete this.lastWeatherLoopStartedAtMsByCue[this.activeWeatherSoundCue];
    }

    this.weatherSoundQueue.push(item);
    if (this.audioCuePlayer.playWeatherLoop(item.cue, item.volume, item.fadeMs)) {
      this.activeWeatherSoundCue = item.cue;
      this.lastWeatherLoopStartedAtMsByCue[item.cue] = now;
      this.lastDroppedCue = null;
    } else {
      this.activeWeatherSoundCue = null;
      this.lastDroppedCue = item.cue;
    }
  }

  public getWeatherSoundQueue(): readonly WeatherSoundQueueItem[] {
    return this.weatherSoundQueue;
  }

  public clearWeatherSoundQueue(): void {
    this.weatherSoundQueue = [];
  }

  public setAmbientCue(cue: AmbientCueKey): void {
    this.ambientCue = cue;
  }

  public startAmbientLoop(cue: AmbientCueKey = this.ambientCue): void {
    if (this.destroyed) return;
    this.activeAmbientCue = this.audioCuePlayer.playAmbientLoop(cue, 0.55, 900) ? cue : null;
  }

  public stopAmbientLoop(fadeMs = 500): void {
    this.audioCuePlayer.stopAmbientLoop(fadeMs);
    this.activeAmbientCue = null;
  }

  public getRuntimeAudioSnapshot(): AudioRuntimeSnapshot {
    const playback = this.audioCuePlayer.getPlaybackSnapshot();
    return {
      activeWeatherLoopCue: this.activeWeatherSoundCue,
      activeAmbientLoopCue: this.activeAmbientCue,
      queuedWeatherSoundCount: this.weatherSoundQueue.length,
      lastDroppedCue: this.lastDroppedCue,
      maxSimultaneous: this.audioCueState.maxSimultaneous,
      weatherLoopCooldownMs: this.weatherLoopCooldownMs,
      ...playback
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.activeAmbientCue = null;
    this.activeWeatherSoundCue = null;
    this.audioCuePlayer.destroy();
  }

  public emitSoundCue(event: SoundCueEvent): void {
    if (this.destroyed) return;
    const now = this.scene.time.now;
    const fallbackCue = this.soundCueLogic.resolveCue(event);
    const decision = this.audioCueLogic.resolveCues([event], this.audioCueState, now);
    const nextCue = decision.play[0] ?? fallbackCue;

    if (this.lastSoundCue === "hazard.tick" && nextCue !== "hazard.tick" && now < this.lastHazardCueStickyUntilMs) {
      this.lastDroppedCue = nextCue;
      if (decision.play.length > 0) {
        this.audioCuePlayer.play(nextCue);
      }
      return;
    }

    this.lastSoundCue = nextCue;

    if (this.lastSoundCue === "hazard.tick") {
      this.lastHazardCueStickyUntilMs = now + 400;
    }

    if (decision.play.length > 0) {
      this.audioCuePlayer.play(this.lastSoundCue);
      this.audioCueState = {
        ...this.audioCueState,
        lastPlayedAtMsByCue: {
          ...this.audioCueState.lastPlayedAtMsByCue,
          [this.lastSoundCue]: now
        }
      };
      this.lastDroppedCue = decision.drop[0] ?? null;
    } else {
      this.lastDroppedCue = decision.drop[0] ?? nextCue;
    }

    if (event.kind === "match-start") {
      this.startAmbientLoop();
    }

    this.triggerCameraFeedbackForSoundEvent(event);
  }

  public triggerCameraFeedback(event: CameraFeedbackEvent): void {
    const feedback = resolveCameraFeedback(event);

    if (feedback.shake !== null) {
      this.scene.cameras.main.shake(feedback.shake.durationMs, feedback.shake.amplitude / 100);
    }

    if (feedback.hitPauseMs > 0) {
      this.cameraHitPauseUntilMs = Math.max(this.cameraHitPauseUntilMs, this.scene.time.now + feedback.hitPauseMs);
    }
  }

  private triggerCameraFeedbackForSoundEvent(event: SoundCueEvent): void {
    if (event.kind === "fire") {
      this.triggerCameraFeedback({ kind: "fire" });
    } else if (event.kind === "hit") {
      this.triggerCameraFeedback({ kind: "hit" });
    }
  }
}
