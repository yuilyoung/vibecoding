import gameBalance from "../assets/data/game-balance.json";
import {
  isStageContentDefinition,
  normalizeStageContentDefinition,
  type StageDefinitionWithContent
} from "../src/domain/map/StageContentDefinition";

const stages = gameBalance.stages as readonly StageDefinitionWithContent[];

describe("StageContentDefinition", () => {
  it("defines distinct schema-complete content for all three stages", () => {
    expect(stages).toHaveLength(3);
    expect(stages.every((stage) => isStageContentDefinition(stage.content))).toBe(true);

    expect(stages.map((stage) => stage.content.hazards.map((hazard) => hazard.id))).toEqual([
      ["foundry-molten-core", "foundry-steam-line"],
      ["relay-yard-arc-field", "relay-yard-coolant-spill"],
      ["storm-drain-sludge-trench", "storm-drain-pressure-vent"]
    ]);

    expect(stages.map((stage) => stage.content.pickups.map((pickup) => pickup.id))).toEqual([
      ["foundry-medkit", "foundry-ammo-crate"],
      ["relay-yard-health-kit", "relay-yard-boost-canister"],
      ["storm-drain-ammo-cache", "storm-drain-health-cache"]
    ]);

    expect(stages.map((stage) => stage.content.gates.map((gate) => gate.id))).toEqual([
      ["foundry-core-gate", "foundry-service-door"],
      ["relay-yard-north-barrier", "relay-yard-south-switch"],
      ["storm-drain-pump-door", "storm-drain-access-barrier"]
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
      ]
    });
  });
});
