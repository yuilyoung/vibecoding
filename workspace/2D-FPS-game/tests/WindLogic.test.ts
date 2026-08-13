import { computeForce, createWindState, rotateWind, type WindConfig } from "../src/domain/environment/WindLogic";

describe("WindLogic", () => {
  it("normalizes angle and rounds strength when creating state", () => {
    expect(createWindState({ angleDegrees: -90, strength: 1.6 })).toEqual({
      angleDegrees: 270,
      strength: 2
    });
  });

  it("rotates from null state using deterministic rng and discrete steps", () => {
    const rng = stubRng(0.5, 0.75);
    const config: WindConfig = {
      strengthRange: [0, 3],
      angleStepDegrees: 45
    };

    expect(rotateWind(null, rng, config)).toEqual({
      angleDegrees: 180,
      strength: 3
    });
  });

  it("rotates from previous state and keeps strength within configured range", () => {
    const rng = stubRng(0.25, 0.5);
    const config: WindConfig = {
      strengthRange: [0, 2],
      angleStepDegrees: 30
    };

    expect(rotateWind({ angleDegrees: 330, strength: 1 }, rng, config)).toEqual({
      angleDegrees: 60,
      strength: 1
    });
  });

  it("computes force components in phaser-style coordinates", () => {
    const force = computeForce({ angleDegrees: 90, strength: 2 }, 120);

    expect(force.x).toBeCloseTo(0);
    expect(force.y).toBeCloseTo(240);
  });
});

function stubRng(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
