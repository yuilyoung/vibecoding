import { AiStateMachine } from "../src/domain/ai/AiStateMachine";

describe("AiStateMachine", () => {
  const machine = new AiStateMachine({
    engageRange: 260,
    preferredHoldRange: 180,
    flankRange: 220,
    retreatRange: 90,
    lowHealthThreshold: 0.35,
    coverHealthThreshold: 0.8,
    flankCommitMs: 1400,
    intentCooldownMs: 900,
    weatherCautionVisionMultiplier: 0.85
  });

  it("stays idle when the target is hidden and outside engage range", () => {
    const state = machine.evaluate({
      currentState: "idle",
      distanceToTarget: 420,
      healthRatio: 1,
      hasLineOfSight: false,
      hasCoverAvailable: false,
      nowMs: 2000,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("idle");
  });

  it("switches to pressure when the target is visible at long range", () => {
    const state = machine.evaluate({
      currentState: "idle",
      distanceToTarget: 320,
      healthRatio: 1,
      hasLineOfSight: true,
      hasCoverAvailable: false,
      nowMs: 2000,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("pressure");
  });

  it("switches to hold when weather reduces safe vision", () => {
    const state = machine.evaluate({
      currentState: "pressure",
      distanceToTarget: 170,
      healthRatio: 1,
      hasLineOfSight: true,
      hasCoverAvailable: false,
      effectiveVisionRange: 120,
      nowMs: 2000,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("hold");
  });

  it("switches to flank when cover is available at close combat range", () => {
    const state = machine.evaluate({
      currentState: "hold",
      distanceToTarget: 150,
      healthRatio: 1,
      hasLineOfSight: true,
      hasCoverAvailable: true,
      nowMs: 2000,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("flank");
  });

  it("retreats when health is low", () => {
    const state = machine.evaluate({
      currentState: "flank",
      distanceToTarget: 150,
      healthRatio: 0.2,
      hasLineOfSight: true,
      hasCoverAvailable: true,
      nowMs: 2000,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("retreat");
  });

  it("holds the current flank during the flank commit window", () => {
    const state = machine.evaluate({
      currentState: "flank",
      distanceToTarget: 240,
      healthRatio: 1,
      hasLineOfSight: true,
      hasCoverAvailable: false,
      nowMs: 700,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("flank");
  });

  it("keeps the current tactical state during the general intent cooldown", () => {
    const state = machine.evaluate({
      currentState: "hold",
      distanceToTarget: 260,
      healthRatio: 1,
      hasLineOfSight: true,
      hasCoverAvailable: false,
      nowMs: 400,
      stateEnteredAtMs: 0
    });

    expect(state).toBe("hold");
  });
});
