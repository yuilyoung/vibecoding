export type TeamId = "BLUE" | "RED";

export type MatchFlowPhase =
  | "stage-entry"
  | "team-select"
  | "deploying"
  | "combat-live"
  | "match-over";

export interface SpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface SpawnAssignment {
  readonly playerTeam: TeamId;
  readonly dummyTeam: TeamId;
  readonly playerSpawn: SpawnPoint;
  readonly dummySpawn: SpawnPoint;
}

export interface MatchFlowState {
  phase: MatchFlowPhase;
  selectedTeam: TeamId | null;
  deploymentCount: number;
}

type SpawnTable = Record<TeamId, readonly SpawnPoint[]>;

export class MatchFlowLogic {
  public readonly state: MatchFlowState;

  public constructor() {
    this.state = {
      phase: "stage-entry",
      selectedTeam: null,
      deploymentCount: 0
    };
  }

  public enterStage(): boolean {
    if (this.state.phase !== "stage-entry") {
      return false;
    }

    this.state.phase = "team-select";
    return true;
  }

  public previewTeam(team: TeamId): void {
    this.state.selectedTeam = team;
  }

  public confirmTeamSelection(spawns: SpawnTable, rng = Math.random): SpawnAssignment {
    if (this.state.selectedTeam === null) {
      throw new Error("MatchFlowLogic requires a selected team before deployment.");
    }

    this.state.phase = "deploying";
    this.state.deploymentCount += 1;
    return this.createAssignment(this.state.selectedTeam, spawns, rng);
  }

  public startCombat(): boolean {
    if (this.state.phase !== "deploying") {
      return false;
    }

    this.state.phase = "combat-live";
    return true;
  }

  public enterMatchOver(): void {
    this.state.phase = "match-over";
  }

  public prepareNextMatch(): void {
    this.state.phase = "team-select";
    this.state.selectedTeam = null;
    this.state.deploymentCount = 0;
  }

  public redeploy(spawns: SpawnTable, rng = Math.random): SpawnAssignment {
    if (this.state.selectedTeam === null) {
      throw new Error("MatchFlowLogic cannot redeploy without a selected team.");
    }

    this.state.phase = "deploying";
    this.state.deploymentCount += 1;
    return this.createAssignment(this.state.selectedTeam, spawns, rng);
  }

  private createAssignment(playerTeam: TeamId, spawns: SpawnTable, rng: () => number): SpawnAssignment {
    const dummyTeam = playerTeam === "BLUE" ? "RED" : "BLUE";

    return {
      playerTeam,
      dummyTeam,
      playerSpawn: this.pickSpawn(spawns[playerTeam], rng),
      dummySpawn: this.pickSpawn(spawns[dummyTeam], rng)
    };
  }

  private pickSpawn(spawns: readonly SpawnPoint[], rng: () => number): SpawnPoint {
    if (spawns.length === 0) {
      throw new Error("MatchFlowLogic requires at least one spawn point per team.");
    }

    const index = Math.min(spawns.length - 1, Math.floor(rng() * spawns.length));
    return spawns[index];
  }
}
