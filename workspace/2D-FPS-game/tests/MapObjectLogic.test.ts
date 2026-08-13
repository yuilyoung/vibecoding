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

  it("creates a cover map object with Sprint 2 defaults", () => {
    const object = createMapObject({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150
    });

    expect(object).toEqual({
      id: "cover-1",
      kind: "cover",
      x: 200,
      y: 150,
      hp: 60,
      active: true
    });
  });

  it("creates a bounce-wall map object with angle and reflection metadata", () => {
    const object = createMapObject({
      id: "bounce-1",
      kind: "bounce-wall",
      x: 220,
      y: 180,
      angleDegrees: 90,
      reflectionsRemaining: 3
    });

    expect(object).toMatchObject({
      id: "bounce-1",
      kind: "bounce-wall",
      hp: 1,
      active: true,
      angleDegrees: 90,
      reflectionsRemaining: 3
    });
  });

  it("creates a teleporter map object with pairing metadata", () => {
    const object = createMapObject({
      id: "teleporter-a",
      kind: "teleporter",
      x: 320,
      y: 200,
      pairId: "alpha",
      cooldownUntil: 500,
      cooldownMs: 1500
    });

    expect(object).toMatchObject({
      id: "teleporter-a",
      kind: "teleporter",
      hp: 1,
      active: true,
      pairId: "alpha",
      cooldownUntil: 500,
      cooldownMs: 1500
    });
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

  it("destroys bounce walls when reflection durability is exhausted by damage", () => {
    const wall = createMapObject({
      id: "bounce-1",
      kind: "bounce-wall",
      x: 220,
      y: 180,
      hp: 1,
      reflectionsRemaining: 1
    });

    const damaged = damageMapObject(wall, 1);

    expect(damaged).toMatchObject({
      hp: 0,
      active: false,
      reflectionsRemaining: 1
    });
  });
});
