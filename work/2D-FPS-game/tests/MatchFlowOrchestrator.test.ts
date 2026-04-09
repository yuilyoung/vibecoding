import { planRoundReset, resolveStageFlow } from "../src/domain/round/MatchFlowOrchestrator";

describe("MatchFlowOrchestrator", () => {
  it("moves from stage entry into team selection on confirm", () => {
    const decision = resolveStageFlow({
      phase: "stage-entry",
      selectedTeam: null,
      confirmPressed: true,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.enterStage).toBe(true);
    expect(decision.previewTeam).toBe("BLUE");
    expect(decision.combatEvent).toBe("SELECT TEAM: 1 BLUE / 2 RED");
  });

  it("previews the red team during team selection", () => {
    const decision = resolveStageFlow({
      phase: "team-select",
      selectedTeam: "BLUE",
      confirmPressed: false,
      selectBluePressed: false,
      selectRedPressed: true,
      roundStarting: false
    });

    expect(decision.previewTeam).toBe("RED");
    expect(decision.confirmDeployment).toBe(false);
    expect(decision.combatEvent).toBe("TEAM PREVIEW RED");
  });

  it("confirms deployment only when a team is selected", () => {
    const decision = resolveStageFlow({
      phase: "team-select",
      selectedTeam: "RED",
      confirmPressed: true,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.confirmDeployment).toBe(true);
    expect(decision.combatEvent).toBe("DEPLOYING RED");
  });

  it("starts combat after deployment countdown ends", () => {
    const decision = resolveStageFlow({
      phase: "deploying",
      selectedTeam: "BLUE",
      confirmPressed: false,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.startCombat).toBe(true);
    expect(decision.combatEvent).toBe("COMBAT LIVE");
  });

  it("plans match confirmation timing when the match is over", () => {
    const plan = planRoundReset({
      isMatchOver: true,
      matchWinner: "PLAYER",
      now: 1000,
      matchResetDelayMs: 2500,
      respawnDelayMs: 1600
    });

    expect(plan.clearBullets).toBe(true);
    expect(plan.matchConfirmAtMs).toBe(3500);
    expect(plan.roundResetAtMs).toBeNull();
    expect(plan.combatEvent).toBe("PLAYER LOCKED");
  });

  it("plans round redeploy timing when the match is still active", () => {
    const plan = planRoundReset({
      isMatchOver: false,
      matchWinner: null,
      now: 800,
      matchResetDelayMs: 2500,
      respawnDelayMs: 1600
    });

    expect(plan.clearBullets).toBe(true);
    expect(plan.matchConfirmAtMs).toBeNull();
    expect(plan.roundResetAtMs).toBe(2400);
    expect(plan.combatEvent).toBeNull();
  });
});
