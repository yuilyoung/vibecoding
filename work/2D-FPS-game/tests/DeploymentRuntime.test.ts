import { createDeploymentViewState } from "../src/domain/round/DeploymentRuntime";

describe("DeploymentRuntime", () => {
  it("creates deployment view state from a spawn assignment", () => {
    const deployment = createDeploymentViewState({
      playerTeam: "BLUE",
      dummyTeam: "RED",
      playerSpawn: { x: 120, y: 140, label: "BLUE ENTRY A" },
      dummySpawn: { x: 760, y: 360, label: "RED ENTRY A" }
    });

    expect(deployment.playerPositionX).toBe(120);
    expect(deployment.playerPositionY).toBe(140);
    expect(deployment.playerRotation).toBe(0);
    expect(deployment.dummyPositionX).toBe(760);
    expect(deployment.dummyPositionY).toBe(360);
    expect(deployment.dummyRotation).toBe(Math.PI);
    expect(deployment.spawnSummary).toBe("BLUE ENTRY A vs RED ENTRY A");
    expect(deployment.gateOpen).toBe(false);
  });
});
