vi.mock("phaser", () => ({ default: {} }));

import { PlayerLogic } from "../src/domain/player/PlayerLogic";
import { createActorId } from "../src/domain/round/BattleRosterLogic";
import { HazardZoneLogic } from "../src/domain/map/HazardZoneLogic";
import type { SceneCombatActor } from "../src/scenes/combat-actor-port";
import type { SceneRuntimeState } from "../src/scenes/scene-runtime-state";
import { StageGeometryManager } from "../src/scenes/stage-geometry";

describe("StageGeometryManager roster hazards", () => {
  it("applies hazard damage to every overlapping roster actor and delegates aggregate life evaluation", () => {
    const player = createActor("player", "human", 20, 20);
    const primary = createActor("dummy", "cpu", 200, 200);
    const secondary = createActor("cpu-2", "cpu", 20, 20);
    const syncActorLife = vi.fn();
    const emitSoundCue = vi.fn();
    const state = {
      playerLogic: player.logic,
      dummyLogic: primary.logic,
      playerSprite: player.sprite,
      targetDummy: primary.sprite,
      hazardZone: {
        bounds: { x: 0, y: 0, width: 50, height: 50 },
        logic: new HazardZoneLogic(7, 900)
      }
    } as unknown as SceneRuntimeState;
    const manager = new StageGeometryManager(
      {} as never,
      state,
      { getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 5, width: 10, height: 10 }) } as never,
      { hitStunMs: 100 } as never,
      {
        getCombatAvailability: () => ({ isCombatLive: true, isPlayerDead: false, isDummyDead: false, isMatchOver: false, isPlayerStunned: false }),
        getCombatActors: () => [player, primary, secondary],
        syncActorLife,
        emitSoundCue
      } as never
    );

    manager.updateHazards(1_000);

    expect(player.logic.state.health).toBe(93);
    expect(primary.logic.state.health).toBe(100);
    expect(secondary.logic.state.health).toBe(93);
    expect(syncActorLife.mock.calls.map(([id]) => id)).toEqual(["player", "cpu-2"]);
    expect(emitSoundCue).toHaveBeenCalledTimes(2);
  });
});

function createActor(id: string, controller: "human" | "cpu", x: number, y: number): SceneCombatActor {
  const logic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
  const sprite = {
    x, y, rotation: 0, visible: true,
    setPosition: vi.fn(), setRotation: vi.fn(), setVisible: vi.fn(), destroy: vi.fn()
  };
  return {
    id: createActorId(id), team: controller === "human" ? "BLUE" : "RED", controller, logic,
    sprite, animatedSprite: null, weaponSprite: sprite, weaponSlots: [], activeWeaponIndex: 0,
    shouldFire: false, bodyAngle: 0, isCoverProtected: () => false, onHit: vi.fn(), destroy: vi.fn()
  };
}
