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

  it("maps fire to no shake, no flash, no hit pause (Brawl Stars benchmark)", () => {
    expect(resolveCameraFeedback({ kind: "fire" })).toEqual({
      shake: null,
      flash: null,
      hitPauseMs: 0
    });
  });

  it("prefers stronger impact feedback when multiple events happen together", () => {
    expect(resolveCameraFeedback([
      { kind: "fire" },
      { kind: "hit" },
      { kind: "explosion" }
    ])).toEqual({
      shake: { amplitude: 0.8, durationMs: 50 },
      flash: null,
      hitPauseMs: 0
    });
  });

  it("treats air strike and death as the strongest tiers", () => {
    expect(resolveCameraFeedback([
      { kind: "explosion" },
      { kind: "airStrike" }
    ])).toEqual({
      shake: { amplitude: 1.2, durationMs: 70 },
      flash: null,
      hitPauseMs: 8
    });

    expect(resolveCameraFeedback([
      { kind: "critical" },
      { kind: "death" }
    ])).toEqual({
      shake: { amplitude: 1.5, durationMs: 80 },
      flash: null,
      hitPauseMs: 12
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
      const twoHits = resolveCameraFeedback([{ kind: "hit" }, { kind: "hit" }]);
      expect(twoHits).toEqual({
        shake: null,
        flash: null,
        hitPauseMs: 0
      });

      // explosion (priority 3) twice — first wins, second is identical.
      const twoExplosions = resolveCameraFeedback([
        { kind: "explosion" },
        { kind: "explosion" }
      ]);
      expect(twoExplosions.shake?.amplitude).toBe(0.8);
      expect(twoExplosions.hitPauseMs).toBe(0);
    });
  });
});
