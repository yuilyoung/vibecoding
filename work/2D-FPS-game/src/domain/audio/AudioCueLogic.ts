import { SoundCueLogic, type SoundCueEvent, type SoundCueKey } from "./SoundCueLogic";

export type AudioCueId = SoundCueKey;

export interface AudioCueRule {
  readonly priority: number;
  readonly cooldownMs: number;
}

export interface AudioCueState {
  readonly maxSimultaneous: number;
  readonly lastPlayedAtMsByCue: Partial<Record<AudioCueId, number>>;
}

export interface AudioCueDecision {
  readonly play: readonly AudioCueId[];
  readonly drop: readonly AudioCueId[];
}

interface AudioCueCandidate {
  readonly cue: AudioCueId;
  readonly priority: number;
  readonly cooldownMs: number;
  readonly index: number;
}

const audioCueRules = {
  "match.start": { priority: 100, cooldownMs: 0 },
  "match.confirm.accept": { priority: 92, cooldownMs: 0 },
  "match.confirm.ready": { priority: 90, cooldownMs: 0 },
  "reload.complete": { priority: 80, cooldownMs: 0 },
  "reload.start": { priority: 78, cooldownMs: 0 },
  "reload.empty": { priority: 76, cooldownMs: 150 },
  "hit.player": { priority: 72, cooldownMs: 120 },
  "deflect.shield": { priority: 70, cooldownMs: 120 },
  "deflect.ricochet": { priority: 68, cooldownMs: 120 },
  "gate.open": { priority: 60, cooldownMs: 200 },
  "gate.close": { priority: 58, cooldownMs: 200 },
  "pickup.health": { priority: 54, cooldownMs: 80 },
  "pickup.ammo": { priority: 52, cooldownMs: 80 },
  "weapon.swap": { priority: 48, cooldownMs: 100 },
  "fire.scatter": { priority: 40, cooldownMs: 90 },
  "fire.carbine": { priority: 38, cooldownMs: 90 },
  "fire.generic": { priority: 36, cooldownMs: 90 },
  "hit.dummy": { priority: 28, cooldownMs: 60 },
  "hazard.tick": { priority: 10, cooldownMs: 180 }
} satisfies Record<AudioCueId, AudioCueRule>;

const cueLogic = new SoundCueLogic();

export class AudioCueLogic {
  public resolveCue(event: SoundCueEvent): AudioCueId {
    return cueLogic.resolveCue(event);
  }

  public resolveCues(events: readonly SoundCueEvent[], state: AudioCueState, nowMs: number): AudioCueDecision {
    const cap = Math.max(0, Math.floor(state.maxSimultaneous));
    const lastPlayedAtMsByCue: Partial<Record<AudioCueId, number>> = { ...state.lastPlayedAtMsByCue };
    const candidates = events.map((event, index) => {
      const cue = this.resolveCue(event);
      const rule = audioCueRules[cue];

      return {
        cue,
        priority: rule.priority,
        cooldownMs: rule.cooldownMs,
        index
      } satisfies AudioCueCandidate;
    });

    candidates.sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return left.index - right.index;
    });

    const play: AudioCueId[] = [];
    const drop: AudioCueId[] = [];

    for (const candidate of candidates) {
      if (play.length >= cap) {
        drop.push(candidate.cue);
        continue;
      }

      const lastPlayedAtMs = lastPlayedAtMsByCue[candidate.cue];
      if (lastPlayedAtMs !== undefined && nowMs - lastPlayedAtMs < candidate.cooldownMs) {
        drop.push(candidate.cue);
        continue;
      }

      play.push(candidate.cue);
      lastPlayedAtMsByCue[candidate.cue] = nowMs;
    }

    return { play, drop };
  }
}
