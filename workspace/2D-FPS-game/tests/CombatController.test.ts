vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    },
    Input: {
      Keyboard: {
        JustDown: () => false
      }
    }
  }
}));

import type { ProjectileConfig } from "../src/domain/combat/ProjectileRuntime";
import { WeaponInventoryLogic } from "../src/domain/combat/WeaponInventoryLogic";
import { WeaponLogic } from "../src/domain/combat/WeaponLogic";
import { createMapObject } from "../src/domain/map/MapObjectLogic";
import { PlayerLogic } from "../src/domain/player/PlayerLogic";
import { BattleRosterLogic, createActorId } from "../src/domain/round/BattleRosterLogic";
import { flushPendingBulletClear, requestBulletClear } from "../src/scenes/combat-bullet-clear";
import type { SceneCombatActor } from "../src/scenes/combat-actor-port";
import { CombatController, type CombatControllerDeps } from "../src/scenes/combat-controller";
import type { SceneRuntimeState } from "../src/scenes/scene-runtime-state";
import type { BulletView } from "../src/scenes/scene-types";
import type { PlayerWeaponSlot } from "../src/scenes/scene-types";

function createBullet(id: string, destroy: ReturnType<typeof vi.fn>): BulletView {
  return {
    sprite: {
      name: id,
      destroy
    } as unknown as BulletView["sprite"],
    velocityX: 120,
    velocityY: 0,
    damage: 10,
    critChance: 0,
    critMultiplier: 1,
    owner: "player",
    ownerId: createActorId("player"),
    ownerTeam: "BLUE",
    effectProfile: "carbine",
    projectileConfig: { trajectory: "linear", speed: 120 } satisfies ProjectileConfig,
    bouncesRemaining: 0
  };
}

function createControllerHarness() {
  const destroyA = vi.fn();
  const destroyB = vi.fn();
  const clearCombatFx = vi.fn();
  const bullets = [createBullet("a", destroyA), createBullet("b", destroyB)];
  const state = {
    bullets,
    pendingBulletClear: false
  } as unknown as SceneRuntimeState;
  return {
    state,
    bullets,
    destroyA,
    destroyB,
    clearCombatFx
  };
}

