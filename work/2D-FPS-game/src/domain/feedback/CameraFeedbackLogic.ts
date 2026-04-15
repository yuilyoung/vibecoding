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
  readonly shake: CameraShake;
  readonly flash: CameraFlash;
  readonly hitPauseMs: number;
}

const FEEDBACK_PROFILES: Record<CameraFeedbackEventKind, CameraFeedbackProfile> = {
  fire: {
    priority: 1,
    shake: {
      amplitude: 0.8,
      durationMs: 28
    },
    flash: {
      color: 0xfff2d6,
      alpha: 0.08,
      durationMs: 24
    },
    hitPauseMs: 0
  },
  hit: {
    priority: 2,
    shake: {
      amplitude: 2.2,
      durationMs: 52
    },
    flash: {
      color: 0xffd59e,
      alpha: 0.14,
      durationMs: 44
    },
    hitPauseMs: 10
  },
  explosion: {
    priority: 3,
    shake: {
      amplitude: 6,
      durationMs: 110
    },
    flash: {
      color: 0xffc06a,
      alpha: 0.22,
      durationMs: 88
    },
    hitPauseMs: 24
  },
  airStrike: {
    priority: 4,
    shake: {
      amplitude: 7.5,
      durationMs: 132
    },
    flash: {
      color: 0xffefaa,
      alpha: 0.24,
      durationMs: 104
    },
    hitPauseMs: 28
  },
  critical: {
    priority: 5,
    shake: {
      amplitude: 4.5,
      durationMs: 84
    },
    flash: {
      color: 0xff7b7b,
      alpha: 0.2,
      durationMs: 72
    },
    hitPauseMs: 20
  },
  death: {
    priority: 6,
    shake: {
      amplitude: 10,
      durationMs: 180
    },
    flash: {
      color: 0xffffff,
      alpha: 0.32,
      durationMs: 150
    },
    hitPauseMs: 42
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

    if (strongestProfile === null || profile.priority > strongestProfile.priority) {
      strongestProfile = profile;
    }
  }

  if (strongestProfile === null) {
    return EMPTY_RESULT;
  }

  return {
    shake: {
      amplitude: strongestProfile.shake.amplitude,
      durationMs: strongestProfile.shake.durationMs
    },
    flash: {
      color: strongestProfile.flash.color,
      alpha: strongestProfile.flash.alpha,
      durationMs: strongestProfile.flash.durationMs
    },
    hitPauseMs: strongestProfile.hitPauseMs
  };
}
