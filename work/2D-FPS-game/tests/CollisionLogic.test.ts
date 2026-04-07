import { createCenteredRect, intersectsRect } from "../src/domain/collision/CollisionLogic";

describe("CollisionLogic", () => {
  it("creates a rectangle around a center point", () => {
    const rect = createCenteredRect(100, 80, 20, 10);

    expect(rect).toEqual({
      x: 90,
      y: 75,
      width: 20,
      height: 10
    });
  });

  it("detects overlap for intersecting rectangles", () => {
    const left = createCenteredRect(50, 50, 20, 20);
    const right = createCenteredRect(58, 50, 20, 20);

    expect(intersectsRect(left, right)).toBe(true);
  });

  it("returns false for separated rectangles", () => {
    const left = createCenteredRect(50, 50, 20, 20);
    const right = createCenteredRect(90, 50, 20, 20);

    expect(intersectsRect(left, right)).toBe(false);
  });
});
