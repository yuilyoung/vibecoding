import { getGeneratedTone } from "../src/domain/audio/GeneratedAudioCuePlayer";

describe("GeneratedAudioCuePlayer", () => {
  it("returns the default generated tone when no override exists", () => {
    expect(getGeneratedTone("fire.carbine")).toMatchObject({
      frequencyHz: 304,
      durationMs: 58,
      gain: 0.028,
      type: "square"
    });
  });

  it("merges valid per-cue overrides without changing untouched fields", () => {
    expect(getGeneratedTone("fire.carbine", {
      "fire.carbine": {
        gain: 0.05,
        durationMs: 80
      }
    })).toMatchObject({
      frequencyHz: 304,
      durationMs: 80,
      gain: 0.05,
      type: "square"
    });
  });

  it("clamps invalid override values back into safe generated-tone ranges", () => {
    expect(getGeneratedTone("match.start", {
      "match.start": {
        frequencyHz: -30,
        durationMs: 0,
        gain: -1,
        attackMs: -3,
        releaseMs: -12
      }
    })).toMatchObject({
      frequencyHz: 1,
      durationMs: 1,
      gain: 0,
      attackMs: 0,
      releaseMs: 0,
      type: "triangle"
    });
  });
});
