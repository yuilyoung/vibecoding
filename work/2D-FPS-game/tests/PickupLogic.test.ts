import { applyPickup } from "../src/domain/pickup/PickupLogic";

describe("PickupLogic", () => {
  it("restores health without exceeding max health", () => {
    const result = applyPickup({
      player: { health: 72, maxHealth: 100 },
      pickup: { id: "med-small", kind: "health", amount: 35 }
    });

    expect(result.consumed).toBe(true);
    expect(result.player.health).toBe(100);
    expect(result.restoredHealth).toBe(28);
  });

  it("does not consume a health pickup when health is already full", () => {
    const result = applyPickup({
      player: { health: 100, maxHealth: 100 },
      pickup: { id: "med-small", kind: "health", amount: 25 }
    });

    expect(result.consumed).toBe(false);
    expect(result.restoredHealth).toBe(0);
  });

  it("restores reserve ammo up to the weapon cap", () => {
    const result = applyPickup({
      player: { health: 100, maxHealth: 100 },
      weapon: { reserveAmmo: 5, maxReserveAmmo: 12 },
      pickup: { id: "ammo-box", kind: "ammo", amount: 10 }
    });

    expect(result.consumed).toBe(true);
    expect(result.weapon?.reserveAmmo).toBe(12);
    expect(result.restoredAmmo).toBe(7);
  });

  it("does not consume an ammo pickup without a weapon state", () => {
    const result = applyPickup({
      player: { health: 100, maxHealth: 100 },
      pickup: { id: "ammo-box", kind: "ammo", amount: 10 }
    });

    expect(result.consumed).toBe(false);
    expect(result.restoredAmmo).toBe(0);
  });

  it("extends boost duration from the later active time", () => {
    const result = applyPickup({
      player: { health: 100, maxHealth: 100 },
      boost: { activeUntilMs: 1_500, multiplier: 1.2 },
      pickup: { id: "overdrive", kind: "boost", amount: 1.35, durationMs: 2_000 },
      nowMs: 1_000
    });

    expect(result.consumed).toBe(true);
    expect(result.boost?.activeUntilMs).toBe(3_500);
    expect(result.boost?.multiplier).toBe(1.35);
    expect(result.boostDurationMs).toBe(2_000);
  });
});
