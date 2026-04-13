import { resolveExplosion } from "../src/domain/combat/ExplosionLogic";

describe("ExplosionLogic", () => {
  it("applies full damage and upward knockback at the blast center", () => {
    const [result] = resolveExplosion({
      centerX: 100,
      centerY: 100,
      radius: 60,
      damage: 45,
      knockback: 120,
      actors: [{ id: "dummy", x: 100, y: 100 }]
    });

    expect(result.id).toBe("dummy");
    expect(result.damage).toBe(45);
    expect(result.knockbackX).toBe(0);
    expect(result.knockbackY).toBe(-120);
  });

  it("falls off damage and knockback by distance", () => {
    const [result] = resolveExplosion({
      centerX: 100,
      centerY: 100,
      radius: 100,
      damage: 40,
      knockback: 80,
      actors: [{ id: "player", x: 150, y: 100 }]
    });

    expect(result.distance).toBe(50);
    expect(result.damage).toBe(20);
    expect(result.knockbackX).toBe(40);
    expect(result.knockbackY).toBe(0);
  });

  it("ignores actors outside the blast radius", () => {
    const results = resolveExplosion({
      centerX: 100,
      centerY: 100,
      radius: 50,
      damage: 40,
      knockback: 80,
      actors: [
        { id: "near", x: 125, y: 100 },
        { id: "far", x: 170, y: 100 }
      ]
    });

    expect(results.map((result) => result.id)).toEqual(["near"]);
  });

  it("returns no effects for zero-radius blasts", () => {
    expect(resolveExplosion({
      centerX: 0,
      centerY: 0,
      radius: 0,
      damage: 40,
      knockback: 80,
      actors: [{ id: "target", x: 0, y: 0 }]
    })).toEqual([]);
  });
});
