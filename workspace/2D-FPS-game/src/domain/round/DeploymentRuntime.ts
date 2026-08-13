import type { SpawnAssignment } from "./MatchFlowLogic";

export interface DeploymentViewState {
  readonly playerPositionX: number;
  readonly playerPositionY: number;
  readonly playerRotation: number;
  readonly dummyPositionX: number;
  readonly dummyPositionY: number;
  readonly dummyRotation: number;
  readonly spawnSummary: string;
  readonly gateOpen: boolean;
}

export function createDeploymentViewState(assignment: SpawnAssignment): DeploymentViewState {
  return {
    playerPositionX: assignment.playerSpawn.x,
    playerPositionY: assignment.playerSpawn.y,
    playerRotation: 0,
    dummyPositionX: assignment.dummySpawn.x,
    dummyPositionY: assignment.dummySpawn.y,
    dummyRotation: Math.PI,
    spawnSummary: `${assignment.playerSpawn.label} vs ${assignment.dummySpawn.label}`,
    gateOpen: false
  };
}
