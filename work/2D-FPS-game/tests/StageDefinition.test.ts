import { isValidStageDefinition, type StageDefinition } from "../src/domain/map/StageDefinition";
import gameBalance from "../assets/data/game-balance.json";

const baseStage = gameBalance.stages[0] as StageDefinition;

describe("StageDefinition", () => {
  it("accepts the shipped stage definitions without wind overrides", () => {
    expect(gameBalance.stages).toHaveLength(3);
    expect(gameBalance.stages.every((stage) => isValidStageDefinition(stage as StageDefinition))).toBe(true);
    expect(gameBalance.stages.every((stage) => (stage as StageDefinition).wind === undefined)).toBe(true);
    expect(gameBalance.stages.every((stage) => (stage as StageDefinition).weatherZones === undefined)).toBe(true);
  });

  it("accepts a wind override when strength is within range", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      wind: {
        angleDegrees: 180,
        strength: 3
      }
    })).toBe(true);
  });

  it("rejects a wind override when strength is out of range", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      wind: {
        angleDegrees: 90,
        strength: 4
      }
    })).toBe(false);
  });

  it("accepts a valid weather override", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weather: {
        type: "fog"
      }
    })).toBe(true);
  });

  it("rejects an unknown weather override", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weather: {
        type: "hail" as "fog"
      }
    })).toBe(false);
  });

  it("accepts circle weather zones", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weatherZones: [{
        weather: "rain",
        priority: 2,
        shape: {
          kind: "circle",
          cx: 320,
          cy: 240,
          radius: 128
        }
      }]
    })).toBe(true);
  });

  it("accepts polygon weather zones", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weatherZones: [{
        weather: "fog",
        shape: {
          kind: "polygon",
          points: [
            [0, 0],
            [100, 0],
            [100, 100]
          ]
        }
      }]
    })).toBe(true);
  });

  it("rejects weather zones with an unknown shape kind", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weatherZones: [{
        weather: "storm",
        shape: {
          kind: "hexagon" as "circle",
          cx: 0,
          cy: 0,
          radius: 10
        }
      }]
    })).toBe(false);
  });

  it("rejects weather zones with an unknown weather type", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weatherZones: [{
        weather: "hail" as "fog",
        shape: {
          kind: "circle",
          cx: 0,
          cy: 0,
          radius: 10
        }
      }]
    })).toBe(false);
  });

  it("rejects weather zones with an empty polygon", () => {
    expect(isValidStageDefinition({
      ...baseStage,
      weatherZones: [{
        weather: "sandstorm",
        shape: {
          kind: "polygon",
          points: []
        }
      }]
    })).toBe(false);
  });
});