describe("CombatController hotfix", () => {
  it("defers bullet destruction until the flush boundary", () => {
    const harness = createControllerHarness();

    requestBulletClear(harness.state);

    expect(harness.state.pendingBulletClear).toBe(true);
    expect(harness.bullets).toHaveLength(2);
    expect(harness.destroyA).not.toHaveBeenCalled();
    expect(harness.destroyB).not.toHaveBeenCalled();
    expect(harness.clearCombatFx).not.toHaveBeenCalled();

    flushPendingBulletClear(harness.state, harness.clearCombatFx);

    expect(harness.state.pendingBulletClear).toBe(false);
    expect(harness.bullets).toHaveLength(0);
    expect(harness.destroyA).toHaveBeenCalledTimes(1);
    expect(harness.destroyB).toHaveBeenCalledTimes(1);
    expect(harness.clearCombatFx).toHaveBeenCalledTimes(1);
  });

  it("tolerates a pending clear while the shared bullet array is being read", () => {
    const harness = createControllerHarness();

    const visitedNames: string[] = [];
    for (let index = harness.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = harness.bullets[index];

      if (index === 1) {
        requestBulletClear(harness.state);
      }

      if (bullet !== undefined) {
        visitedNames.push((bullet.sprite as { name: string }).name);
      }
    }

    expect(visitedNames).toEqual(["b", "a"]);
    expect(harness.bullets).toHaveLength(2);
    expect(harness.state.pendingBulletClear).toBe(true);

    flushPendingBulletClear(harness.state, harness.clearCombatFx);

    expect(harness.bullets).toHaveLength(0);
    expect(harness.clearCombatFx).toHaveBeenCalledTimes(1);
  });

  it("does not damage an actor behind an obstacle crossed in the same frame", () => {
    const destroy = vi.fn();
    const playerLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const dummyLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const player = createActor("player", "BLUE", playerLogic, 0, 50);
    const dummy = createActor("dummy", "RED", dummyLogic, 100, 50);
    const roster = new BattleRosterLogic();
    roster.add({ id: player.id, team: player.team, controller: player.controller });
    roster.add({ id: dummy.id, team: dummy.team, controller: dummy.controller });
    const bullet = createBullet("swept", destroy);
    Object.assign(bullet.sprite, { x: 0, y: 50, width: 4, height: 4 });
    bullet.velocityX = 100;
    const state = {
      playerLogic,
      dummyLogic,
      playerSprite: player.sprite,
      targetDummy: dummy.sprite,
      bullets: [bullet],
      currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: { type: "clear", movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false },
      currentPlayerTeam: "BLUE",
      currentDummyTeam: "RED",
      lastCombatEvent: "READY",
      pendingBulletClear: false
    } as unknown as SceneRuntimeState;
    const collisionResolver = {
      getActiveObstacles: () => [{ bounds: { x: 40, y: 0, width: 10, height: 100 } }],
      getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 10, width: 10, height: 20 })
    };
    const vfx = {
      spawnImpactEffect: vi.fn(),
      spawnShotTrail: vi.fn()
    };
    const deps = {
      gameBalance: { wind: { forceScale: 1 }, hitStunMs: 0 },
      getCombatActors: () => [player, dummy],
      battleRoster: roster,
      hasDummyCoverProtection: () => false,
      recordDummyHit: vi.fn(),
      recordPlayerHit: vi.fn(),
      spawnDamageNumber: vi.fn(),
      playDummyHitFeedback: vi.fn(),
      playPlayerHitFeedback: vi.fn(),
      getMapObjectCollisionRects: () => [],
      damageMapObject: () => null,
      setMapObjectState: () => null,
      emitSoundCue: vi.fn(),
      registerPlayerRoundWin: vi.fn(),
      registerDummyRoundWin: vi.fn(),
      scheduleResetAfterRound: vi.fn(),
      isMatchOver: () => false
    } as unknown as CombatControllerDeps;
    const controller = new CombatController(
      { time: { now: 1_000 } } as never,
      state,
      vfx as never,
      collisionResolver as never,
      deps
    );

    controller.updateProjectiles(1, 1_000);

    expect(dummyLogic.state.health).toBe(100);
    expect(deps.recordDummyHit).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(state.bullets).toHaveLength(0);
  });

  it("hits an actor before a later wall even when a bounce projectile would overlap the wall this frame", () => {
    const playerLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const dummyLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const player = createActor("player", "BLUE", playerLogic, 0, 50);
    const dummy = createActor("dummy", "RED", dummyLogic, 25, 50);
    const roster = new BattleRosterLogic();
    roster.add({ id: player.id, team: player.team, controller: player.controller });
    roster.add({ id: dummy.id, team: dummy.team, controller: dummy.controller });
    const bullet = createBullet("bounce-before-wall", vi.fn());
    Object.assign(bullet.sprite, { x: 0, y: 50, width: 4, height: 4 });
    bullet.velocityX = 45;
    bullet.projectileConfig = { trajectory: "bounce", speed: 45, bounceCount: 1 };
    bullet.bouncesRemaining = 1;
    const state = {
      playerLogic, dummyLogic, playerSprite: player.sprite, targetDummy: dummy.sprite,
      bullets: [bullet], currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: { type: "clear", movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false },
      currentPlayerTeam: "BLUE", currentDummyTeam: "RED", lastCombatEvent: "READY", pendingBulletClear: false
    } as unknown as SceneRuntimeState;
    const deps = createProjectileDeps([player, dummy], roster);
    const controller = new CombatController(
      { time: { now: 1_000 } } as never,
      state,
      { spawnImpactEffect: vi.fn(), spawnShotTrail: vi.fn() } as never,
      {
        getActiveObstacles: () => [{ bounds: { x: 40, y: 0, width: 10, height: 100 } }],
        getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 10, width: 10, height: 20 })
      } as never,
      deps
    );

    controller.updateProjectiles(1, 1_000);

    expect(dummyLogic.state.health).toBe(90);
    expect(state.bullets).toHaveLength(0);
  });

  it("reflects a fast bounce projectile at the first swept wall contact", () => {
    const playerLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const dummyLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const player = createActor("player", "BLUE", playerLogic, 0, 50);
    const dummy = createActor("dummy", "RED", dummyLogic, 100, 50);
    const roster = new BattleRosterLogic();
    roster.add({ id: player.id, team: player.team, controller: player.controller });
    roster.add({ id: dummy.id, team: dummy.team, controller: dummy.controller });
    const bullet = createBullet("fast-bounce", vi.fn());
    Object.assign(bullet.sprite, { x: 0, y: 50, width: 4, height: 4 });
    bullet.velocityX = 80;
    bullet.projectileConfig = { trajectory: "bounce", speed: 80, bounceCount: 1 };
    bullet.bouncesRemaining = 1;
    const state = {
      playerLogic, dummyLogic, playerSprite: player.sprite, targetDummy: dummy.sprite,
      bullets: [bullet], currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: { type: "clear", movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false },
      currentPlayerTeam: "BLUE", currentDummyTeam: "RED", lastCombatEvent: "READY", pendingBulletClear: false
    } as unknown as SceneRuntimeState;
    const controller = new CombatController(
      { time: { now: 1_000 } } as never,
      state,
      { spawnImpactEffect: vi.fn(), spawnShotTrail: vi.fn() } as never,
      {
        getActiveObstacles: () => [{ bounds: { x: 40, y: 0, width: 10, height: 100 } }],
        getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 10, width: 10, height: 20 })
      } as never,
      createProjectileDeps([player, dummy], roster)
    );

    controller.updateProjectiles(1, 1_000);

    expect(state.bullets).toHaveLength(1);
    expect(bullet.sprite.x).toBeCloseTo(38);
    expect(bullet.velocityX).toBe(-80);
    expect(bullet.bouncesRemaining).toBe(0);

    controller.updateProjectiles(0.1, 1_100);

    expect(state.bullets).toHaveLength(1);
    expect(bullet.sprite.x).toBeLessThan(38);
  });

  it("separates a projectile from a map bounce-wall so it keeps moving away next frame", () => {
    const playerLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const dummyLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const player = createActor("player", "BLUE", playerLogic, 0, 50);
    const dummy = createActor("dummy", "RED", dummyLogic, 100, 50);
    const roster = new BattleRosterLogic();
    roster.add({ id: player.id, team: player.team, controller: player.controller });
    roster.add({ id: dummy.id, team: dummy.team, controller: dummy.controller });
    const bullet = createBullet("map-wall-reflection", vi.fn());
    Object.assign(bullet.sprite, { x: 0, y: 50, width: 4, height: 4 });
    bullet.velocityX = 80;
    const wall = createMapObject({
      id: "wall-1", kind: "bounce-wall", x: 45, y: 50, angleDegrees: 90, reflectionsRemaining: 2
    });
    const state = {
      playerLogic, dummyLogic, playerSprite: player.sprite, targetDummy: dummy.sprite,
      bullets: [bullet], currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: { type: "clear", movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false },
      currentPlayerTeam: "BLUE", currentDummyTeam: "RED", lastCombatEvent: "READY", pendingBulletClear: false
    } as unknown as SceneRuntimeState;
    const controller = new CombatController(
      { time: { now: 1_000 } } as never,
      state,
      { spawnImpactEffect: vi.fn(), spawnShotTrail: vi.fn() } as never,
      {
        getActiveObstacles: () => [],
        getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 10, width: 10, height: 20 })
      } as never,
      {
        ...createProjectileDeps([player, dummy], roster),
        getMapObjectCollisionRects: () => [{ id: wall.id, kind: wall.kind, rect: { x: 40, y: 0, width: 10, height: 100 }, state: wall }],
        setMapObjectState: vi.fn((_id, nextState) => nextState)
      }
    );

    controller.updateProjectiles(1, 1_000);
    expect(state.bullets).toHaveLength(1);
    expect(bullet.velocityX).toBe(-80);

    controller.updateProjectiles(0.1, 1_100);

    expect(state.bullets).toHaveLength(1);
    expect(bullet.sprite.x).toBeLessThan(38);
  });

  it("cancels the outgoing weapon reload through the controller switch path", () => {
    const firstLogic = createTestWeaponLogic();
    const secondLogic = createTestWeaponLogic();
    const slots = [createTestWeaponSlot("first", firstLogic), createTestWeaponSlot("second", secondLogic)];
    const inventory = new WeaponInventoryLogic(slots);
    firstLogic.tryFire(0);
    firstLogic.startReload(20);
    const state = { lastActiveWeaponReloading: true, lastCombatEvent: "RELOADING" } as unknown as SceneRuntimeState;
    const emitSoundCue = vi.fn();
    const controller = new CombatController(
      { time: { now: 100 } } as never,
      state,
      {} as never,
      {} as never,
      {
        weaponSlots: slots,
        weaponInventory: inventory,
        dummyWeaponSlots: [],
        isWeaponAvailable: () => true,
        emitSoundCue
      } as unknown as CombatControllerDeps
    );

    controller.tryEquipSlot(1, "EQUIPPED", 100);
    controller.updateWeaponTicks(600);

    expect(inventory.getActiveIndex()).toBe(1);
    expect(firstLogic.isReloading(100)).toBe(false);
    expect(firstLogic.getAmmoInMagazine(600)).toBe(1);
    expect(state.lastActiveWeaponReloading).toBe(false);
    expect(emitSoundCue).toHaveBeenCalledWith({ kind: "weapon-state", action: "swap" });
  });

  it("damages secondary CPU actors and awards the round only after the whole opposing team is eliminated", () => {
    const playerLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const primaryLogic = new PlayerLogic(100, { movementSpeed: 100, dashMultiplier: 1 });
    const secondaryLogic = new PlayerLogic(10, { movementSpeed: 100, dashMultiplier: 1 });
    const player = createActor("player", "BLUE", playerLogic, 0, 50);
    const primary = createActor("dummy", "RED", primaryLogic, 180, 50);
    const secondary = createActor("cpu-2", "RED", secondaryLogic, 100, 50);
    const actors = [player, primary, secondary];
    const roster = new BattleRosterLogic();
    actors.forEach((actor) => roster.add({ id: actor.id, team: actor.team, controller: actor.controller }));
    const registerPlayerRoundWin = vi.fn();
    const scheduleResetAfterRound = vi.fn();
    const bullets: BulletView[] = [];
    const state = {
      playerLogic,
      dummyLogic: primaryLogic,
      playerSprite: player.sprite,
      targetDummy: primary.sprite,
      bullets,
      currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: { type: "clear", movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false },
      currentPlayerTeam: "BLUE",
      currentDummyTeam: "RED",
      lastCombatEvent: "READY",
      pendingBulletClear: false
    } as unknown as SceneRuntimeState;
    const controller = new CombatController(
      { time: { now: 1_000 }, tweens: { add: vi.fn() } } as never,
      state,
      { spawnImpactEffect: vi.fn(), spawnShotTrail: vi.fn() } as never,
      {
        getActiveObstacles: () => [],
        getActorCollisionBounds: (x: number, y: number) => ({ x: x - 5, y: y - 10, width: 10, height: 20 })
      } as never,
      {
        gameBalance: { wind: { forceScale: 1 }, hitStunMs: 0 },
        getCombatActors: () => actors,
        battleRoster: roster,
        hasDummyCoverProtection: () => false,
        recordDummyHit: vi.fn(), recordPlayerHit: vi.fn(), spawnDamageNumber: vi.fn(),
        playDummyHitFeedback: vi.fn(), playPlayerHitFeedback: vi.fn(),
        getMapObjectCollisionRects: () => [], damageMapObject: () => null, setMapObjectState: () => null,
        emitSoundCue: vi.fn(), triggerCameraFeedback: vi.fn(), registerPlayerRoundWin,
        registerDummyRoundWin: vi.fn(), scheduleResetAfterRound, isMatchOver: () => false
      } as unknown as CombatControllerDeps
    );

    bullets.push(createTravelingBullet(secondary.sprite.x, 10));
    controller.updateProjectiles(1, 1_000);

    expect(secondaryLogic.isDead()).toBe(true);
    expect(roster.living("RED").map((actor) => actor.id)).toEqual(["dummy"]);
    expect(registerPlayerRoundWin).not.toHaveBeenCalled();

    bullets.push(createTravelingBullet(primary.sprite.x, 100));
    controller.updateProjectiles(1, 1_001);

    expect(primaryLogic.isDead()).toBe(true);
    expect(roster.living("RED")).toEqual([]);
    expect(registerPlayerRoundWin).toHaveBeenCalledTimes(1);
    expect(scheduleResetAfterRound).toHaveBeenCalledTimes(1);
  });
});

