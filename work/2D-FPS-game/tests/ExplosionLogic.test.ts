import { resolveChainExplosion, resolveExplosion } from "../src/domain/combat/ExplosionLogic";

describe("ExplosionLogic", () => {
  it("applies distance falloff damage and outward knockback", () => {
    const hits = resolveExplosion({
      centerX: 100,
      centerY: 100,
      baseDamage: 50,
      blastRadius: 100,
      knockback: 40,
      targets: [
        { id: "direct", x: 100, y: 100 },
        { id: "edge", x: 150, y: 100 },
        { id: "outside", x: 210, y: 100 }
      ]
    });

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      id: "direct",
      distance: 0,
      damage: 50,
      knockbackX: 40,
      knockbackY: 0
    });
    expect(hits[1]).toMatchObject({
      id: "edge",
      distance: 50,
      damage: 25,
      knockbackX: 20,
      knockbackY: 0
    });
  });

  it("reduces knockback by target mass", () => {
    const [hit] = resolveExplosion({
      centerX: 0,
      centerY: 0,
      baseDamage: 30,
      blastRadius: 100,
      knockback: 60,
      targets: [{ id: "heavy", x: 50, y: 0, mass: 3 }]
    });

    expect(hit.damage).toBe(15);
    expect(hit.knockbackX).toBe(10);
    expect(hit.knockbackY).toBe(0);
  });

  it("returns no hits for invalid blast settings", () => {
    expect(resolveExplosion({
      centerX: 0,
      centerY: 0,
      baseDamage: 0,
      blastRadius: 100,
      knockback: 10,
      targets: [{ id: "dummy", x: 0, y: 0 }]
    })).toEqual([]);
  });

  it("resolves chain explosions up to the configured depth", () => {
    const triggered = resolveChainExplosion({
      originId: "a",
      maxDepth: 2,
      objects: [
        { id: "a", x: 0, y: 0, triggerRadius: 60 },
        { id: "b", x: 50, y: 0, triggerRadius: 60 },
        { id: "c", x: 105, y: 0, triggerRadius: 60 },
        { id: "d", x: 170, y: 0, triggerRadius: 60 }
      ]
    });

    expect(triggered).toEqual(["a", "b", "c"]);
  });
});
