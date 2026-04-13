import { advanceProjectile } from "../src/domain/combat/ProjectileRuntime";

describe("ProjectileRuntime", () => {
  it("advances linear projectiles with unchanged velocity", () => {
    const result = advanceProjectile({
      projectile: {
        x: 100,
        y: 120,
        width: 8,
        height: 8,
        velocityX: 200,
        velocityY: 0
      },
      config: {
        trajectory: "linear",
        speed: 200
      },
      deltaSeconds: 0.5,
      arenaWidth: 960,
      arenaHeight: 540
    });

    expect(result.projectile.x).toBe(200);
    expect(result.projectile.y).toBe(120);
    expect(result.projectile.velocityX).toBe(200);
    expect(result.expired).toBe(false);
  });

  it("applies gravity and wind to arc projectiles", () => {
    const result = advanceProjectile({
      projectile: {
        x: 100,
        y: 100,
        width: 8,
        height: 8,
        velocityX: 100,
        velocityY: -120
      },
      config: {
        trajectory: "arc",
        speed: 100,
        gravity: 300,
        windMultiplier: 0.5
      },
      deltaSeconds: 0.2,
      arenaWidth: 960,
      arenaHeight: 540,
      windX: 40
    });

    expect(result.projectile.velocityX).toBe(104);
    expect(result.projectile.velocityY).toBe(-60);
    expect(result.projectile.x).toBeCloseTo(120.8);
    expect(result.projectile.y).toBe(88);
  });

  it("spends a bounce and reflects velocity when a bounce projectile hits the arena edge", () => {
    const result = advanceProjectile({
      projectile: {
        x: 950,
        y: 200,
        width: 8,
        height: 8,
        velocityX: 80,
        velocityY: 0
      },
      config: {
        trajectory: "bounce",
        speed: 80,
        bounceCount: 2
      },
      deltaSeconds: 0.2,
      arenaWidth: 960,
      arenaHeight: 540
    });

    expect(result.bounced).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.projectile.x).toBe(960);
    expect(result.projectile.velocityX).toBe(-80);
    expect(result.projectile.bouncesRemaining).toBe(1);
  });

  it("expires a bounce projectile when no bounces remain", () => {
    const result = advanceProjectile({
      projectile: {
        x: 950,
        y: 200,
        width: 8,
        height: 8,
        velocityX: 80,
        velocityY: 0,
        bouncesRemaining: 0
      },
      config: {
        trajectory: "bounce",
        speed: 80,
        bounceCount: 2
      },
      deltaSeconds: 0.2,
      arenaWidth: 960,
      arenaHeight: 540
    });

    expect(result.bounced).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("steers homing projectiles toward the target", () => {
    const result = advanceProjectile({
      projectile: {
        x: 100,
        y: 100,
        width: 8,
        height: 8,
        velocityX: 100,
        velocityY: 0
      },
      config: {
        trajectory: "homing",
        speed: 100,
        homingStrength: 0.5
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540,
      target: {
        x: 100,
        y: 300
      }
    });

    expect(result.projectile.velocityX).toBeCloseTo(70.71, 1);
    expect(result.projectile.velocityY).toBeCloseTo(70.71, 1);
  });

  it("marks beam and aoe-call projectiles as immediate effects", () => {
    const result = advanceProjectile({
      projectile: {
        x: 100,
        y: 100,
        width: 1,
        height: 1,
        velocityX: 0,
        velocityY: 0
      },
      config: {
        trajectory: "beam",
        speed: 0
      },
      deltaSeconds: 1,
      arenaWidth: 960,
      arenaHeight: 540
    });

    expect(result.expired).toBe(true);
    expect(result.projectile.x).toBe(100);
  });
});
