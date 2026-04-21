import { createMapObject, destroyMapObject } from "../src/domain/map/MapObjectLogic";
import { advanceMapObjects } from "../src/domain/map/MapObjectRuntime";
import type { GameBalanceMapObjects } from "../src/scenes/scene-types";

const config: GameBalanceMapObjects = {
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

  it("selects crate drops with injected rng", () => {
    const crate = destroyMapObject(createMapObject({ id: "crate-a", kind: "crate", x: 50, y: 60, hp: 25 }));

    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.1).drops).toEqual([
      { id: "crate-a", type: "health", x: 50, y: 60 }
    ]);
    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.5).drops[0].type).toBe("ammo");
    expect(advanceMapObjects(0, 16, [], [crate], config, () => 0.9).drops[0].type).toBe("boost");
  });
});
