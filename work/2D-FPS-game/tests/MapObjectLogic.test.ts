import { createMapObject, damageMapObject, destroyMapObject } from "../src/domain/map/MapObjectLogic";

describe("MapObjectLogic", () => {
  it("creates a barrel map object", () => {
    const object = createMapObject({
      id: "barrel-1",
      kind: "barrel",
      x: 120,
      y: 240,
      armedAt: 1_000,
      fuseStartedAt: 1_250
    });

    expect(object).toEqual({
      id: "barrel-1",
      kind: "barrel",
      x: 120,
      y: 240,
      hp: 60,
      active: true,
      armedAt: 1_000,
      fuseStartedAt: 1_250
    });
  });

  it("creates a mine map object", () => {
    const object = createMapObject({
      id: "mine-1",
      kind: "mine",
      x: 320,
      y: 96
    });

    expect(object.kind).toBe("mine");
    expect(object.hp).toBe(25);
    expect(object.active).toBe(true);
  });

  it("creates a crate map object", () => {
    const object = createMapObject({
      id: "crate-1",
      kind: "crate",
      x: 64,
      y: 48
    });

    expect(object.kind).toBe("crate");
    expect(object.hp).toBe(40);
    expect(object.active).toBe(true);
  });

  it("reduces hp when damaged below the destroy threshold", () => {
    const object = createMapObject({
      id: "crate-1",
      kind: "crate",
      x: 64,
      y: 48
    });

    const damaged = damageMapObject(object, 15);

    expect(damaged.hp).toBe(25);
    expect(damaged.active).toBe(true);
  });

  it("destroys an object when damage reaches exactly zero hp", () => {
    const object = createMapObject({
      id: "mine-1",
      kind: "mine",
      x: 320,
      y: 96
    });

    const damaged = damageMapObject(object, 25);

    expect(damaged.hp).toBe(0);
    expect(damaged.active).toBe(false);
  });

  it("clamps overkill damage at zero hp", () => {
    const object = createMapObject({
      id: "barrel-1",
      kind: "barrel",
      x: 120,
      y: 240
    });

    const damaged = damageMapObject(object, 75);

    expect(damaged.hp).toBe(0);
    expect(damaged.active).toBe(false);
  });

  it("destroys objects idempotently", () => {
    const object = createMapObject({
      id: "crate-1",
      kind: "crate",
      x: 64,
      y: 48
    });

    const destroyed = destroyMapObject(object);
    const destroyedAgain = destroyMapObject(destroyed);

    expect(destroyedAgain).toEqual(destroyed);
  });

  it("ignores damage for inactive objects", () => {
    const inactive = createMapObject({
      id: "crate-1",
      kind: "crate",
      x: 64,
      y: 48,
      active: false
    });

    const damaged = damageMapObject(inactive, 15);

    expect(damaged).toBe(inactive);
  });
});
