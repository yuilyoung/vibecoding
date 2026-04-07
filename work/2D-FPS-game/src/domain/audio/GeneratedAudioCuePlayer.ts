import type { SoundCueKey } from "./SoundCueLogic";

export interface GeneratedTone {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly type: OscillatorType;
}

const toneMap: Record<SoundCueKey, GeneratedTone> = {
  "fire.carbine": { frequencyHz: 220, durationMs: 70, gain: 0.035, type: "square" },
  "fire.scatter": { frequencyHz: 120, durationMs: 120, gain: 0.045, type: "sawtooth" },
  "fire.generic": { frequencyHz: 180, durationMs: 60, gain: 0.025, type: "square" },
  "hit.player": { frequencyHz: 90, durationMs: 120, gain: 0.05, type: "sawtooth" },
  "hit.dummy": { frequencyHz: 280, durationMs: 85, gain: 0.035, type: "triangle" },
  "pickup.ammo": { frequencyHz: 520, durationMs: 90, gain: 0.03, type: "sine" },
  "pickup.health": { frequencyHz: 640, durationMs: 110, gain: 0.03, type: "sine" },
  "gate.open": { frequencyHz: 160, durationMs: 130, gain: 0.035, type: "triangle" },
  "gate.close": { frequencyHz: 110, durationMs: 130, gain: 0.035, type: "triangle" },
  "hazard.tick": { frequencyHz: 70, durationMs: 140, gain: 0.04, type: "sawtooth" },
  "match.confirm.ready": { frequencyHz: 760, durationMs: 160, gain: 0.025, type: "sine" },
  "match.confirm.accept": { frequencyHz: 880, durationMs: 180, gain: 0.03, type: "sine" }
};

export const getGeneratedTone = (cue: SoundCueKey): GeneratedTone => {
  return toneMap[cue];
};

export class GeneratedAudioCuePlayer {
  private audioContext: AudioContext | null;

  public constructor() {
    this.audioContext = null;
  }

  public play(cue: SoundCueKey): void {
    if (typeof AudioContext === "undefined") {
      return;
    }

    const audioContext = this.getAudioContext();
    const tone = getGeneratedTone(cue);
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime;
    const stopAt = startAt + tone.durationMs / 1000;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequencyHz, startAt);
    gainNode.gain.setValueAtTime(tone.gain, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt);

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
  }

  private getAudioContext(): AudioContext {
    this.audioContext ??= new AudioContext();
    return this.audioContext;
  }
}
