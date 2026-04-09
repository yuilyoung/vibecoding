import { MatchFlowLogic } from "../src/domain/round/MatchFlowLogic";

describe("MatchFlowLogic", () => {
  const spawnTable = {
    BLUE: [
      { x: 100, y: 100, label: "BLUE A" },
      { x: 180, y: 140, label: "BLUE B" }
    ],
    RED: [
      { x: 760, y: 360, label: "RED A" },
      { x: 840, y: 420, label: "RED B" }
    ]
  } as const;

  it("enters stage once and advances to team selection", () => {
    const flow = new MatchFlowLogic();

    expect(flow.enterStage()).toBe(true);
    expect(flow.state.phase).toBe("team-select");
    expect(flow.enterStage()).toBe(false);
  });

  it("confirms the selected team and assigns opposite-side spawns", () => {
    const flow = new MatchFlowLogic();

    flow.enterStage();
    flow.previewTeam("RED");
    const assignment = flow.confirmTeamSelection(spawnTable, () => 0.75);

    expect(flow.state.phase).toBe("deploying");
    expect(flow.state.selectedTeam).toBe("RED");
    expect(assignment.playerTeam).toBe("RED");
    expect(assignment.dummyTeam).toBe("BLUE");
    expect(assignment.playerSpawn.label).toBe("RED B");
    expect(assignment.dummySpawn.label).toBe("BLUE B");
  });

  it("moves from deployment into combat live", () => {
    const flow = new MatchFlowLogic();

    flow.enterStage();
    flow.previewTeam("BLUE");
    flow.confirmTeamSelection(spawnTable, () => 0);

    expect(flow.startCombat()).toBe(true);
    expect(flow.state.phase).toBe("combat-live");
    expect(flow.startCombat()).toBe(false);
  });

  it("redeploys the same selected team for the next round", () => {
    const flow = new MatchFlowLogic();

    flow.enterStage();
    flow.previewTeam("BLUE");
    flow.confirmTeamSelection(spawnTable, () => 0);
    flow.startCombat();

    const assignment = flow.redeploy(spawnTable, () => 0.99);

    expect(flow.state.phase).toBe("deploying");
    expect(flow.state.deploymentCount).toBe(2);
    expect(assignment.playerTeam).toBe("BLUE");
    expect(assignment.playerSpawn.label).toBe("BLUE B");
    expect(assignment.dummySpawn.label).toBe("RED B");
  });

  it("resets back to team selection for a new match", () => {
    const flow = new MatchFlowLogic();

    flow.enterStage();
    flow.previewTeam("BLUE");
    flow.confirmTeamSelection(spawnTable, () => 0);
    flow.enterMatchOver();
    flow.prepareNextMatch();

    expect(flow.state.phase).toBe("team-select");
    expect(flow.state.selectedTeam).toBeNull();
    expect(flow.state.deploymentCount).toBe(0);
  });
});
