import {
  canApplyHazard,
  canDummyFire,
  canInterruptReload,
  canPlayerFire,
  canPlayerReload,
  canPlayerUseCombatInteraction,
  evaluateProjectileFrame,
  isGateInteractionAllowed
} from "../src/domain/combat/CombatRuntime";

describe("CombatRuntime", () => {
  const baseAvailability = {
    isCombatLive: true,
    isPlayerDead: false,
    isDummyDead: false,
    isMatchOver: false,
    isPlayerStunned: false
  } as const;

  it("allows player fire only when combat is live and the player can act", () => {
    expect(canPlayerFire(baseAvailability)).toBe(true);
    expect(canPlayerFire({ ...baseAvailability, isPlayerStunned: true })).toBe(false);
    expect(canPlayerFire({ ...baseAvailability, isDummyDead: true })).toBe(false);
  });

  it("allows reload and reload interrupt on the expected conditions", () => {
    expect(canPlayerReload(baseAvailability)).toBe(true);
    expect(canPlayerReload({ ...baseAvailability, isPlayerDead: true })).toBe(false);
    expect(canInterruptReload(baseAvailability)).toBe(true);
    expect(canInterruptReload({ ...baseAvailability, isCombatLive: false })).toBe(false);
  });

  it("uses shared combat gating for dummy fire, interactions, and hazards", () => {
    expect(canDummyFire(baseAvailability)).toBe(true);
    expect(canPlayerUseCombatInteraction(baseAvailability)).toBe(true);
    expect(canApplyHazard(baseAvailability)).toBe(true);
    expect(canDummyFire({ ...baseAvailability, isMatchOver: true })).toBe(false);
    expect(canPlayerUseCombatInteraction({ ...baseAvailability, isPlayerDead: true })).toBe(false);
    expect(canApplyHazard({ ...baseAvailability, isCombatLive: false })).toBe(false);
  });

  it("checks gate interaction distance", () => {
    expect(isGateInteractionAllowed(92, 92)).toBe(true);
    expect(isGateInteractionAllowed(93, 92)).toBe(false);
  });

  it("detects projectile hits against actors and obstacles", () => {
    const result = evaluateProjectileFrame({
      projectile: {
        x: 100,
        y: 100,
        width: 10,
        height: 4,
        velocityX: 60,
        velocityY: 0,
        owner: "player"
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540,
      obstacles: [{ x: 154, y: 96, width: 12, height: 12 }],
      playerBounds: null,
      dummyBounds: { x: 150, y: 95, width: 20, height: 20 }
    });

    expect(result.nextX).toBe(160);
    expect(result.hitObstacle).toBe(true);
    expect(result.hitDummy).toBe(true);
    expect(result.hitPlayer).toBe(false);
    expect(result.outOfBounds).toBe(false);
  });

  it("detects projectiles leaving the arena bounds", () => {
    const result = evaluateProjectileFrame({
      projectile: {
        x: 950,
        y: 530,
        width: 8,
        height: 8,
        velocityX: 20,
        velocityY: 20,
        owner: "dummy"
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540,
      obstacles: [],
      playerBounds: null,
      dummyBounds: null
    });

    expect(result.outOfBounds).toBe(true);
  });
});
