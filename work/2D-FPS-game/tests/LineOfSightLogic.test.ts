import { hasLineOfSight } from "../src/domain/ai/LineOfSightLogic";

describe("LineOfSightLogic", () => {
  it("returns true when the segment is unobstructed", () => {
    const result = hasLineOfSight(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      [{ x: 80, y: 80, width: 20, height: 20 }]
    );

    expect(result).toBe(true);
  });

  it("returns false when an obstacle crosses the segment", () => {
    const result = hasLineOfSight(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      [{ x: 90, y: -20, width: 24, height: 40 }]
    );

    expect(result).toBe(false);
  });

  it("returns false when the observer starts inside an obstacle", () => {
    const result = hasLineOfSight(
      { x: 12, y: 12 },
      { x: 200, y: 12 },
      [{ x: 0, y: 0, width: 24, height: 24 }]
    );

    expect(result).toBe(false);
  });

  it("returns false when the target is inside an obstacle", () => {
    const result = hasLineOfSight(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      [{ x: 90, y: 90, width: 20, height: 20 }]
    );

    expect(result).toBe(false);
  });

  it("treats any blocking obstacle in the list as a line-of-sight break", () => {
    const result = hasLineOfSight(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      [
        { x: 40, y: 50, width: 10, height: 10 },
        { x: 110, y: -20, width: 18, height: 40 }
      ]
    );

    expect(result).toBe(false);
  });
});
