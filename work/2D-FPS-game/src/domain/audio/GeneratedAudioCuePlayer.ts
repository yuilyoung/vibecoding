import type { SoundCueKey } from "./SoundCueLogic";

export interface GeneratedTone {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly type: OscillatorType;
}

const toneMap = {
  "fire.carbine": { frequencyHz: 300, durationMs: 55, gain: 0.03, type: "square" },
  "fire.scatter": { frequencyHz: 165, durationMs: 95, gain: 0.04, type: "triangle" },
  "fire.generic": { frequencyHz: 220, durationMs: 55, gain: 0.026, type: "square" },
  "hit.player": { frequencyHz: 115, durationMs: 95, gain: 0.04, type: "sawtooth" },
  "hit.dummy": { frequencyHz: 360, durationMs: 65, gain: 0.03, type: "triangle" },
  "deflect.ricochet": { frequencyHz: 1180, durationMs: 70, gain: 0.022, type: "square" },
  "deflect.shield": { frequencyHz: 680, durationMs: 120, gain: 0.026, type: "sine" },
  "pickup.ammo": { frequencyHz: 620, durationMs: 70, gain: 0.028, type: "sine" },
  "pickup.health": { frequencyHz: 760, durationMs: 90, gain: 0.03, type: "sine" },
  "gate.open": { frequencyHz: 210, durationMs: 95, gain: 0.028, type: "triangle" },
  "gate.close": { frequencyHz: 150, durationMs: 95, gain: 0.028, type: "triangle" },
  "hazard.tick": { frequencyHz: 95, durationMs: 95, gain: 0.034, type: "sawtooth" },
  "reload.start": { frequencyHz: 240, durationMs: 90, gain: 0.022, type: "triangle" },
  "reload.complete": { frequencyHz: 540, durationMs: 105, gain: 0.025, type: "square" },
  "reload.empty": { frequencyHz: 180, durationMs: 55, gain: 0.02, type: "square" },
  "weapon.swap": { frequencyHz: 430, durationMs: 80, gain: 0.022, type: "triangle" },
  "match.confirm.ready": { frequencyHz: 840, durationMs: 130, gain: 0.024, type: "sine" },
  "match.confirm.accept": { frequencyHz: 960, durationMs: 150, gain: 0.028, type: "sine" },
  "match.start": { frequencyHz: 520, durationMs: 180, gain: 0.032, type: "triangle" }
} satisfies Record<SoundCueKey, GeneratedTone>;

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
