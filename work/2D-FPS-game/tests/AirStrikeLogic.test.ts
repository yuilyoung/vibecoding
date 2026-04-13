import { advanceAirStrike, createAirStrike } from "../src/domain/combat/AirStrikeLogic";

describe("AirStrikeLogic", () => {
  it("starts idle with no blasts emitted", () => {
    const state = createAirStrike(300, 180);

    expect(state.targetX).toBe(300);
    expect(state.targetY).toBe(180);
    expect(state.elapsedMs).toBe(0);
    expect(state.nextBlastIndex).toBe(0);
    expect(state.completed).toBe(false);

    const result = advanceAirStrike(state, 0);

    expect(result.blasts).toHaveLength(0);
    expect(result.state.elapsedMs).toBe(0);
    expect(result.state.completed).toBe(false);
  });

  it("emits the first blast only after the initial delay window", () => {
    const state = createAirStrike(300, 180);

    const beforeDelay = advanceAirStrike(state, 319);
    expect(beforeDelay.blasts).toHaveLength(0);
    expect(beforeDelay.state.nextBlastIndex).toBe(0);

    const firstBlast = advanceAirStrike(beforeDelay.state, 1);
    expect(firstBlast.blasts).toHaveLength(1);
    expect(firstBlast.blasts[0].scheduledAtMs).toBe(320);
    expect(firstBlast.blasts[0].x).toBe(300);
    expect(firstBlast.blasts[0].y).toBe(180);
    expect(firstBlast.state.nextBlastIndex).toBe(1);
  });

  it("completes after five staggered blasts", () => {
    let state = createAirStrike(120, 90);
    const blasts = [];

    for (let step = 0; step < 5; step += 1) {
      const result = advanceAirStrike(state, 320);
      blasts.push(...result.blasts);
      state = result.state;
    }

    expect(blasts).toHaveLength(5);
    expect(state.completed).toBe(true);
    expect(state.nextBlastIndex).toBe(5);

    const afterComplete = advanceAirStrike(state, 320);
    expect(afterComplete.blasts).toHaveLength(0);
    expect(afterComplete.state).toBe(state);
  });

  it("uses a deterministic spread pattern for repeated runs", () => {
    const firstRun = collectBlasts(createAirStrike(250, 140));
    const secondRun = collectBlasts(createAirStrike(250, 140));

    expect(secondRun).toEqual(firstRun);
    expect(firstRun).toHaveLength(5);
    expect(firstRun[0]).toEqual({ x: 250, y: 140 });
    expect(firstRun[1]).toEqual({ x: 222.16, y: 128.48 });
    expect(firstRun[2]).toEqual({ x: 270.16, y: 121.76 });
  });
});

function collectBlasts(initialState: ReturnType<typeof createAirStrike>): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let state = initialState;

  for (let step = 0; step < 5; step += 1) {
    const result = advanceAirStrike(state, 320);
    positions.push(...result.blasts.map((blast) => ({ x: round2(blast.x), y: round2(blast.y) })));
    state = result.state;
  }

  return positions;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
