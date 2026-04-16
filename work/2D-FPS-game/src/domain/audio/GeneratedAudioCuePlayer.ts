import type { SoundCueKey } from "./SoundCueLogic";

export interface GeneratedTone {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly attackMs: number;
  readonly releaseMs: number;
  readonly type: OscillatorType;
}

const toneMap = {
  "fire.carbine": { frequencyHz: 304, durationMs: 58, gain: 0.028, attackMs: 4, releaseMs: 22, type: "square" },
  "fire.scatter": { frequencyHz: 158, durationMs: 104, gain: 0.038, attackMs: 6, releaseMs: 46, type: "triangle" },
  "fire.generic": { frequencyHz: 226, durationMs: 62, gain: 0.024, attackMs: 3, releaseMs: 24, type: "square" },
  "hit.player": { frequencyHz: 108, durationMs: 108, gain: 0.038, attackMs: 2, releaseMs: 68, type: "sawtooth" },
  "hit.dummy": { frequencyHz: 388, durationMs: 74, gain: 0.028, attackMs: 5, releaseMs: 30, type: "triangle" },
  "deflect.ricochet": { frequencyHz: 1240, durationMs: 68, gain: 0.02, attackMs: 2, releaseMs: 24, type: "square" },
  "deflect.shield": { frequencyHz: 702, durationMs: 128, gain: 0.024, attackMs: 10, releaseMs: 76, type: "sine" },
  "pickup.ammo": { frequencyHz: 628, durationMs: 76, gain: 0.026, attackMs: 10, releaseMs: 34, type: "sine" },
  "pickup.health": { frequencyHz: 784, durationMs: 94, gain: 0.028, attackMs: 14, releaseMs: 54, type: "sine" },
  "gate.open": { frequencyHz: 214, durationMs: 102, gain: 0.026, attackMs: 8, releaseMs: 44, type: "triangle" },
  "gate.close": { frequencyHz: 152, durationMs: 102, gain: 0.026, attackMs: 8, releaseMs: 52, type: "triangle" },
  "hazard.tick": { frequencyHz: 92, durationMs: 100, gain: 0.032, attackMs: 3, releaseMs: 72, type: "sawtooth" },
  "reload.start": { frequencyHz: 246, durationMs: 96, gain: 0.02, attackMs: 6, releaseMs: 34, type: "triangle" },
  "reload.complete": { frequencyHz: 548, durationMs: 112, gain: 0.024, attackMs: 8, releaseMs: 42, type: "square" },
  "reload.empty": { frequencyHz: 176, durationMs: 58, gain: 0.018, attackMs: 2, releaseMs: 20, type: "square" },
  "weapon.swap": { frequencyHz: 438, durationMs: 82, gain: 0.02, attackMs: 8, releaseMs: 30, type: "triangle" },
  "match.confirm.ready": { frequencyHz: 852, durationMs: 136, gain: 0.022, attackMs: 18, releaseMs: 58, type: "sine" },
  "match.confirm.accept": { frequencyHz: 988, durationMs: 152, gain: 0.026, attackMs: 18, releaseMs: 74, type: "sine" },
  "match.start": { frequencyHz: 524, durationMs: 188, gain: 0.03, attackMs: 12, releaseMs: 86, type: "triangle" }
} satisfies Record<SoundCueKey, GeneratedTone>;

export const generatedToneKeys = Object.freeze(Object.keys(toneMap) as SoundCueKey[]);

export const getGeneratedTone = (cue: SoundCueKey): GeneratedTone => {
  return toneMap[cue];
};

export class GeneratedAudioCuePlayer {
  private audioContext: AudioContext | null;
  private volume: number;

  public constructor() {
    this.audioContext = null;
    this.volume = 1;
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
    const attackAt = Math.min(stopAt, startAt + tone.attackMs / 1000);
    const releaseAt = Math.max(attackAt, stopAt - tone.releaseMs / 1000);

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequencyHz, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    const gain = tone.gain * this.volume;

    gainNode.gain.linearRampToValueAtTime(gain, attackAt);
    gainNode.gain.setValueAtTime(gain, releaseAt);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt);

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
  }

  public getVolume(): number {
    return this.volume;
  }

  private getAudioContext(): AudioContext {
    this.audioContext ??= new AudioContext();
    return this.audioContext;
  }
}
