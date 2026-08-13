import { createMapObject } from "../src/domain/map/MapObjectLogic";
import { resolveTeleport } from "../src/domain/map/TeleporterLogic";

describe("TeleporterLogic", () => {
  const actor = {
    id: "player",
    x: 100,
    y: 100
  };

  it("routes an actor to the paired teleporter and applies cooldown to both ends", () => {
    const result = resolveTeleport(
      actor,
      [
        createMapObject({
          id: "tp-a",
          kind: "teleporter",
          x: 100,
          y: 100,
          pairId: "alpha",
          cooldownMs: 1500
        }),
        createMapObject({
          id: "tp-b",
          kind: "teleporter",
          x: 300,
          y: 220,
          pairId: "alpha",
          cooldownMs: 1500
        })
      ],
      1_000
    );

    expect(result).toEqual({
      x: 300,
      y: 220,
      cooldownUntil: 2_500,
      sourceId: "tp-a",
      destinationId: "tp-b"
    });
  });

  it("returns null while the source teleporter is cooling down", () => {
    const result = resolveTeleport(
      actor,
      [
        createMapObject({
          id: "tp-a",
          kind: "teleporter",
          x: 100,
          y: 100,
          pairId: "alpha",
          cooldownUntil: 2_000
        }),
        createMapObject({
          id: "tp-b",
          kind: "teleporter",
          x: 300,
          y: 220,
          pairId: "alpha"
        })
      ],
      1_000
    );

    expect(result).toBeNull();
  });

  it("returns null when a pair cannot be resolved deterministically", () => {
    const result = resolveTeleport(
      actor,
      [
        createMapObject({
          id: "tp-a",
          kind: "teleporter",
          x: 100,
          y: 100,
          pairId: "alpha"
        })
      ],
      1_000
    );

    expect(result).toBeNull();
  });

  it("selects the matching pair when multiple pair ids exist", () => {
    const result = resolveTeleport(
      actor,
      [
        createMapObject({
          id: "tp-a",
          kind: "teleporter",
          x: 100,
          y: 100,
          pairId: "alpha"
        }),
        createMapObject({
          id: "tp-b",
          kind: "teleporter",
          x: 300,
          y: 220,
          pairId: "alpha"
        }),
        createMapObject({
          id: "tp-c",
          kind: "teleporter",
          x: 500,
          y: 350,
          pairId: "beta"
        }),
        createMapObject({
          id: "tp-d",
          kind: "teleporter",
          x: 700,
          y: 350,
          pairId: "beta"
        })
      ],
      1_000
    );

    expect(result?.destinationId).toBe("tp-b");
  });
});
