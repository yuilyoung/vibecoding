import { castBeam } from "../src/domain/combat/BeamLogic";

describe("BeamLogic", () => {
  it("travels to max range when nothing is hit", () => {
    const result = castBeam(
      { x: 10, y: 10 },
      0,
      100,
      [],
      []
    );

    expect(result.kind).toBe("none");
    expect(result.distance).toBe(100);
    expect(result.hitPoint.x).toBe(110);
    expect(result.hitPoint.y).toBe(10);
    expect(result.targetId).toBeNull();
  });

  it("hits the nearest actor first", () => {
    const result = castBeam(
      { x: 0, y: 10 },
      0,
      200,
      [],
      [
        { id: "far", x: 120, y: 0, width: 20, height: 20 },
        { id: "near", x: 60, y: 0, width: 20, height: 20 }
      ]
    );

    expect(result.kind).toBe("actor");
    expect(result.targetId).toBe("near");
    expect(result.distance).toBe(60);
    expect(result.hitPoint.x).toBe(60);
    expect(result.hitPoint.y).toBe(10);
  });

  it("stops at an obstacle before a farther actor", () => {
    const result = castBeam(
      { x: 0, y: 10 },
      0,
      200,
      [{ x: 40, y: 0, width: 20, height: 20 }],
      [{ id: "actor", x: 90, y: 0, width: 20, height: 20 }]
    );

    expect(result.kind).toBe("obstacle");
    expect(result.targetType).toBe("obstacle");
    expect(result.targetId).toBeNull();
    expect(result.distance).toBe(40);
    expect(result.hitPoint.x).toBe(40);
  });

  it("hits an actor before a farther obstacle", () => {
    const result = castBeam(
      { x: 0, y: 10 },
      0,
      200,
      [{ x: 120, y: 0, width: 20, height: 20 }],
      [{ id: "actor", x: 40, y: 0, width: 20, height: 20 }]
    );

    expect(result.kind).toBe("actor");
    expect(result.targetType).toBe("actor");
    expect(result.targetId).toBe("actor");
    expect(result.distance).toBe(40);
    expect(result.hitPoint.x).toBe(40);
  });

  it("uses the beam angle when resolving diagonal hits", () => {
    const result = castBeam(
      { x: 10, y: 10 },
      Math.PI / 4,
      100,
      [],
      [{ id: "target", x: 40, y: 40, width: 10, height: 10 }]
    );

    expect(result.kind).toBe("actor");
    expect(result.targetId).toBe("target");
    expect(result.hitPoint.x).toBeCloseTo(40);
    expect(result.hitPoint.y).toBeCloseTo(40);
    expect(result.distance).toBeCloseTo(Math.sqrt(1800));
  });
});
