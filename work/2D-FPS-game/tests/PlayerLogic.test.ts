import { PlayerLogic } from "../src/domain/player/PlayerLogic";

describe("PlayerLogic", () => {
  it("moves at normalized speed across diagonal input", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 200,
      dashMultiplier: 1.5
    });

    player.move({ x: 1, y: 1, sprint: false }, 1);

    expect(player.state.positionX).toBeCloseTo(141.42, 1);
    expect(player.state.positionY).toBeCloseTo(141.42, 1);
  });

  it("applies sprint multiplier when sprint is active", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.move({ x: 0, y: -1, sprint: true }, 0.5);

    expect(player.state.positionY).toBe(-100);
    expect(player.state.isSprinting).toBe(true);
    expect(player.state.lastAppliedSpeed).toBe(200);
  });

  it("clamps health between zero and max health", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(140);

    expect(player.state.health).toBe(0);
    expect(player.isDead()).toBe(true);
  });

  it("applies stun timing when taking non-lethal damage", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(15, 300, 1000);

    expect(player.state.health).toBe(85);
    expect(player.isStunned(1100)).toBe(true);
    expect(player.isStunned(1300)).toBe(false);
  });

  it("stores aim angle based on a target point", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.updateAim(0, 10);

    expect(player.state.aimAngleRadians).toBeCloseTo(Math.PI / 2);
  });

  it("heals up to max health without exceeding the cap", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(35);

    expect(player.heal(20)).toBe(20);
    expect(player.state.health).toBe(85);
    expect(player.heal(50)).toBe(15);
    expect(player.state.health).toBe(100);
  });

  it("clears movement speed when there is no movement input", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.move({ x: 1, y: 0, sprint: false }, 0.5);
    player.move({ x: 0, y: 0, sprint: true }, 0.5);

    expect(player.state.lastAppliedSpeed).toBe(0);
    expect(player.state.isSprinting).toBe(false);
  });

  it("does not move after death", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(100);
    player.move({ x: 1, y: 0, sprint: true }, 1);

    expect(player.state.positionX).toBe(0);
    expect(player.state.lastAppliedSpeed).toBe(0);
    expect(player.state.isSprinting).toBe(false);
  });

  it("does not move while stunned", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(10, 400, 0);
    player.move({ x: 1, y: 0, sprint: true }, 1, 100);

    expect(player.state.positionX).toBe(0);
    expect(player.state.lastAppliedSpeed).toBe(0);
    expect(player.state.isSprinting).toBe(false);
  });

  it("does not update aim after death", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.updateAim(10, 0);
    const previousAngle = player.state.aimAngleRadians;
    player.takeDamage(100);
    player.updateAim(0, 10);

    expect(player.state.aimAngleRadians).toBe(previousAngle);
  });

  it("does not update aim while stunned", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.updateAim(10, 0, 0);
    const previousAngle = player.state.aimAngleRadians;
    player.takeDamage(10, 250, 50);
    player.updateAim(0, 10, 100);

    expect(player.state.aimAngleRadians).toBe(previousAngle);
  });

  it("does not heal after death", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.takeDamage(100);

    expect(player.heal(30)).toBe(0);
    expect(player.state.health).toBe(0);
  });

  it("resets health, position, and movement state", () => {
    const player = new PlayerLogic(100, {
      movementSpeed: 100,
      dashMultiplier: 2
    });

    player.move({ x: 1, y: 0, sprint: true }, 1);
    player.updateAim(10, 10);
    player.takeDamage(40);
    player.reset(5, -7);

    expect(player.state.health).toBe(100);
    expect(player.state.positionX).toBe(5);
    expect(player.state.positionY).toBe(-7);
    expect(player.state.lastAppliedSpeed).toBe(0);
    expect(player.state.isSprinting).toBe(false);
    expect(player.state.aimAngleRadians).toBe(0);
  });
});
