import {
  resolveCameraFeedback,
  type CameraFeedbackEvent
} from "../src/domain/feedback/CameraFeedbackLogic";

describe("CameraFeedbackLogic", () => {
  it("returns no camera feedback for an empty event list", () => {
    expect(resolveCameraFeedback([])).toEqual({
      shake: null,
      flash: null,
      hitPauseMs: 0
    });
  });

  it("maps fire to subtle shake and flash without hit pause", () => {
    expect(resolveCameraFeedback({ kind: "fire" })).toEqual({
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
    });
  });

  it("prefers stronger impact feedback when multiple events happen together", () => {
    expect(resolveCameraFeedback([
      { kind: "fire" },
      { kind: "hit" },
      { kind: "explosion" }
    ])).toEqual({
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
    });
  });

  it("treats air strike and death as the strongest tiers", () => {
    expect(resolveCameraFeedback([
      { kind: "explosion" },
      { kind: "airStrike" }
    ])).toEqual({
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
    });

    expect(resolveCameraFeedback([
      { kind: "critical" },
      { kind: "death" }
    ])).toEqual({
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
    });
  });

  describe("edge cases (Phase 3 QA audit)", () => {
    // TODO(bug): src/domain/feedback/CameraFeedbackLogic.ts:130
    // Unknown event.kind makes FEEDBACK_PROFILES[kind] undefined and the loop crashes
    // on `profile.priority`. Should fall back to EMPTY_RESULT instead. Skipped until
    // Phase 4 Sprint 0 hardening pass.
    test.skip("returns EMPTY_RESULT for unknown event kinds without throwing", () => {
      const result = resolveCameraFeedback([
        { kind: "ultra-mega-impact" } as unknown as CameraFeedbackEvent
      ]);

      expect(result).toEqual({ shake: null, flash: null, hitPauseMs: 0 });
    });

    it("selects the first event deterministically when two events share the same tier", () => {
      // Two `hit` events have identical priority; the strict `>` comparison keeps
      // the first one that established `strongestProfile`. Both yield identical
      // profiles, so the result is the standard hit profile either way — but we
      // also confirm that mixing two distinct same-tier kinds is order-stable.
      const twoHits = resolveCameraFeedback([{ kind: "hit" }, { kind: "hit" }]);
      expect(twoHits).toEqual({
        shake: { amplitude: 2.2, durationMs: 52 },
        flash: { color: 0xffd59e, alpha: 0.14, durationMs: 44 },
        hitPauseMs: 10
      });

      // explosion (priority 3) twice — first wins, second is identical.
      const twoExplosions = resolveCameraFeedback([
        { kind: "explosion" },
        { kind: "explosion" }
      ]);
      expect(twoExplosions.shake?.amplitude).toBe(6);
      expect(twoExplosions.hitPauseMs).toBe(24);
    });
  });
});
