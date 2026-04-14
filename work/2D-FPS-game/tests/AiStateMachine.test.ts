import { AiStateMachine } from "../src/domain/ai/AiStateMachine";

describe("AiStateMachine", () => {
  const machine = new AiStateMachine({
    engageRange: 260,
    attackRange: 140,
    retreatRange: 90,
    lowHealthThreshold: 0.35
  });

  it("stays idle when the target is far away and not visible", () => {
    const state = machine.evaluate({
      currentState: "idle",
      distanceToTarget: 420,
      healthRatio: 1,
      hasLineOfSight: false
    });

    expect(state).toBe("idle");
  });

  it("switches to patrol when the target is hidden but still within engage range", () => {
    const state = machine.evaluate({
      currentState: "chase",
      distanceToTarget: 180,
      healthRatio: 1,
      hasLineOfSight: false
    });

    expect(state).toBe("patrol");
  });

  it("chases when the target is visible but outside attack range", () => {
    const state = machine.evaluate({
      currentState: "patrol",
      distanceToTarget: 200,
      healthRatio: 1,
      hasLineOfSight: true
    });

    expect(state).toBe("chase");
  });

  it("attacks when the target is visible and close enough", () => {
    const state = machine.evaluate({
      currentState: "chase",
      distanceToTarget: 120,
      healthRatio: 1,
      hasLineOfSight: true
    });

    expect(state).toBe("attack");
  });

  it("retreats when health is low", () => {
    const state = machine.evaluate({
      currentState: "attack",
      distanceToTarget: 110,
      healthRatio: 0.2,
      hasLineOfSight: true
    });

    expect(state).toBe("retreat");
  });
});
