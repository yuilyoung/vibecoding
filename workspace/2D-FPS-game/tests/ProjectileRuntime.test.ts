import {
  advanceProjectile,
  castBeam,
  createProjectileRuntimeState,
  planAoeCall,
  stepProjectile,
  type ProjectileConfig
} from "../src/domain/combat/ProjectileRuntime";

describe("ProjectileRuntime", () => {
  const arenaBounds = { x: 0, y: 0, width: 960, height: 540 };

  it("advances linear projectiles without changing velocity", () => {
    const config: ProjectileConfig = { trajectory: "linear", speed: 100 };
    const projectile = createProjectileRuntimeState({
      x: 10,
      y: 20,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const result = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.5,
      obstacles: [],
      arenaBounds
    });

    expect(result.projectile.x).toBe(60);
    expect(result.projectile.y).toBe(20);
    expect(result.shouldExplode).toBe(false);
  });

  it("applies gravity and both wind axes to arc projectiles", () => {
    const config: ProjectileConfig = {
      trajectory: "arc",
      speed: 100,
      gravity: 300,
      windMultiplier: 0.5
    };
    const projectile = createProjectileRuntimeState({
      x: 0,
      y: 0,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const result = stepProjectile({
      projectile,
      config,
      deltaSeconds: 1,
      obstacles: [],
      arenaBounds,
      windX: 40,
      windY: -20,
      environmentWindMultiplier: 0.25
    });

    expect(result.projectile.velocityX).toBe(130);
    expect(result.projectile.velocityY).toBe(285);
    expect(result.projectile.x).toBe(130);
    expect(result.projectile.y).toBe(285);
  });

  it("applies wind to bounce projectiles before exploding on the final blocked step", () => {
    const config: ProjectileConfig = { trajectory: "bounce", speed: 100, bounceCount: 1, windMultiplier: 0.5 };
    const projectile = createProjectileRuntimeState({
      x: 40,
      y: 40,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const bounced = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.2,
      obstacles: [{ x: 56, y: 16, width: 10, height: 80 }],
      arenaBounds,
      windX: 20,
      windY: 30,
      environmentWindMultiplier: 0.25
    });

    expect(bounced.hitObstacle).toBe(true);
    expect(bounced.shouldExplode).toBe(false);
    expect(bounced.projectile.bouncesRemaining).toBe(0);
    expect(bounced.projectile.velocityX).toBe(-103);
    expect(bounced.projectile.velocityY).toBe(4.5);

    const finalHit = stepProjectile({
      projectile: {
        ...bounced.projectile,
        x: 40,
        y: 40,
        velocityX: 100
      },
      config,
      deltaSeconds: 0.2,
      obstacles: [{ x: 56, y: 16, width: 10, height: 80 }],
      arenaBounds
    });

    expect(finalHit.shouldExplode).toBe(true);
  });

  it("uses only environment wind for linear projectiles", () => {
    const config: ProjectileConfig = { trajectory: "linear", speed: 100, windMultiplier: 0.75 };
    const projectile = createProjectileRuntimeState({
      x: 10,
      y: 20,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const result = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.5,
      obstacles: [],
      arenaBounds,
      windX: 80,
      windY: -60,
      environmentWindMultiplier: 0.25
    });

    expect(result.projectile.velocityX).toBe(110);
    expect(result.projectile.velocityY).toBe(-7.5);
    expect(result.projectile.x).toBe(65);
    expect(result.projectile.y).toBe(16.25);
  });

  it("steers homing projectiles toward the nearest valid target with a turn clamp", () => {
    const config: ProjectileConfig = {
      trajectory: "homing",
      speed: 100,
      homingStrength: 1,
      homingMaxTurnRate: Math.PI / 2
    };
    const projectile = createProjectileRuntimeState({
      x: 100,
      y: 100,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const result = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.5,
      obstacles: [],
      arenaBounds,
      homingTargets: [
        { x: 80, y: 100, valid: false },
        { x: 100, y: 220 }
      ]
    });

    expect(result.projectile.velocityX).toBeCloseTo(70.710678);
    expect(result.projectile.velocityY).toBeCloseTo(70.710678);
  });

  it("uses only environment wind for homing projectiles", () => {
    const config: ProjectileConfig = {
      trajectory: "homing",
      speed: 100,
      homingStrength: 1,
      homingMaxTurnRate: Math.PI / 2,
      windMultiplier: 1
    };
    const projectile = createProjectileRuntimeState({
      x: 100,
      y: 100,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const result = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.5,
      obstacles: [],
      arenaBounds,
      target: { x: 100, y: 220 },
      windX: 999,
      windY: 999,
      environmentWindMultiplier: 0.1
    });

    expect(result.projectile.velocityX).toBeCloseTo(120.660678);
    expect(result.projectile.velocityY).toBeCloseTo(120.660678);
  });

  it("casts beams against the nearest target before farther obstacles", () => {
    const result = castBeam({
      originX: 0,
      originY: 100,
      angleRadians: 0,
      range: 500,
      obstacles: [{ x: 260, y: 80, width: 20, height: 40 }],
      targets: [{ id: "dummy", bounds: { x: 150, y: 80, width: 20, height: 40 } }]
    });

    expect(result.hitType).toBe("target");
    expect(result.targetId).toBe("dummy");
    expect(result.distance).toBe(150);
  });

  it("plans deterministic aoe-call impact timing and spread", () => {
    const impacts = planAoeCall({
      targetX: 400,
      targetY: 240,
      startAtMs: 1000,
      config: {
        trajectory: "aoe-call",
        speed: 0,
        aoeCount: 3,
        aoeIntervalMs: 120,
        aoeSpreadRadius: 30
      }
    });

    expect(impacts).toHaveLength(3);
    expect(impacts[0]).toEqual({ x: 400, y: 240, triggerAtMs: 1000 });
    expect(impacts[1].triggerAtMs).toBe(1120);
    expect(impacts[2].triggerAtMs).toBe(1240);
    expect(Math.hypot(impacts[1].x - 400, impacts[1].y - 240)).toBeCloseTo(30);
  });

  it("expires beam and aoe-call projectiles without wind side effects", () => {
    const beamResult = advanceProjectile({
      projectile: {
        x: 10,
        y: 20,
        width: 8,
        height: 8,
        velocityX: 100,
        velocityY: 5
      },
      config: {
        trajectory: "beam",
        speed: 100,
        windMultiplier: 1
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540,
      windX: 200,
      windY: 300
    });

    const aoeResult = advanceProjectile({
      projectile: {
        x: 30,
        y: 40,
        width: 8,
        height: 8,
        velocityX: 0,
        velocityY: 0
      },
      config: {
        trajectory: "aoe-call",
        speed: 0,
        windMultiplier: 1
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540,
      windX: 200,
      windY: 300
    });

    expect(beamResult).toEqual({
      projectile: {
        x: 10,
        y: 20,
        width: 8,
        height: 8,
        velocityX: 100,
        velocityY: 5
      },
      hitObstacle: false,
      bounced: false,
      expired: true
    });
    expect(aoeResult).toEqual({
      projectile: {
        x: 30,
        y: 40,
        width: 8,
        height: 8,
        velocityX: 0,
        velocityY: 0
      },
      hitObstacle: false,
      bounced: false,
      expired: true
    });
  });
});
