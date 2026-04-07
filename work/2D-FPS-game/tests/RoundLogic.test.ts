import { RoundLogic } from "../src/domain/round/RoundLogic";

describe("RoundLogic", () => {
  it("increments player score and round number on player win", () => {
    const round = new RoundLogic();

    round.registerPlayerWin();

    expect(round.state.playerScore).toBe(1);
    expect(round.state.dummyScore).toBe(0);
    expect(round.state.roundNumber).toBe(2);
    expect(round.state.lastResult).toBe("PLAYER WON ROUND");
    expect(round.state.matchWinner).toBeNull();
    expect(round.state.isMatchOver).toBe(false);
  });

  it("increments dummy score and round number on dummy win", () => {
    const round = new RoundLogic();

    round.registerDummyWin();

    expect(round.state.playerScore).toBe(0);
    expect(round.state.dummyScore).toBe(1);
    expect(round.state.roundNumber).toBe(2);
    expect(round.state.lastResult).toBe("DUMMY WON ROUND");
    expect(round.state.matchWinner).toBeNull();
    expect(round.state.isMatchOver).toBe(false);
  });

  it("marks the match over when the player reaches the score target", () => {
    const round = new RoundLogic(2);

    round.registerPlayerWin();
    round.registerPlayerWin();

    expect(round.state.playerScore).toBe(2);
    expect(round.state.matchWinner).toBe("PLAYER");
    expect(round.state.isMatchOver).toBe(true);
    expect(round.state.lastResult).toBe("PLAYER WON MATCH");
  });

  it("blocks additional score changes after the match is over", () => {
    const round = new RoundLogic(1);

    round.registerDummyWin();
    round.registerPlayerWin();

    expect(round.state.playerScore).toBe(0);
    expect(round.state.dummyScore).toBe(1);
    expect(round.state.matchWinner).toBe("DUMMY");
    expect(round.state.isMatchOver).toBe(true);
    expect(round.state.roundNumber).toBe(2);
  });

  it("resets the match state", () => {
    const round = new RoundLogic();

    round.registerPlayerWin();
    round.registerDummyWin();
    round.resetMatch();

    expect(round.state.playerScore).toBe(0);
    expect(round.state.dummyScore).toBe(0);
    expect(round.state.roundNumber).toBe(1);
    expect(round.state.lastResult).toBe("READY");
    expect(round.state.matchWinner).toBeNull();
    expect(round.state.isMatchOver).toBe(false);
  });
});
