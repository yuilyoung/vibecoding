import { resolveCameraFeedback } from "../src/domain/feedback/CameraFeedbackLogic";

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
});
