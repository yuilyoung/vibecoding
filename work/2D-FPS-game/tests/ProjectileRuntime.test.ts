import {
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

  it("applies gravity and wind to arc projectiles", () => {
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
      windX: 40
    });

    expect(result.projectile.velocityX).toBe(120);
    expect(result.projectile.velocityY).toBe(300);
    expect(result.projectile.x).toBe(120);
    expect(result.projectile.y).toBe(300);
  });

  it("reflects bounce projectiles before exploding on the final blocked step", () => {
    const config: ProjectileConfig = { trajectory: "bounce", speed: 100, bounceCount: 1 };
    const projectile = createProjectileRuntimeState({
      x: 40,
      y: 100,
      angleRadians: 0,
      width: 8,
      height: 8,
      config
    });

    const bounced = stepProjectile({
      projectile,
      config,
      deltaSeconds: 0.2,
      obstacles: [{ x: 56, y: 80, width: 10, height: 40 }],
      arenaBounds
    });

    expect(bounced.hitObstacle).toBe(true);
    expect(bounced.shouldExplode).toBe(false);
    expect(bounced.projectile.bouncesRemaining).toBe(0);
    expect(bounced.projectile.velocityX).toBe(-100);

    const finalHit = stepProjectile({
      projectile: {
        ...bounced.projectile,
        x: 40,
        y: 100,
        velocityX: 100
      },
      config,
      deltaSeconds: 0.2,
      obstacles: [{ x: 56, y: 80, width: 10, height: 40 }],
      arenaBounds
    });

    expect(finalHit.shouldExplode).toBe(true);
  });

  it("steers homing projectiles toward a target", () => {
    const config: ProjectileConfig = {
      trajectory: "homing",
      speed: 100,
      homingStrength: 1
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
      target: { x: 100, y: 220 }
    });

    expect(result.projectile.velocityX).toBeCloseTo(50);
    expect(result.projectile.velocityY).toBeCloseTo(50);
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
});
