import gameBalance from "../assets/data/game-balance.json";
import { StageContentSpawner } from "../src/domain/map/StageContentSpawner";
import {
  normalizeStageContentDefinition,
  type StageDefinitionWithContent
} from "../src/domain/map/StageContentDefinition";

const stages = gameBalance.stages as unknown as readonly StageDefinitionWithContent[];

describe("StageContentSpawner", () => {
  it("creates a stable active plan for the current stage", () => {
    const spawner = new StageContentSpawner();
    const plan = spawner.spawn(stages[0]);
    const normalizedContent = normalizeStageContentDefinition(stages[0].content);

    expect(plan).toEqual({
      stageId: "foundry",
      stageLabel: "Foundry",
      hazards: normalizedContent.hazards,
      pickups: normalizedContent.pickups,
      gates: normalizedContent.gates,
      mapObjects: normalizedContent.mapObjects
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
        ],
        mapObjects: [
          {
            id: "drain-mine",
            kind: "mine",
            x: 204.8,
            y: 88.6
          },
          {
            id: "drain-barrel",
            kind: "barrel",
            x: 320.4,
            y: 220.9
          },
          {
            id: "drain-bounce",
            kind: "bounce-wall",
            x: 440.9,
            y: 120.3,
            angleDegrees: 14.7
          },
          {
            id: "drain-tele-a",
            kind: "teleporter",
            x: 180.9,
            y: 160.2,
            pairId: "pair-z"
          },
          {
            id: "drain-tele-b",
            kind: "teleporter",
            x: 520.5,
            y: 300.8,
            pairId: " pair-z "
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
      ],
      mapObjects: [
        {
          id: "drain-mine",
          kind: "mine",
          x: 204,
          y: 88,
          angleDegrees: undefined,
          pairId: undefined
        },
        {
          id: "drain-barrel",
          kind: "barrel",
          x: 320,
          y: 220,
          angleDegrees: undefined,
          pairId: undefined
        },
        {
          id: "drain-bounce",
          kind: "bounce-wall",
          x: 440,
          y: 120,
          angleDegrees: 14,
          pairId: undefined
        },
        {
          id: "drain-tele-a",
          kind: "teleporter",
          x: 180,
          y: 160,
          angleDegrees: undefined,
          pairId: "pair-z"
        },
        {
          id: "drain-tele-b",
          kind: "teleporter",
          x: 520,
          y: 300,
          angleDegrees: undefined,
          pairId: "pair-z"
        }
      ]
    });
  });

  it("preserves stage-specific map object fields in the active plan", () => {
    const spawner = new StageContentSpawner();
    const plan = spawner.spawn(stages[1]);

    expect(plan.mapObjects).toContainEqual({
      id: "relay-bounce-wall-a",
      kind: "bounce-wall",
      x: 480,
      y: 238,
      angleDegrees: 0,
      pairId: undefined
    });
    expect(plan.mapObjects).toContainEqual({
      id: "relay-teleporter-a",
      kind: "teleporter",
      x: 220,
      y: 356,
      angleDegrees: undefined,
      pairId: "relay-alpha"
    });
    expect(plan.mapObjects).toContainEqual({
      id: "relay-teleporter-b",
      kind: "teleporter",
      x: 744,
      y: 184,
      angleDegrees: undefined,
      pairId: "relay-alpha"
    });
  });

  it("fails fast when raw content violates advanced map object validation", () => {
    const spawner = new StageContentSpawner();
    const stage = {
      ...stages[0],
      content: {
        hazards: [],
        pickups: [],
        gates: [],
        mapObjects: [
          { id: "bad-bounce", kind: "bounce-wall", x: 10, y: 20 },
          { id: "bad-tele-a", kind: "teleporter", x: 30, y: 40, pairId: "solo" }
        ]
      }
    } as unknown as StageDefinitionWithContent;

    expect(() => spawner.spawn(stage)).toThrow();
    expect(spawner.getActivePlan()).toBeNull();
  });

  describe("edge cases (Phase 3 QA audit)", () => {
    const baseStage = {
      id: "edge-stage",
      label: "Edge Stage"
    } as unknown as StageDefinitionWithContent;

    it("produces a valid plan with zero entries when content arrays are empty", () => {
      const spawner = new StageContentSpawner();
      const stage = {
        ...baseStage,
        content: { hazards: [], pickups: [], gates: [], mapObjects: [] }
      } as unknown as StageDefinitionWithContent;

      const plan = spawner.spawn(stage);

      expect(plan.stageId).toBe("edge-stage");
      expect(plan.hazards).toEqual([]);
      expect(plan.pickups).toEqual([]);
      expect(plan.gates).toEqual([]);
      expect(plan.mapObjects).toEqual([]);
      expect(spawner.getActivePlan()).toBe(plan);
    });

    it("dedupes entries with duplicate ids by keeping the first occurrence", () => {
      const spawner = new StageContentSpawner();
      const stage = {
        ...baseStage,
        content: {
          hazards: [
            {
              id: "dup",
              kind: "lava",
              x: 1,
              y: 2,
              width: 10,
              height: 10,
              damage: 5,
              tickMs: 200,
              label: "First"
            },
            {
              id: "dup",
              kind: "steam",
              x: 99,
              y: 99,
              width: 50,
              height: 50,
              damage: 50,
              tickMs: 999,
              label: "Second"
            }
          ],
          pickups: [
            {
              id: "p-dup",
              kind: "health",
              x: 0,
              y: 0,
              amount: 10,
              respawnMs: 1000,
              label: "First Pickup"
            },
            {
              id: "p-dup",
              kind: "ammo",
              x: 5,
              y: 5,
              amount: 99,
              respawnMs: 9999,
              label: "Second Pickup"
            }
          ],
          gates: [
            {
              id: "g-dup",
              kind: "door",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              locked: false,
              label: "First Gate"
            },
            {
              id: "g-dup",
              kind: "barrier",
              x: 9,
              y: 9,
              width: 99,
              height: 99,
              locked: true,
              label: "Second Gate"
            }
          ],
          mapObjects: [
            {
              id: "m-dup",
              kind: "mine",
              x: 1,
              y: 2
            },
            {
              id: "m-dup",
              kind: "barrel",
              x: 9,
              y: 9
            }
          ]
        }
      } as unknown as StageDefinitionWithContent;

      const plan = spawner.spawn(stage);

      expect(plan.hazards).toHaveLength(1);
      expect(plan.hazards[0]).toMatchObject({ id: "dup", kind: "lava", label: "First" });
      expect(plan.pickups).toHaveLength(1);
      expect(plan.pickups[0]).toMatchObject({ id: "p-dup", kind: "health", label: "First Pickup" });
      expect(plan.gates).toHaveLength(1);
      expect(plan.gates[0]).toMatchObject({ id: "g-dup", kind: "door", label: "First Gate" });
      expect(plan.mapObjects).toHaveLength(1);
      expect(plan.mapObjects[0]).toEqual({
        id: "m-dup",
        kind: "mine",
        x: 1,
        y: 2,
        angleDegrees: undefined,
        pairId: undefined
      });
    });

    it("allows valid edge-stage plans with capped legacy map objects", () => {
      const spawner = new StageContentSpawner();
      const stage = {
        ...baseStage,
        content: {
          hazards: [],
          pickups: [],
          gates: [],
          mapObjects: [
            ...Array.from({ length: 12 }, (_, index) => ({
              id: `mine-${index}`,
              kind: "mine",
              x: index,
              y: index
            })),
            ...Array.from({ length: 16 }, (_, index) => ({
              id: `barrel-${index}`,
              kind: "barrel",
              x: index,
              y: index
            }))
          ]
        }
      } as unknown as StageDefinitionWithContent;

      const plan = spawner.spawn(stage);

      expect(plan.mapObjects.filter((mapObject) => mapObject.kind === "mine")).toHaveLength(12);
      expect(plan.mapObjects.filter((mapObject) => mapObject.kind === "barrel")).toHaveLength(16);
    });

    it("clears the active plan and leaves no stale references on stage transition cleanup", () => {
      const spawner = new StageContentSpawner();
      spawner.spawn(stages[0]);
      expect(spawner.getActivePlan()).not.toBeNull();

      spawner.clear();

      expect(spawner.getActivePlan()).toBeNull();

      // After clear, spawning a fresh stage must not leak prior content.
      const next = spawner.spawn({
        ...baseStage,
        content: { hazards: [], pickups: [], gates: [], mapObjects: [] }
      } as unknown as StageDefinitionWithContent);

      expect(next.hazards).toEqual([]);
      expect(next.mapObjects).toEqual([]);
      expect(spawner.getActivePlan()).toBe(next);
    });
  });
});
