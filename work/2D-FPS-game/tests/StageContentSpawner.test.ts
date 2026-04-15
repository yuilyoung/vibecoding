import gameBalance from "../assets/data/game-balance.json";
import {
  StageContentSpawner
} from "../src/domain/map/StageContentSpawner";
import type { StageDefinitionWithContent } from "../src/domain/map/StageContentDefinition";

const stages = gameBalance.stages as readonly StageDefinitionWithContent[];

describe("StageContentSpawner", () => {
  it("creates a stable active plan for the current stage", () => {
    const spawner = new StageContentSpawner();
    const plan = spawner.spawn(stages[0]);

    expect(plan).toEqual({
      stageId: "foundry",
      stageLabel: "Foundry",
      hazards: stages[0].content.hazards,
      pickups: stages[0].content.pickups,
      gates: stages[0].content.gates
    });
    expect(spawner.getActivePlan()).toBe(plan);
  });

  it("replaces the active plan on stage change and clears it on reset", () => {
    const spawner = new StageContentSpawner();

    const first = spawner.spawn(stages[0]);
    const second = spawner.spawn(stages[1]);

    expect(first.stageId).toBe("foundry");
    expect(second.stageId).toBe("relay-yard");
    expect(spawner.getActivePlan()).toBe(second);

    spawner.clear();

    expect(spawner.getActivePlan()).toBeNull();
  });

  it("normalizes raw content before storing the active plan", () => {
    const spawner = new StageContentSpawner();
    const stage = {
      ...stages[2],
      content: {
        hazards: [
          {
            id: "drain-fog",
            kind: "toxic",
            x: 18.9,
            y: 64.2,
            width: 24.7,
            height: 11.3,
            damage: 4.9,
            tickMs: 799.6,
            label: " Drain Fog "
          }
        ],
        pickups: [
          {
            id: "drain-cache",
            kind: "ammo",
            x: 611.4,
            y: 401.9,
            amount: 9.9,
            respawnMs: 4999.9,
            label: " Drain Cache "
          }
        ],
        gates: [
          {
            id: "drain-hatch",
            kind: "switch",
            x: 578.6,
            y: 374.4,
            width: 64.8,
            height: 30.1,
            locked: 0,
            label: " Drain Hatch ",
            targetStageId: "foundry"
          }
        ]
      }
    } as unknown as StageDefinitionWithContent;

    const plan = spawner.spawn(stage);

    expect(plan).toEqual({
      stageId: "storm-drain",
      stageLabel: "Storm Drain",
      hazards: [
        {
          id: "drain-fog",
          kind: "toxic",
          x: 18,
          y: 64,
          width: 24,
          height: 11,
          damage: 4,
          tickMs: 799,
          label: "Drain Fog"
        }
      ],
      pickups: [
        {
          id: "drain-cache",
          kind: "ammo",
          x: 611,
          y: 401,
          amount: 9,
          respawnMs: 4999,
          label: "Drain Cache"
        }
      ],
      gates: [
        {
          id: "drain-hatch",
          kind: "switch",
          x: 578,
          y: 374,
          width: 64,
          height: 30,
          locked: false,
          label: "Drain Hatch",
          targetStageId: "foundry"
        }
      ]
    });
  });
});