function createActor(
  id: string,
  team: "BLUE" | "RED",
  logic: PlayerLogic,
  x: number,
  y: number
): SceneCombatActor {
  const sprite = {
    x, y, rotation: 0, visible: true,
    setPosition(nextX: number, nextY: number) { this.x = nextX; this.y = nextY; return this; },
    setRotation(next: number) { this.rotation = next; return this; },
    setVisible(next: boolean) { this.visible = next; return this; },
    destroy: vi.fn()
  };
  return {
    id: createActorId(id), team, controller: id === "player" ? "human" : "cpu", logic,
    sprite, animatedSprite: null, weaponSprite: sprite, weaponSlots: [], activeWeaponIndex: 0,
    shouldFire: false, bodyAngle: 0, isCoverProtected: () => false, onHit: vi.fn(), destroy: vi.fn()
  };
}

function createTravelingBullet(targetX: number, damage: number): BulletView {
  const bullet = createBullet("team-shot", vi.fn());
  Object.assign(bullet.sprite, { x: 0, y: 50, width: 4, height: 4 });
  bullet.velocityX = targetX;
  bullet.damage = damage;
  return bullet;
}

function createProjectileDeps(actors: readonly SceneCombatActor[], roster: BattleRosterLogic): CombatControllerDeps {
  return {
    gameBalance: { wind: { forceScale: 1 }, hitStunMs: 0 },
    getCombatActors: () => actors,
    battleRoster: roster,
    hasDummyCoverProtection: () => false,
    recordDummyHit: vi.fn(), recordPlayerHit: vi.fn(), spawnDamageNumber: vi.fn(),
    playDummyHitFeedback: vi.fn(), playPlayerHitFeedback: vi.fn(),
    getMapObjectCollisionRects: () => [], damageMapObject: () => null, setMapObjectState: () => null,
    emitSoundCue: vi.fn(), triggerCameraFeedback: vi.fn(), registerPlayerRoundWin: vi.fn(),
    registerDummyRoundWin: vi.fn(), scheduleResetAfterRound: vi.fn(), isMatchOver: () => false
  } as unknown as CombatControllerDeps;
}

function createTestWeaponLogic(): WeaponLogic {
  return new WeaponLogic({
    fireRateMs: 10,
    bulletSpeed: 100,
    damage: 10,
    magazineSize: 2,
    reloadTimeMs: 500,
    reserveAmmo: 4
  });
}

function createTestWeaponSlot(id: string, logic: WeaponLogic): PlayerWeaponSlot {
  return {
    id, label: id, logic, bulletColor: 0xffffff, bulletWidth: 4, bulletHeight: 4,
    pelletCount: 1, spreadRadians: 0, projectileConfig: { trajectory: "linear", speed: 100 },
    critChance: 0, critMultiplier: 1
  };
}
