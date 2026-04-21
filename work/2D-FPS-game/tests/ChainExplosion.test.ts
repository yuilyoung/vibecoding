import { resolveChainExplosion } from "../src/domain/combat/ExplosionLogic";

describe("resolveChainExplosion", () => {
  it("chains two barrels within trigger radius", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 70, y: 0, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a", "barrel-b"]);
  });

  it("returns triggered barrels in deterministic depth order", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-d", x: 120, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 60, y: 0, triggerRadius: 70 },
        { id: "barrel-c", x: 0, y: 60, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a", "barrel-b", "barrel-c", "barrel-d"]);
  });

  it("uses each triggered barrel radius for the next chain step", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 60, y: 0, triggerRadius: 50 },
        { id: "barrel-c", x: 110, y: 0, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a", "barrel-b", "barrel-c"]);
  });

  it("does not chain when candidates are outside the active barrel radius", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 71, y: 0, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a"]);
  });

  it("prevents cycles from retriggering barrels", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 60, y: 0, triggerRadius: 70 },
        { id: "barrel-c", x: 30, y: 52, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a", "barrel-b", "barrel-c"]);
  });

  it("caps chain expansion at five steps", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-0",
      maxDepth: 99,
      objects: [
        { id: "barrel-0", x: 0, y: 0, triggerRadius: 15 },
        { id: "barrel-1", x: 10, y: 0, triggerRadius: 15 },
        { id: "barrel-2", x: 20, y: 0, triggerRadius: 15 },
        { id: "barrel-3", x: 30, y: 0, triggerRadius: 15 },
        { id: "barrel-4", x: 40, y: 0, triggerRadius: 15 },
        { id: "barrel-5", x: 50, y: 0, triggerRadius: 15 },
        { id: "barrel-6", x: 60, y: 0, triggerRadius: 15 }
      ]
    });

    expect(triggered).toEqual([
      "barrel-0",
      "barrel-1",
      "barrel-2",
      "barrel-3",
      "barrel-4",
      "barrel-5"
    ]);
  });

  it("ignores barrels with non-positive trigger radius as active chain sources", () => {
    const triggered = resolveChainExplosion({
      originId: "barrel-a",
      maxDepth: 5,
      objects: [
        { id: "barrel-a", x: 0, y: 0, triggerRadius: 70 },
        { id: "barrel-b", x: 60, y: 0, triggerRadius: 0 },
        { id: "barrel-c", x: 120, y: 0, triggerRadius: 70 }
      ]
    });

    expect(triggered).toEqual(["barrel-a", "barrel-b"]);
  });
});
