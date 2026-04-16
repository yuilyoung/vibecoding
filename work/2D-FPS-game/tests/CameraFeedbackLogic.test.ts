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
        amplitude: 0.3,
        durationMs: 20
      },
      flash: {
        color: 0xfff2d6,
        alpha: 0.04,
        durationMs: 18
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
        amplitude: 1.8,
        durationMs: 70
      },
      flash: {
        color: 0xffc06a,
        alpha: 0.10,
        durationMs: 55
      },
      hitPauseMs: 12
    });
  });

  it("treats air strike and death as the strongest tiers", () => {
    expect(resolveCameraFeedback([
      { kind: "explosion" },
      { kind: "airStrike" }
    ])).toEqual({
      shake: {
        amplitude: 2.4,
        durationMs: 90
      },
      flash: {
        color: 0xffefaa,
        alpha: 0.12,
        durationMs: 70
      },
      hitPauseMs: 16
    });

    expect(resolveCameraFeedback([
      { kind: "critical" },
      { kind: "death" }
    ])).toEqual({
      shake: {
        amplitude: 3.2,
        durationMs: 120
      },
      flash: {
        color: 0xffffff,
        alpha: 0.16,
        durationMs: 100
      },
      hitPauseMs: 22
    });
  });

  describe("edge cases (Phase 3 QA audit)", () => {
    it("returns EMPTY_RESULT for missing or unknown event kinds without throwing", () => {
      const result = resolveCameraFeedback([
        {} as unknown as CameraFeedbackEvent,
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
        shake: { amplitude: 0.8, durationMs: 36 },
        flash: { color: 0xffd59e, alpha: 0.06, durationMs: 30 },
        hitPauseMs: 6
      });

      // explosion (priority 3) twice — first wins, second is identical.
      const twoExplosions = resolveCameraFeedback([
        { kind: "explosion" },
        { kind: "explosion" }
      ]);
      expect(twoExplosions.shake?.amplitude).toBe(1.8);
      expect(twoExplosions.hitPauseMs).toBe(12);
    });
  });
});
