import { DummyAiLogic } from "../src/domain/ai/DummyAiLogic";

function createAi(): DummyAiLogic {
  return new DummyAiLogic({
    engageRange: 260,
    retreatRange: 120,
    shootRange: 320,
    lowHealthThreshold: 0.35,
    botTactics: {
      engageRange: 260,
      preferredHoldRange: 180,
      flankRange: 220,
      retreatRange: 120,
      retreatHealthThreshold: 0.35,
      coverHealthThreshold: 0.8,
      reengageHealthThreshold: 0.92,
      targetWeakHealthThreshold: 0.45,
      coverSearchRadius: 220,
      flankCommitMs: 1400,
      weatherCautionVisionMultiplier: 0.85
    },
    combatTuning: {
      intentCooldownMs: 900
    }
  });
}

describe("DummyAiLogic", () => {
  it("pressures the player from long range", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 300,
      playerY: 0,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: []
    });

    expect(ai.getCurrentState()).toBe("pressure");
    expect(decision.mode).toBe("chase");
    expect(decision.moveX).toBeCloseTo(1);
    expect(decision.shouldFire).toBe(false);
  });

  it("holds and strafes when the player is inside the preferred hold range", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 170,
      playerY: 0,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: []
    });

    expect(ai.getCurrentState()).toBe("hold");
    expect(decision.mode).toBe("strafe");
    expect(decision.shouldFire).toBe(true);
    expect(Math.abs(decision.moveY)).toBeGreaterThan(0.7);
  });

  it("retreats when the player is too close", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 50,
      dummyY: 50,
      playerX: 100,
      playerY: 50,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: []
    });

    expect(ai.getCurrentState()).toBe("retreat");
    expect(decision.mode).toBe("retreat");
    expect(decision.moveX).toBeCloseTo(-1);
    expect(decision.shouldFire).toBe(true);
  });

  it("seeks cover while holding after health drops below the cover threshold", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 600,
      dummyY: 200,
      playerX: 430,
      playerY: 200,
      tickMs: 1200,
      healthRatio: 0.75,
      coverPoints: [
        { x: 700, y: 220 },
        { x: 500, y: 280 }
      ]
    });

    expect(ai.getCurrentState()).toBe("hold");
    expect(decision.mode).toBe("cover");
    expect(decision.shouldFire).toBe(false);
  });

  it("re-engages from cover when the dummy recovers or the target is weak", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 700,
      dummyY: 220,
      playerX: 520,
      playerY: 220,
      tickMs: 1200,
      healthRatio: 0.95,
      playerHealthRatio: 0.4,
      coverPoints: [
        { x: 700, y: 220 },
        { x: 500, y: 280 }
      ]
    });

    expect(ai.getCurrentState()).toBe("flank");
    expect(decision.mode).toBe("flank");
    expect(decision.shouldFire).toBe(true);
  });

  it("keeps flanking during the flank commit window", () => {
    const ai = createAi();

    ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 180,
      playerY: 0,
      tickMs: 1000,
      healthRatio: 1,
      coverPoints: [{ x: 80, y: 80 }]
    });
    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 260,
      playerY: 0,
      tickMs: 1800,
      healthRatio: 1,
      coverPoints: []
    });

    expect(ai.getCurrentState()).toBe("flank");
    expect(decision.mode).toBe("flank");
  });

  it("shifts from pressure to hold when weather cuts safe vision", () => {
    const ai = createAi();

    ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 300,
      playerY: 0,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: []
    });
    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 170,
      playerY: 0,
      tickMs: 2400,
      healthRatio: 1,
      coverPoints: [],
      effectiveVisionRange: 120
    });

    expect(ai.getCurrentState()).toBe("hold");
    expect(decision.mode).toBe("strafe");
    expect(decision.shouldFire).toBe(true);
  });

  it("reroutes and holds fire when a wall blocks line of sight", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 0,
      dummyY: 0,
      playerX: 200,
      playerY: 0,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: [],
      lineOfSightBlockers: [{ x: 100, y: 0, width: 24, height: 100 }]
    });

    expect(decision.mode).toBe("reposition");
    expect(decision.shouldFire).toBe(false);
    expect(Math.abs(decision.moveY)).toBeGreaterThan(0.7);
  });

  it("prioritizes leaving hazard zones before tactical movement", () => {
    const ai = createAi();

    const decision = ai.evaluate({
      dummyX: 105,
      dummyY: 100,
      playerX: 200,
      playerY: 100,
      tickMs: 1200,
      healthRatio: 1,
      coverPoints: [],
      hazardZones: [{ x: 90, y: 80, width: 40, height: 40, padding: 12 }]
    });

    expect(decision.mode).toBe("avoid-hazard");
    expect(decision.moveX).toBeLessThan(0);
    expect(decision.shouldFire).toBe(false);
  });
});
