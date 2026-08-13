export type CameraFeedbackEventKind = "fire" | "hit" | "explosion" | "airStrike" | "critical" | "death";

export interface CameraFeedbackEvent {
  readonly kind: CameraFeedbackEventKind;
}

export interface CameraShake {
  readonly amplitude: number;
  readonly durationMs: number;
}

export interface CameraFlash {
  readonly color: number;
  readonly alpha: number;
  readonly durationMs: number;
}

export interface CameraFeedbackResult {
  readonly shake: CameraShake | null;
  readonly flash: CameraFlash | null;
  readonly hitPauseMs: number;
}

interface CameraFeedbackProfile {
  readonly priority: number;
  readonly shake: CameraShake | null;
  readonly flash: CameraFlash | null;
  readonly hitPauseMs: number;
}

// Brawl Stars benchmark: no camera flash, no shake/pause for normal combat.
const FEEDBACK_PROFILES: Record<CameraFeedbackEventKind, CameraFeedbackProfile> = {
  fire: {
    priority: 1,
    shake: null,
    flash: null,
    hitPauseMs: 0
  },
  hit: {
    priority: 2,
    shake: null,
    flash: null,
    hitPauseMs: 0
  },
  explosion: {
    priority: 3,
    shake: { amplitude: 0.8, durationMs: 50 },
    flash: null,
    hitPauseMs: 0
  },
  airStrike: {
    priority: 4,
    shake: { amplitude: 1.2, durationMs: 70 },
    flash: null,
    hitPauseMs: 8
  },
  critical: {
    priority: 5,
    shake: null,
    flash: null,
    hitPauseMs: 0
  },
  death: {
    priority: 6,
    shake: { amplitude: 1.5, durationMs: 80 },
    flash: null,
    hitPauseMs: 12
  }
};

const EMPTY_RESULT: CameraFeedbackResult = {
  shake: null,
  flash: null,
  hitPauseMs: 0
};

export function resolveCameraFeedback(
  events: readonly CameraFeedbackEvent[] | CameraFeedbackEvent
): CameraFeedbackResult {
  const normalizedEvents: readonly CameraFeedbackEvent[] = Array.isArray(events) ? events : [events];

  if (normalizedEvents.length === 0) {
    return EMPTY_RESULT;
  }

  let strongestProfile: CameraFeedbackProfile | null = null;

  for (const event of normalizedEvents) {
    const profile = FEEDBACK_PROFILES[event.kind];
    if (!profile) continue;

    if (strongestProfile === null || profile.priority > strongestProfile.priority) {
      strongestProfile = profile;
    }
  }

  if (strongestProfile === null) {
    return EMPTY_RESULT;
  }

  return {
    shake: strongestProfile.shake ? { ...strongestProfile.shake } : null,
    flash: strongestProfile.flash ? { ...strongestProfile.flash } : null,
    hitPauseMs: strongestProfile.hitPauseMs
  };
}
