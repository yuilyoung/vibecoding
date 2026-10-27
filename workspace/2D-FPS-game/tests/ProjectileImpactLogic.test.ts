import { selectEarliestProjectileImpact } from "../src/domain/combat/ProjectileImpactLogic";

describe("ProjectileImpactLogic", () => {
  const actor = {
    id: "enemy-1",
    team: "RED" as const,
    alive: true,
    bounds: { x: 45, y: 40, width: 10, height: 20 }
  };

  it("detects an actor crossed between projectile frame endpoints", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 50 },
      next: { x: 100, y: 50 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 0,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [actor],
      world: []
    });

    expect(impact).toEqual({
      kind: "actor",
      id: "enemy-1",
      fraction: 0.43,
      x: 43,
      y: 50
    });
  });

  it("chooses an obstacle before an actor on the same segment", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 50 },
      next: { x: 100, y: 50 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 0,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [actor],
      world: [{ id: "wall", bounds: { x: 20, y: 0, width: 10, height: 100 } }]
    });

    expect(impact?.kind).toBe("world");
    expect(impact?.id).toBe("wall");
    expect(impact?.fraction).toBeCloseTo(0.18);
  });

  it("chooses an actor before a farther obstacle", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 50 },
      next: { x: 100, y: 50 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 0,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [actor],
      world: [{ id: "wall", bounds: { x: 80, y: 0, width: 10, height: 100 } }]
    });

    expect(impact?.kind).toBe("actor");
    expect(impact?.id).toBe("enemy-1");
  });

  it("gives blocking world geometry precedence on an exact tie", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 50 },
      next: { x: 100, y: 50 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 0,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [actor],
      world: [{ id: "cover", bounds: actor.bounds }]
    });

    expect(impact?.kind).toBe("world");
    expect(impact?.id).toBe("cover");
  });

  it("ignores dead, same-team, and owning actors", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 50 },
      next: { x: 100, y: 50 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 0,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [
        { ...actor, id: "dead-enemy", alive: false },
        { ...actor, id: "blue-friend", team: "BLUE" },
        { ...actor, id: "player", team: "RED" }
      ],
      world: []
    });

    expect(impact).toBeNull();
  });

  it("returns null when the swept projectile misses every target", () => {
    const impact = selectEarliestProjectileImpact({
      previous: { x: 0, y: 0 },
      next: { x: 100, y: 0 },
      projectileWidth: 4,
      projectileHeight: 4,
      hitRadius: 3,
      ownerId: "player",
      ownerTeam: "BLUE",
      actors: [actor],
      world: [{ id: "wall", bounds: { x: 40, y: 30, width: 10, height: 10 } }]
    });

    expect(impact).toBeNull();
  });
});
