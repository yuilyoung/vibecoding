import { BattleRosterLogic } from "../src/domain/round/BattleRosterLogic";
import { WeaponLogic } from "../src/domain/combat/WeaponLogic";
import { getActorSkinDefinition } from "../src/domain/visual/ActorSkinCatalog";
import { CpuSquadController } from "../src/scenes/cpu-squad-controller";
import type { PlayerWeaponSlot } from "../src/scenes/scene-types";

describe("CpuSquadController", () => {
  it("creates no additional CPU for 1v1 and two for a requested 1v3", () => {
    const oneVsOne = createHarness();
    oneVsOne.controller.createAdditional(1, [{ x: 850, y: 270, label: "red" }]);
    expect(oneVsOne.controller.actors).toHaveLength(0);

    const oneVsThree = createHarness();
    oneVsThree.controller.createAdditional(3, [{ x: 850, y: 270, label: "red" }]);
    expect(oneVsThree.controller.actors).toHaveLength(2);
    expect(oneVsThree.controller.actors.map((actor) => actor.id)).toEqual(["cpu-2", "cpu-3"]);
  });

  it("owns independent health and weapon reload state for every additional CPU", () => {
    const harness = createHarness();
    harness.controller.createAdditional(3, [{ x: 850, y: 270, label: "red" }]);
    const [first, second] = harness.controller.actors;

    first.logic.takeDamage(25);
    first.weaponSlots[0].logic.tryFire(0);
    first.weaponSlots[0].logic.startReload(100);

    expect(first.logic).not.toBe(second.logic);
    expect(first.weaponSlots).not.toBe(second.weaponSlots);
    expect(first.weaponSlots[0].logic).not.toBe(second.weaponSlots[0].logic);
    expect(first.logic.state.health).toBe(75);
    expect(second.logic.state.health).toBe(100);
    expect(first.weaponSlots[0].logic.isReloading(200)).toBe(true);
    expect(second.weaponSlots[0].logic.isReloading(200)).toBe(false);
  });

  it("uses deterministic fallback offsets when a stage exposes one enemy spawn", () => {
    const harness = createHarness();
    harness.controller.createAdditional(3, [{ x: 850, y: 270, label: "red" }]);

    expect(harness.controller.actors.map((actor) => [actor.sprite.x, actor.sprite.y])).toEqual([
      [794, 214],
      [794, 326]
    ]);
  });

  it("resets every actor and weapon to deterministic spawns", () => {
    const harness = createHarness();
    harness.controller.createAdditional(3, [{ x: 850, y: 270, label: "red" }]);
    const first = harness.controller.actors[0];
    first.logic.takeDamage(80);
    first.weaponSlots[0].logic.tryFire(0);

    harness.controller.reset([{ x: 800, y: 200, label: "new-red" }]);

    expect(first.logic.state.health).toBe(100);
    expect(first.weaponSlots[0].logic.getAmmoInMagazine(1_000)).toBe(2);
    expect([first.sprite.x, first.sprite.y]).toEqual([744, 144]);
    expect(harness.roster.living("RED").map((actor) => actor.id)).toEqual(["cpu-2", "cpu-3"]);
  });

  it("synchronizes team identity in roster and actor presentation", () => {
    const harness = createHarness();
    harness.controller.createAdditional(2, [{ x: 850, y: 270, label: "red" }]);
    const actor = harness.controller.actors[0];

    harness.controller.setTeam("BLUE");

    expect(actor.team).toBe("BLUE");
    expect(harness.roster.all()[0]).toMatchObject({ team: "BLUE" });
    expect(actor.sprite.setTexture).toHaveBeenCalled();
  });

  it("destroys every owned view and removes roster entries exactly once", () => {
    const harness = createHarness();
    harness.controller.createAdditional(3, [{ x: 850, y: 270, label: "red" }]);
    const ownedViews = [...harness.views];

    harness.controller.destroy();
    harness.controller.destroy();

    expect(harness.controller.actors).toHaveLength(0);
    expect(harness.roster.all()).toHaveLength(0);
    for (const view of ownedViews) {
      expect(view.sprite.destroy).toHaveBeenCalledTimes(1);
      expect(view.weaponSprite.destroy).toHaveBeenCalledTimes(1);
      expect(view.animatedSprite?.destroy).toHaveBeenCalledTimes(1);
    }
  });
});

function createHarness() {
  const roster = new BattleRosterLogic();
  const views: ReturnType<typeof createView>[] = [];
  const controller = new CpuSquadController({} as never, {
    roster,
    team: "RED",
    gameBalance: {
      maxHealth: 100,
      dummyMovementSpeed: 90,
      dummyEngageRange: 220,
      dummyRetreatRange: 80,
      dummyShootRange: 320,
      dummyLowHealthThreshold: 25
    } as never,
    actorSkin: getActorSkinDefinition("legacy-vehicle"),
    collisionResolver: {} as never,
    createWeaponSlots,
    createView: (_actorId, _team, spawn) => {
      const view = createView(spawn.x, spawn.y);
      views.push(view);
      return view;
    },
    isCombatLive: () => true,
    isMatchOver: () => false,
    getWeatherMovementMultiplier: () => 1,
    getActorRotation: (angle) => angle,
    getActiveObstacles: () => []
  });
  return { controller, roster, views };
}

function createWeaponSlots(): PlayerWeaponSlot[] {
  return [{
    id: "carbine",
    label: "CPU Carbine",
    logic: new WeaponLogic({ fireRateMs: 10, bulletSpeed: 100, damage: 10, magazineSize: 2, reloadTimeMs: 500, reserveAmmo: 4 }),
    bulletColor: 0xff0000,
    bulletWidth: 4,
    bulletHeight: 2,
    pelletCount: 1,
    spreadRadians: 0,
    projectileConfig: { trajectory: "linear", speed: 100 },
    critChance: 0,
    critMultiplier: 1
  }];
}

function createView(x: number, y: number) {
  const createSprite = () => ({
    x,
    y,
    rotation: 0,
    visible: true,
    setPosition(nextX: number, nextY: number) { this.x = nextX; this.y = nextY; return this; },
    setRotation(next: number) { this.rotation = next; return this; },
    setVisible(next: boolean) { this.visible = next; return this; },
    setTexture: vi.fn(),
    play: vi.fn(),
    destroy: vi.fn()
  });
  return {
    sprite: createSprite(),
    animatedSprite: createSprite(),
    weaponSprite: createSprite()
  };
}
