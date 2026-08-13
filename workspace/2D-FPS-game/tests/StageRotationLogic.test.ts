import {
  createStageRotationState,
  selectNextStage,
  selectStageById
} from "../src/domain/map/StageRotationLogic";
import type { StageDefinition } from "../src/domain/map/StageDefinition";
import gameBalance from "../assets/data/game-balance.json";

const stages = gameBalance.stages as readonly StageDefinition[];

describe("StageRotationLogic", () => {
  it("loads at least three phase 2 stage definitions from balance data", () => {
    expect(stages).toHaveLength(3);
    expect(stages.map((stage) => stage.id)).toEqual(["foundry", "relay-yard", "storm-drain"]);
  });

  it("rotates stages in a stable cycle", () => {
    let state = createStageRotationState();

    const first = selectNextStage(stages, state);
    state = first.state;
    const second = selectNextStage(stages, state);
    state = second.state;
    const third = selectNextStage(stages, state);
    state = third.state;
    const fourth = selectNextStage(stages, state);

    expect([first.stage.id, second.stage.id, third.stage.id, fourth.stage.id]).toEqual([
      "foundry",
      "relay-yard",
      "storm-drain",
      "foundry"
    ]);
    expect(fourth.state.history).toEqual(["foundry", "relay-yard", "storm-drain", "foundry"]);
  });

  it("can resolve a valid stage by id", () => {
    expect(selectStageById(stages, "relay-yard")?.label).toBe("Relay Yard");
    expect(selectStageById(stages, "missing")).toBeNull();
  });

  it("rejects empty or invalid stage lists", () => {
    expect(() => selectNextStage([])).toThrow("at least one valid stage");
    expect(() => selectNextStage([{ ...stages[0], blueSpawns: [] }])).toThrow("at least one valid stage");
  });
});
