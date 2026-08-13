export interface RoundState {
  playerScore: number;
  dummyScore: number;
  roundNumber: number;
  lastResult: string;
  matchWinner: "PLAYER" | "DUMMY" | null;
  isMatchOver: boolean;
  scoreToWin: number;
}

export class RoundLogic {
  public readonly state: RoundState;

  public constructor(scoreToWin = 3) {
    this.state = {
      playerScore: 0,
      dummyScore: 0,
      roundNumber: 1,
      lastResult: "READY",
      matchWinner: null,
      isMatchOver: false,
      scoreToWin
    };
  }

  public registerPlayerWin(): void {
    if (this.state.isMatchOver) {
      return;
    }

    this.state.playerScore += 1;
    this.state.roundNumber += 1;
    this.updateMatchState("PLAYER");
  }

  public registerDummyWin(): void {
    if (this.state.isMatchOver) {
      return;
    }

    this.state.dummyScore += 1;
    this.state.roundNumber += 1;
    this.updateMatchState("DUMMY");
  }

  public resetMatch(): void {
    this.state.playerScore = 0;
    this.state.dummyScore = 0;
    this.state.roundNumber = 1;
    this.state.lastResult = "READY";
    this.state.matchWinner = null;
    this.state.isMatchOver = false;
  }

  private updateMatchState(roundWinner: "PLAYER" | "DUMMY"): void {
    const winnerScore = roundWinner === "PLAYER" ? this.state.playerScore : this.state.dummyScore;

    if (winnerScore >= this.state.scoreToWin) {
      this.state.matchWinner = roundWinner;
      this.state.isMatchOver = true;
      this.state.lastResult = `${roundWinner} WON MATCH`;
      return;
    }

    this.state.lastResult = `${roundWinner} WON ROUND`;
  }
}
