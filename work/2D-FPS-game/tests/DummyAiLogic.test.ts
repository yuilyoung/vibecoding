import { DummyAiLogic } from "../src/domain/ai/DummyAiLogic";

describe("DummyAiLogic", () => {
  it("chases the player when outside the engage range", () => {
    const ai = new DummyAiLogic({
      engageRange: 220,
      retreatRange: 120,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 300,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: []
    });

    expect(decision.mode).toBe("chase");
    expect(decision.moveX).toBeCloseTo(1);
    expect(decision.moveY).toBeCloseTo(0);
    expect(decision.shouldFire).toBe(false);
  });

  it("retreats when the player is too close", () => {
    const ai = new DummyAiLogic({
      engageRange: 220,
      retreatRange: 120,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 50,
      dummyY: 50,
      playerX: 100,
      playerY: 50,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: []
    });

    expect(decision.mode).toBe("retreat");
    expect(decision.moveX).toBeCloseTo(-1);
    expect(decision.moveY).toBeCloseTo(0);
    expect(decision.shouldFire).toBe(true);
  });

  it("strafes and fires when the player is in the preferred range", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 120,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: []
    });

    expect(decision.mode).toBe("flank");
    expect(decision.moveX).toBeGreaterThan(0);
    expect(decision.moveY).toBeGreaterThan(0);
    expect(decision.shouldFire).toBe(true);
  });

  it("reroutes and holds fire when a wall blocks line of sight", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 80,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: [],
      lineOfSightBlockers: [{ x: 100, y: 0, width: 24, height: 100 }]
    });

    expect(decision.mode).toBe("reposition");
    expect(decision.shouldFire).toBe(false);
    expect(Math.abs(decision.moveY)).toBeGreaterThan(0.7);
  });

  it("fires when blockers do not intersect line of sight", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 80,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: [],
      lineOfSightBlockers: [{ x: 100, y: 90, width: 24, height: 40 }]
    });

    expect(decision.mode).toBe("flank");
    expect(decision.shouldFire).toBe(true);
  });

  it("repositions toward cover when line of sight is blocked", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 80,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: [{ x: 50, y: 100 }],
      lineOfSightBlockers: [{ x: 100, y: 0, width: 24, height: 100 }]
    });

    expect(decision.mode).toBe("reposition");
    expect(decision.shouldFire).toBe(false);
    expect(Math.abs(decision.moveY)).toBeGreaterThan(0.7);
  });

  it("sidesteps around a blocking obstacle instead of pushing straight into it", () => {
    const ai = new DummyAiLogic({
      engageRange: 220,
      retreatRange: 80,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 320,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: [],
      lineOfSightBlockers: [{ x: 120, y: -60, width: 60, height: 120 }]
    });

    expect(decision.mode).toBe("reposition");
    expect(decision.shouldFire).toBe(false);
    expect(decision.moveX).toBeGreaterThan(0);
    expect(Math.abs(decision.moveY)).toBeGreaterThan(0.7);
  });

  it("prioritizes leaving hazard zones before combat movement", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 80,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 105,
      dummyY: 100,
      playerX: 200,
      playerY: 100,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: [],
      hazardZones: [{ x: 90, y: 80, width: 40, height: 40, padding: 12 }]
    });

    expect(decision.mode).toBe("avoid-hazard");
    expect(decision.moveX).toBeLessThan(0);
    expect(decision.shouldFire).toBe(false);
  });

  it("alternates strafe direction based on time", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 120,
      shootRange: 180,
      lowHealthThreshold: 0.35
    });

    const first = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 0,
      healthRatio: 1,
      coverPoints: []
    });
    const second = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 800,
      healthRatio: 1,
      coverPoints: []
    });

    expect(first.moveY).toBeGreaterThan(0.7);
    expect(second.moveY).toBeLessThan(-0.7);
    expect(first.mode).toBe("strafe");
    expect(second.mode).toBe("strafe");
  });

  it("seeks cover when health is low and cover points are available", () => {
    const ai = new DummyAiLogic({
      engageRange: 260,
      retreatRange: 120,
      shootRange: 320,
      lowHealthThreshold: 0.35
    });

    const decision = ai.evaluate({
      dummyX: 600,
      dummyY: 200,
      playerX: 300,
      playerY: 200,
      tickMs: 0,
      healthRatio: 0.2,
      coverPoints: [
        { x: 700, y: 220 },
        { x: 500, y: 280 }
      ]
    });

    expect(decision.mode).toBe("cover");
    expect(decision.moveX).toBeGreaterThan(0);
    expect(decision.shouldFire).toBe(false);
  });
});
