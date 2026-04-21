import gameBalance from "../assets/data/game-balance.json";
import {
  isStageContentDefinition,
  normalizeStageContentDefinition,
  type StageDefinitionWithContent
} from "../src/domain/map/StageContentDefinition";

const stages = gameBalance.stages as unknown as readonly StageDefinitionWithContent[];

describe("StageContentDefinition", () => {
  it("defines distinct schema-complete content for all three stages", () => {
    const normalizedStages = stages.map((stage) => ({
      ...stage,
      content: normalizeStageContentDefinition(stage.content)
    }));

    expect(stages).toHaveLength(3);
    expect(normalizedStages.every((stage) => isStageContentDefinition(stage.content))).toBe(true);

    expect(
      normalizedStages.map((stage) => ({
        hazards: stage.content.hazards.map(({ id, kind, x, y, width, height, damage, tickMs }) => ({
          id,
          kind,
          x,
          y,
          width,
          height,
          damage,
          tickMs
        })),
        pickups: stage.content.pickups.map(({ id, kind, x, y, amount, respawnMs }) => ({
          id,
          kind,
          x,
          y,
          amount,
          respawnMs
        })),
        gates: stage.content.gates.map(({ id, kind, x, y, width, height, locked, targetStageId }) => ({
          id,
          kind,
          x,
          y,
          width,
          height,
          locked,
          targetStageId
        })),
        mapObjects: stage.content.mapObjects.map(({ id, kind, x, y }) => ({
          id,
          kind,
          x,
          y
        }))
      }))
    ).toEqual([
      {
        hazards: [
          {
            id: "foundry-molten-core",
            kind: "lava",
            x: 510,
            y: 138,
            width: 170,
            height: 46,
            damage: 7,
            tickMs: 900
          },
          {
            id: "foundry-steam-line",
            kind: "steam",
            x: 292,
            y: 186,
            width: 68,
            height: 168,
            damage: 6,
            tickMs: 1200
          }
        ],
        pickups: [
          {
            id: "foundry-medkit",
            kind: "health",
            x: 870,
            y: 432,
            amount: 28,
            respawnMs: 6500
          },
          {
            id: "foundry-ammo-crate",
            kind: "ammo",
            x: 160,
            y: 430,
            amount: 8,
            respawnMs: 5000
          }
        ],
        gates: [
          {
            id: "foundry-core-gate",
            kind: "barrier",
            x: 482,
            y: 430,
            width: 96,
            height: 24,
            locked: true,
            targetStageId: "relay-yard"
          },
          {
            id: "foundry-service-door",
            kind: "door",
            x: 686,
            y: 344,
            width: 88,
            height: 40,
            locked: false,
            targetStageId: "storm-drain"
          }
        ],
        mapObjects: normalizedStages[0].content.mapObjects.map(({ id, kind, x, y }) => ({
          id,
          kind,
          x,
          y
        }))
      },
      {
        hazards: [
          {
            id: "relay-yard-arc-field",
            kind: "electric",
            x: 420,
            y: 146,
            width: 132,
            height: 46,
            damage: 9,
            tickMs: 780
          },
          {
            id: "relay-yard-coolant-spill",
            kind: "sludge",
            x: 468,
            y: 384,
            width: 178,
            height: 60,
            damage: 5,
            tickMs: 1180
          }
        ],
        pickups: [
          {
            id: "relay-yard-health-kit",
            kind: "health",
            x: 160,
            y: 118,
            amount: 26,
            respawnMs: 6200
          },
          {
            id: "relay-yard-boost-canister",
            kind: "boost",
            x: 726,
            y: 424,
            amount: 2,
            respawnMs: 7400
          }
        ],
        gates: [
          {
            id: "relay-yard-north-barrier",
            kind: "barrier",
            x: 480,
            y: 122,
            width: 112,
            height: 36,
            locked: true,
            targetStageId: "foundry"
          },
          {
            id: "relay-yard-south-switch",
            kind: "switch",
            x: 488,
            y: 410,
            width: 104,
            height: 34,
            locked: false,
            targetStageId: "storm-drain"
          }
        ],
        mapObjects: normalizedStages[1].content.mapObjects.map(({ id, kind, x, y }) => ({
          id,
          kind,
          x,
          y
        }))
      },
      {
        hazards: [
          {
            id: "storm-drain-sludge-trench",
            kind: "sludge",
            x: 390,
            y: 162,
            width: 138,
            height: 52,
            damage: 7,
            tickMs: 1000
          },
          {
            id: "storm-drain-pressure-vent",
            kind: "pressure",
            x: 576,
            y: 366,
            width: 138,
            height: 60,
            damage: 8,
            tickMs: 980
          }
        ],
        pickups: [
          {
            id: "storm-drain-ammo-cache",
            kind: "ammo",
            x: 162,
            y: 270,
            amount: 12,
            respawnMs: 5400
          },
          {
            id: "storm-drain-health-cache",
            kind: "health",
            x: 732,
            y: 438,
            amount: 30,
            respawnMs: 7000
          }
        ],
        gates: [
          {
            id: "storm-drain-pump-door",
            kind: "door",
            x: 480,
            y: 140,
            width: 108,
            height: 36,
            locked: true,
            targetStageId: "foundry"
          },
          {
            id: "storm-drain-access-barrier",
            kind: "barrier",
            x: 480,
            y: 410,
            width: 104,
            height: 34,
            locked: false,
            targetStageId: "relay-yard"
          }
        ],
        mapObjects: normalizedStages[2].content.mapObjects.map(({ id, kind, x, y }) => ({
          id,
          kind,
          x,
          y
        }))
      }
    ]);
  });

  it("normalizes malformed entries into stable stage content", () => {
    const normalized = normalizeStageContentDefinition({
      hazards: [
        {
          id: "steam-leak",
          kind: "steam",
          x: 12.8,
          y: 45.4,
          width: 31.9,
          height: 18.2,
          damage: 6.7,
          tickMs: 899.5,
          label: " Steam Leak "
        },
        {
          id: "steam-leak",
          kind: "steam",
          x: 99,
          y: 99,
          width: 99,
          height: 99,
          damage: 99,
          tickMs: 99
        },
        { id: "", kind: "steam", x: 1, y: 1, width: 1, height: 1, damage: 1, tickMs: 1 },
        null
      ],
      pickups: [
        {
          id: "ammo-cache",
          kind: "ammo",
          x: 51.2,
          y: 82.6,
          amount: 7.9,
          respawnMs: 5000.2,
          label: " Ammo Cache "
        },
        { id: "broken", kind: "unknown", x: 0, y: 0, amount: 1, respawnMs: 1 }
      ],
      gates: [
        {
          id: "north-gate",
          kind: "door",
          x: 300.9,
          y: 22.1,
          width: 61.7,
          height: 42.8,
          locked: true,
          targetStageId: "relay-yard",
          label: " North Gate "
        }
      ],
      mapObjects: [
        {
          id: "mine-alpha",
          kind: "mine",
          x: 71.9,
          y: 18.2
        },
        {
          id: "mine-alpha",
          kind: "mine",
          x: 99,
          y: 99
        },
        {
          id: "barrel-alpha",
          kind: "barrel",
          x: 16.4,
          y: 29.7
        },
        { id: "broken", kind: "crate", x: 0, y: 0 }
      ]
    });

    expect(normalized).toEqual({
      hazards: [
        {
          id: "steam-leak",
          kind: "steam",
          x: 12,
          y: 45,
          width: 31,
          height: 18,
          damage: 6,
          tickMs: 899,
          label: "Steam Leak"
        }
      ],
      pickups: [
        {
          id: "ammo-cache",
          kind: "ammo",
          x: 51,
          y: 82,
          amount: 7,
          respawnMs: 5000,
          label: "Ammo Cache"
        }
      ],
      gates: [
        {
          id: "north-gate",
          kind: "door",
          x: 300,
          y: 22,
          width: 61,
          height: 42,
          locked: true,
          label: "North Gate",
          targetStageId: "relay-yard"
        }
      ],
      mapObjects: [
        {
          id: "mine-alpha",
          kind: "mine",
          x: 71,
          y: 18
        },
        {
          id: "barrel-alpha",
          kind: "barrel",
          x: 16,
          y: 29
        },
        {
          id: "broken",
          kind: "crate",
          x: 0,
          y: 0
        }
      ]
    });
  });

  it("caps normalized map objects by kind", () => {
    const normalized = normalizeStageContentDefinition({
      mapObjects: [
        ...Array.from({ length: 13 }, (_, index) => ({
          id: `mine-${index}`,
          kind: "mine",
          x: index,
          y: index
        })),
        ...Array.from({ length: 17 }, (_, index) => ({
          id: `barrel-${index}`,
          kind: "barrel",
          x: index,
          y: index
        }))
      ]
    });

    expect(normalized.mapObjects.filter((mapObject) => mapObject.kind === "mine")).toHaveLength(12);
    expect(normalized.mapObjects.filter((mapObject) => mapObject.kind === "barrel")).toHaveLength(16);
    expect(isStageContentDefinition(normalized)).toBe(true);
    expect(
      isStageContentDefinition({
        hazards: [],
        pickups: [],
        gates: [],
        mapObjects: [
          ...normalized.mapObjects,
          {
            id: "extra-mine",
            kind: "mine",
            x: 0,
            y: 0
          }
        ]
      })
    ).toBe(false);
  });
});
