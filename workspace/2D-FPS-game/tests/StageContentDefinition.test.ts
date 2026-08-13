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
        mapObjects: stage.content.mapObjects.map(({ id, kind, x, y, angleDegrees, pairId }) => ({
          id,
          kind,
          x,
          y,
          angleDegrees,
          pairId
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
        mapObjects: [
          { id: "foundry-barrel-a", kind: "barrel", x: 430, y: 222, angleDegrees: undefined, pairId: undefined },
          { id: "foundry-barrel-b", kind: "barrel", x: 488, y: 224, angleDegrees: undefined, pairId: undefined },
          { id: "foundry-crate-a", kind: "crate", x: 612, y: 430, angleDegrees: undefined, pairId: undefined },
          { id: "foundry-cover-a", kind: "cover", x: 352, y: 118, angleDegrees: undefined, pairId: undefined },
          { id: "foundry-cover-b", kind: "cover", x: 592, y: 252, angleDegrees: undefined, pairId: undefined }
        ]
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
        mapObjects: [
          { id: "relay-barrel-a", kind: "barrel", x: 424, y: 196, angleDegrees: undefined, pairId: undefined },
          { id: "relay-barrel-b", kind: "barrel", x: 476, y: 196, angleDegrees: undefined, pairId: undefined },
          { id: "relay-barrel-c", kind: "barrel", x: 536, y: 340, angleDegrees: undefined, pairId: undefined },
          { id: "relay-barrel-d", kind: "barrel", x: 588, y: 340, angleDegrees: undefined, pairId: undefined },
          { id: "relay-mine-a", kind: "mine", x: 344, y: 268, angleDegrees: undefined, pairId: undefined },
          { id: "relay-mine-b", kind: "mine", x: 480, y: 270, angleDegrees: undefined, pairId: undefined },
          { id: "relay-mine-c", kind: "mine", x: 616, y: 268, angleDegrees: undefined, pairId: undefined },
          { id: "relay-crate-a", kind: "crate", x: 216, y: 178, angleDegrees: undefined, pairId: undefined },
          { id: "relay-crate-b", kind: "crate", x: 746, y: 360, angleDegrees: undefined, pairId: undefined },
          { id: "relay-cover-a", kind: "cover", x: 310, y: 204, angleDegrees: undefined, pairId: undefined },
          { id: "relay-cover-b", kind: "cover", x: 648, y: 204, angleDegrees: undefined, pairId: undefined },
          { id: "relay-cover-c", kind: "cover", x: 478, y: 336, angleDegrees: undefined, pairId: undefined },
          { id: "relay-bounce-wall-a", kind: "bounce-wall", x: 480, y: 238, angleDegrees: 0, pairId: undefined },
          { id: "relay-teleporter-a", kind: "teleporter", x: 220, y: 356, angleDegrees: undefined, pairId: "relay-alpha" },
          { id: "relay-teleporter-b", kind: "teleporter", x: 744, y: 184, angleDegrees: undefined, pairId: "relay-alpha" }
        ]
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
        mapObjects: [
          { id: "drain-barrel-a", kind: "barrel", x: 410, y: 226, angleDegrees: undefined, pairId: undefined },
          { id: "drain-barrel-b", kind: "barrel", x: 464, y: 226, angleDegrees: undefined, pairId: undefined },
          { id: "drain-barrel-c", kind: "barrel", x: 518, y: 226, angleDegrees: undefined, pairId: undefined },
          { id: "drain-barrel-d", kind: "barrel", x: 548, y: 316, angleDegrees: undefined, pairId: undefined },
          { id: "drain-barrel-e", kind: "barrel", x: 602, y: 316, angleDegrees: undefined, pairId: undefined },
          { id: "drain-barrel-f", kind: "barrel", x: 656, y: 316, angleDegrees: undefined, pairId: undefined },
          { id: "drain-mine-a", kind: "mine", x: 330, y: 270, angleDegrees: undefined, pairId: undefined },
          { id: "drain-mine-b", kind: "mine", x: 630, y: 270, angleDegrees: undefined, pairId: undefined },
          { id: "drain-crate-a", kind: "crate", x: 480, y: 444, angleDegrees: undefined, pairId: undefined },
          { id: "drain-cover-a", kind: "cover", x: 320, y: 214, angleDegrees: undefined, pairId: undefined },
          { id: "drain-cover-b", kind: "cover", x: 640, y: 326, angleDegrees: undefined, pairId: undefined },
          { id: "drain-bounce-wall-a", kind: "bounce-wall", x: 432, y: 110, angleDegrees: 20, pairId: undefined },
          { id: "drain-bounce-wall-b", kind: "bounce-wall", x: 530, y: 430, angleDegrees: -20, pairId: undefined }
        ]
      }
    ]);
  });

  it("normalizes new map object kinds with stage-specific fields", () => {
    const normalized = normalizeStageContentDefinition({
      mapObjects: [
        {
          id: "cover-alpha",
          kind: "cover",
          x: 10.8,
          y: 20.2
        },
        {
          id: "bounce-alpha",
          kind: "bounce-wall",
          x: 30.6,
          y: 40.4,
          angleDegrees: 44.9
        },
        {
          id: "teleporter-a",
          kind: "teleporter",
          x: 50.1,
          y: 60.9,
          pairId: " pair-a "
        },
        {
          id: "teleporter-b",
          kind: "teleporter",
          x: 70.5,
          y: 80.3,
          pairId: "pair-a"
        }
      ]
    });

    expect(normalized.mapObjects).toEqual([
      {
        id: "cover-alpha",
        kind: "cover",
        x: 10,
        y: 20,
        angleDegrees: undefined,
        pairId: undefined
      },
      {
        id: "bounce-alpha",
        kind: "bounce-wall",
        x: 30,
        y: 40,
        angleDegrees: 44,
        pairId: undefined
      },
      {
        id: "teleporter-a",
        kind: "teleporter",
        x: 50,
        y: 60,
        angleDegrees: undefined,
        pairId: "pair-a"
      },
      {
        id: "teleporter-b",
        kind: "teleporter",
        x: 70,
        y: 80,
        angleDegrees: undefined,
        pairId: "pair-a"
      }
    ]);
  });

  it("rejects cap overflow and invalid pair definitions", () => {
    expect(() =>
      normalizeStageContentDefinition({
        mapObjects: Array.from({ length: 21 }, (_, index) => ({
          id: `cover-${index}`,
          kind: "cover",
          x: index,
          y: index
        }))
      })
    ).toThrow("cover cap of 20");

    expect(() =>
      normalizeStageContentDefinition({
        mapObjects: [
          { id: "bounce-a", kind: "bounce-wall", x: 0, y: 0 },
          { id: "tele-a", kind: "teleporter", x: 10, y: 10, pairId: "solo" },
          { id: "tele-b", kind: "teleporter", x: 20, y: 20, pairId: "pair" },
          { id: "tele-c", kind: "teleporter", x: 30, y: 30, pairId: "pair" }
        ]
      })
    ).toThrow();
  });

  it("reports invalid stage content when required map object fields are missing", () => {
    expect(
      isStageContentDefinition({
        hazards: [],
        pickups: [],
        gates: [],
        mapObjects: [{ id: "bounce-a", kind: "bounce-wall", x: 0, y: 0 }]
      })
    ).toBe(false);

    expect(
      isStageContentDefinition({
        hazards: [],
        pickups: [],
        gates: [],
        mapObjects: [
          { id: "tele-a", kind: "teleporter", x: 0, y: 0, pairId: "pair-1" },
          { id: "tele-b", kind: "teleporter", x: 10, y: 10, pairId: "pair-2" }
        ]
      })
    ).toBe(false);
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
          y: 18,
          angleDegrees: undefined,
          pairId: undefined
        },
        {
          id: "barrel-alpha",
          kind: "barrel",
          x: 16,
          y: 29,
          angleDegrees: undefined,
          pairId: undefined
        },
        {
          id: "broken",
          kind: "crate",
          x: 0,
          y: 0,
          angleDegrees: undefined,
          pairId: undefined
        }
      ]
    });
  });

  it("marks valid capped content as a stage content definition", () => {
    expect(
      isStageContentDefinition(
        normalizeStageContentDefinition({
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
        })
      )
    ).toBe(true);
  });
});
