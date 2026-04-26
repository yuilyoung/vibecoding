import Phaser from "phaser";
import { AudioCueLogic, type AudioCueState } from "../domain/audio/AudioCueLogic";
import { GeneratedAudioCuePlayer } from "../domain/audio/GeneratedAudioCuePlayer";
import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "../domain/audio/SoundCueLogic";
import { resolveCameraFeedback, type CameraFeedbackEvent } from "../domain/feedback/CameraFeedbackLogic";
import type { WeatherSoundQueueItem } from "../audio/sound-cue-contract";

export class AudioFeedbackController {
  private readonly soundCueLogic: SoundCueLogic;
  private readonly audioCueLogic: AudioCueLogic;
  private readonly audioCuePlayer: GeneratedAudioCuePlayer;
  private audioCueState: AudioCueState;
  private lastSoundCue: SoundCueKey | "NONE";
  private weatherSoundQueue: WeatherSoundQueueItem[];
  private lastHazardCueStickyUntilMs: number;
  private cameraHitPauseUntilMs: number;

  public constructor(private readonly scene: Phaser.Scene) {
    this.soundCueLogic = new SoundCueLogic();
    this.audioCueLogic = new AudioCueLogic();
    this.audioCuePlayer = new GeneratedAudioCuePlayer();
    this.audioCueState = {
      maxSimultaneous: 3,
      lastPlayedAtMsByCue: {}
    };
    this.lastSoundCue = "NONE";
    this.weatherSoundQueue = [];
    this.lastHazardCueStickyUntilMs = 0;
    this.cameraHitPauseUntilMs = 0;
  }

  public setVolume(volume: number): void {
    this.audioCuePlayer.setVolume(volume);
  }

  public getLastSoundCue(): SoundCueKey | "NONE" {
    return this.lastSoundCue;
  }

  public getCameraHitPauseUntilMs(): number {
    return this.cameraHitPauseUntilMs;
  }

  public queueWeatherSoundCue(item: WeatherSoundQueueItem): void {
    this.weatherSoundQueue.push(item);
  }

  public getWeatherSoundQueue(): readonly WeatherSoundQueueItem[] {
    return this.weatherSoundQueue;
  }

  public clearWeatherSoundQueue(): void {
    this.weatherSoundQueue = [];
  }

  public emitSoundCue(event: SoundCueEvent): void {
    const now = this.scene.time.now;
    const fallbackCue = this.soundCueLogic.resolveCue(event);
    const decision = this.audioCueLogic.resolveCues([event], this.audioCueState, now);
    const nextCue = decision.play[0] ?? fallbackCue;

    if (this.lastSoundCue === "hazard.tick" && nextCue !== "hazard.tick" && now < this.lastHazardCueStickyUntilMs) {
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
