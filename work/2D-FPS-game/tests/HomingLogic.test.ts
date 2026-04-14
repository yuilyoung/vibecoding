import { steerHomingTrajectory } from "../src/domain/combat/HomingLogic";

describe("HomingLogic", () => {
  it("selects the nearest valid target and ignores invalid ones", () => {
    const result = steerHomingTrajectory({
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      speed: 100,
      deltaSeconds: 1,
      maxTurnRateRadiansPerSecond: Math.PI * 2,
      targets: [
        { x: 0, y: 60, valid: false },
        { x: 0, y: 40 },
        { x: 0, y: 20 }
      ]
    });

    expect(result.target).toEqual({ x: 0, y: 20 });
    expect(result.velocityX).toBeCloseTo(0);
    expect(result.velocityY).toBeCloseTo(100);
  });

  it("clamps steering to the configured max turn rate", () => {
    const result = steerHomingTrajectory({
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      speed: 100,
      deltaSeconds: 0.5,
      maxTurnRateRadiansPerSecond: Math.PI / 2,
      targets: [{ x: 0, y: 100 }]
    });

    expect(result.velocityX).toBeCloseTo(70.710678);
    expect(result.velocityY).toBeCloseTo(70.710678);
  });

  it("keeps its current velocity when no valid target exists", () => {
    const result = steerHomingTrajectory({
      x: 0,
      y: 0,
      velocityX: 100,
      velocityY: 0,
      speed: 100,
      deltaSeconds: 1,
      maxTurnRateRadiansPerSecond: Math.PI,
      targets: []
    });

    expect(result.target).toBeNull();
    expect(result.velocityX).toBe(100);
    expect(result.velocityY).toBe(0);
  });
});
