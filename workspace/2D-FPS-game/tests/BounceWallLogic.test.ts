import { createMapObject } from "../src/domain/map/MapObjectLogic";
import { reflectProjectileOffWall } from "../src/domain/map/BounceWallLogic";

describe("BounceWallLogic", () => {
  it("reflects a linear projectile off a vertical bounce wall and decrements durability", () => {
    const wall = createMapObject({
      id: "bounce-1",
      kind: "bounce-wall",
      x: 124,
      y: 100,
      angleDegrees: 90,
      reflectionsRemaining: 3
    });

    const result = reflectProjectileOffWall({
      x: 100,
      y: 100,
      width: 8,
      height: 8,
      velocityX: 120,
      velocityY: 0,
      trajectory: "linear",
      bouncesRemaining: 0
    }, wall);

    expect(result).toMatchObject({
      kind: "reflected",
      projectile: {
        velocityX: -120,
        velocityY: 0
      },
      wall: {
        reflectionsRemaining: 2,
        active: true
      }
    });
  });

  it("reflects arc and bounce projectiles without changing projectile bounce counters", () => {
    const wall = createMapObject({
      id: "bounce-1",
      kind: "bounce-wall",
      x: 140,
      y: 120,
      angleDegrees: 0,
      reflectionsRemaining: 3
    });

    const arc = reflectProjectileOffWall({
      x: 140,
      y: 100,
      width: 8,
      height: 8,
      velocityX: 0,
      velocityY: 80,
      trajectory: "arc",
      bouncesRemaining: 0
    }, wall);
    const bounce = reflectProjectileOffWall({
      x: 140,
      y: 100,
      width: 8,
      height: 8,
      velocityX: 0,
      velocityY: 80,
      trajectory: "bounce",
      bouncesRemaining: 2
    }, wall);

    expect(arc).toMatchObject({
      kind: "reflected",
      projectile: { velocityX: 0, velocityY: -80 }
    });
    expect(bounce).toMatchObject({
      kind: "reflected",
      projectile: { velocityX: 0, velocityY: -80, bouncesRemaining: 2 }
    });
  });

  it("passes through when reflections are exhausted and destroys the wall on the final bounce", () => {
    const exhaustedWall = createMapObject({
      id: "bounce-0",
      kind: "bounce-wall",
      x: 140,
      y: 120,
      angleDegrees: 0,
      reflectionsRemaining: 0
    });
    const finalWall = createMapObject({
      id: "bounce-1",
      kind: "bounce-wall",
      x: 140,
      y: 120,
      angleDegrees: 0,
      reflectionsRemaining: 1
    });

    const passthrough = reflectProjectileOffWall({
      x: 140,
      y: 100,
      width: 8,
      height: 8,
      velocityX: 0,
      velocityY: 80,
      trajectory: "linear",
      bouncesRemaining: 0
    }, exhaustedWall);
    const finalBounce = reflectProjectileOffWall({
      x: 140,
      y: 100,
      width: 8,
      height: 8,
      velocityX: 0,
      velocityY: 80,
      trajectory: "linear",
      bouncesRemaining: 0
    }, finalWall);

    expect(passthrough).toEqual({
      kind: "passthrough",
      wall: exhaustedWall
    });
    expect(finalBounce).toMatchObject({
      kind: "reflected",
      wall: {
        reflectionsRemaining: 0,
        active: false,
        hp: 0
      }
    });
  });
});
