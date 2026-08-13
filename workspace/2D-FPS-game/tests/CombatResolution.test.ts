import { resolveBulletCollision, resolveDamage, resolveHazardOutcome } from "../src/domain/combat/CombatResolution";

describe("CombatResolution", () => {
  it("resolves critical damage when rng rolls below crit chance", () => {
    const result = resolveDamage(10, 0.25, 2, () => 0.24);

    expect(result).toEqual({
      damage: 20,
      isCritical: true
    });
  });

  it("resolves non-critical damage when rng rolls above crit chance", () => {
    const result = resolveDamage(10, 0.25, 2, () => 0.26);

    expect(result).toEqual({
      damage: 10,
      isCritical: false
    });
  });

  it("treats rng equal to crit chance as non-critical", () => {
    const result = resolveDamage(10, 0.25, 2, () => 0.25);

    expect(result).toEqual({
      damage: 10,
      isCritical: false
    });
  });

  it("applies the configured critical multiplier to base damage", () => {
    const result = resolveDamage(18, 0.5, 1.75, () => 0.1);

    expect(result).toEqual({
      damage: 31.5,
      isCritical: true
    });
  });

  it("resolves a player bullet hit on the dummy", () => {
    const result = resolveBulletCollision({
      owner: "player",
      hitDummy: true,
      hitPlayer: false,
      hitObstacle: false,
      outOfBounds: false,
      damage: 14,
      appliedDamage: 14,
      targetDied: false
    });

    expect(result.destroyBullet).toBe(true);
    expect(result.damagedActor).toBe("dummy");
    expect(result.combatEvent).toBe("HIT 14");
    expect(result.soundTarget).toBe("dummy");
    expect(result.roundWinner).toBeNull();
  });

  it("resolves a killing dummy bullet hit on the player", () => {
    const result = resolveBulletCollision({
      owner: "dummy",
      hitDummy: false,
      hitPlayer: true,
      hitObstacle: false,
      outOfBounds: false,
      damage: 12,
      appliedDamage: 12,
      targetDied: true
    });

    expect(result.destroyBullet).toBe(true);
    expect(result.damagedActor).toBe("player");
    expect(result.combatEvent).toBe("PLAYER DOWN");
    expect(result.soundTarget).toBe("player");
    expect(result.roundWinner).toBe("DUMMY");
  });

  it("prefers obstacle collision events over simple out-of-bounds cleanup", () => {
    const result = resolveBulletCollision({
      owner: "player",
      hitDummy: false,
      hitPlayer: false,
      hitObstacle: true,
      outOfBounds: true,
      damage: 10,
      appliedDamage: 10,
      targetDied: false
    });

    expect(result.destroyBullet).toBe(true);
    expect(result.combatEvent).toBe("SHOT BLOCKED");
    expect(result.roundWinner).toBeNull();
  });

  it("returns cleanup-only for out-of-bounds bullets", () => {
    const result = resolveBulletCollision({
      owner: "player",
      hitDummy: false,
      hitPlayer: false,
      hitObstacle: false,
      outOfBounds: true,
      damage: 10,
      appliedDamage: 10,
      targetDied: false
    });

    expect(result.destroyBullet).toBe(true);
    expect(result.combatEvent).toBeNull();
    expect(result.soundTarget).toBeNull();
  });

  it("resolves hazard damage without a kill", () => {
    const result = resolveHazardOutcome({
      actorId: "player",
      triggered: true,
      damage: 6,
      actorDied: false
    });

    expect(result.combatEvent).toBe("PLAYER HAZARD -6");
    expect(result.roundWinner).toBeNull();
  });

  it("assigns the opposite winner when hazard damage kills an actor", () => {
    const result = resolveHazardOutcome({
      actorId: "dummy",
      triggered: true,
      damage: 8,
      actorDied: true
    });

    expect(result.combatEvent).toBe("DUMMY HAZARD -8");
    expect(result.roundWinner).toBe("PLAYER");
  });

  it("reports shield ricochet when the dummy blocks a hit in shield cover", () => {
    const result = resolveBulletCollision({
      owner: "player",
      hitDummy: true,
      hitPlayer: false,
      hitObstacle: false,
      outOfBounds: false,
      damage: 14,
      appliedDamage: 0,
      targetDied: false,
      coverProtected: true
    });

    expect(result.combatEvent).toBe("SHIELD RICOCHET");
    expect(result.soundTarget).toBeNull();
    expect(result.roundWinner).toBeNull();
  });

  it("keeps shield ricochet semantics even if a blocked hit carried damage data", () => {
    const result = resolveBulletCollision({
      owner: "player",
      hitDummy: true,
      hitPlayer: false,
      hitObstacle: false,
      outOfBounds: false,
      damage: 14,
      appliedDamage: 9,
      targetDied: false,
      coverProtected: true
    });

    expect(result.destroyBullet).toBe(true);
    expect(result.damagedActor).toBe("dummy");
    expect(result.combatEvent).toBe("SHIELD RICOCHET");
    expect(result.soundTarget).toBeNull();
    expect(result.roundWinner).toBeNull();
  });
});
