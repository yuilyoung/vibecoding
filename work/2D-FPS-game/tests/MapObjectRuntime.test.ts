import { createMapObject, destroyMapObject } from "../src/domain/map/MapObjectLogic";
import { advanceMapObjects } from "../src/domain/map/MapObjectRuntime";
import type { GameBalanceMapObjects } from "../src/scenes/scene-types";

const config: GameBalanceMapObjects & {
  teleporter: {
    radius: number;
    cooldownMs: number;
  };
} = {
  barrel: {
    hp: 40,
    blastRadius: 80,
    blastDamage: 40,
    triggerRadius: 70,
    chainDelayMs: 150
  },
  mine: {
    armDelayMs: 500,
    proximityRadius: 40,
    fuseMs: 1000,
    blastRadius: 50,
    blastDamage: 50
  },
  crate: {
    hp: 25,
    dropTable: {
      health: 0.4,
      ammo: 0.4,
      boost: 0.2
    }
  },
  cover: {
    hp: 60,
    width: 48,
    height: 16,
    blocksBullets: true
  },
  bounceWall: {
    width: 48,
    height: 8,
    maxReflections: 3
  },
  teleporter: {
    radius: 24,
    cooldownMs: 1500
  }
};

describe("MapObjectRuntime", () => {
  it("arms mines after the configured delay", () => {
    const mine = createMapObject({ id: "mine-a", kind: "mine", x: 100, y: 100, hp: 1 });
    const first = advanceMapObjects(0, 16, [], [mine], config);
    const second = advanceMapObjects(499, 16, [], first.objects, config);

    expect(first.objects[0].armedAt).toBe(500);
    expect(second.triggered).toEqual([]);
  });

  it("starts and completes a fuse when an actor enters proximity", () => {
    const mine = createMapObject({ id: "mine-a", kind: "mine", x: 100, y: 100, hp: 1, armedAt: 0 });
    const first = advanceMapObjects(100, 16, [{ x: 120, y: 100 }], [mine], config);
    const second = advanceMapObjects(1100, 16, [{ x: 120, y: 100 }], first.objects, config);

    expect(first.objects[0].fuseStartedAt).toBe(100);
    expect(second.triggered).toEqual(["mine-a"]);
    expect(second.objects[0]).toMatchObject({ active: false, hp: 0 });
  });

  it("cancels a mine fuse when actors leave proximity", () => {
    const mine = createMapObject({ id: "mine-a", kind: "mine", x: 100, y: 100, hp: 1, armedAt: 0 });
    const first = advanceMapObjects(100, 16, [{ x: 120, y: 100 }], [mine], config);
    const second = advanceMapObjects(500, 16, [{ x: 200, y: 100 }], first.objects, config);

    expect(second.objects[0].fuseStartedAt).toBeUndefined();
    expect(second.triggered).toEqual([]);
  });

  it("skips mine proximity triggering while weather disables mines", () => {
    const mine = createMapObject({ id: "mine-a", kind: "mine", x: 100, y: 100, hp: 1, armedAt: 0 });
    const result = advanceMapObjects(
      100,
      16,
      [{ x: 120, y: 100 }],
      [mine],
      config,
      undefined,
      { minesDisabled: true }
    );

    expect(result.objects[0].fuseStartedAt).toBeUndefined();
    expect(result.triggered).toEqual([]);
  });

  it("selects crate drops with injected rng", () => {
    const crate = destroyMapObject(createMapObject({ id: "crate-a", kind: "crate", x: 50, y: 60, hp: 25 }));

    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.1).drops).toEqual([
      { id: "crate-a", type: "health", x: 50, y: 60 }
    ]);
    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.5).drops[0].type).toBe("ammo");
    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.9).drops[0].type).toBe("boost");
  });

  it("returns teleports without breaking the existing triggered and drops arrays", () => {
    const teleporterA = createMapObject({
      id: "tp-a",
      kind: "teleporter",
      x: 100,
      y: 100,
      pairId: "alpha",
      cooldownMs: 1500
    });
    const teleporterB = createMapObject({
      id: "tp-b",
      kind: "teleporter",
      x: 280,
      y: 200,
      pairId: "alpha",
      cooldownMs: 1500
    });

    const result = advanceMapObjects(
      1_000,
      16,
      [{ id: "player", x: 100, y: 100 }],
      [teleporterA, teleporterB],
      config
    );

    expect(result.triggered).toEqual([]);
    expect(result.drops).toEqual([]);
    expect(result.teleports).toEqual([
      {
        actorId: "player",
        fromId: "tp-a",
        toId: "tp-b",
        x: 280,
        y: 200,
        cooldownUntil: 2_500
      }
    ]);
  });

  it("updates teleporter cooldowns and blocks immediate re-entry on the next tick", () => {
    const teleporterA = createMapObject({
      id: "tp-a",
      kind: "teleporter",
      x: 100,
      y: 100,
      pairId: "alpha",
      cooldownMs: 1500
    });
    const teleporterB = createMapObject({
      id: "tp-b",
      kind: "teleporter",
      x: 280,
      y: 200,
      pairId: "alpha",
      cooldownMs: 1500
    });

    const first = advanceMapObjects(
      1_000,
      16,
      [{ id: "player", x: 100, y: 100 }],
      [teleporterA, teleporterB],
      config
    );
    const second = advanceMapObjects(
      1_100,
      16,
      [{ id: "player", x: 280, y: 200 }],
      first.objects,
      config
    );

    expect(first.objects).toMatchObject([
      { id: "tp-a", cooldownUntil: 2_500 },
      { id: "tp-b", cooldownUntil: 2_500 }
    ]);
    expect(second.teleports).toEqual([]);
  });
});
