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

  describe("edge cases (Phase 3 QA audit)", () => {
    it("rejects a negative health pickup amount without changing player state", () => {
      const result = applyPickup({
        player: { health: 60, maxHealth: 100 },
        pickup: { id: "med-bad", kind: "health", amount: -25 }
      });

      expect(result.consumed).toBe(false);
      expect(result.player.health).toBe(60);
      expect(result.restoredHealth).toBe(0);
    });

    it("rejects a negative ammo pickup amount without changing weapon state", () => {
      const result = applyPickup({
        player: { health: 100, maxHealth: 100 },
        weapon: { reserveAmmo: 4, maxReserveAmmo: 12 },
        pickup: { id: "ammo-bad", kind: "ammo", amount: -10 }
      });

      expect(result.consumed).toBe(false);
      expect(result.weapon?.reserveAmmo).toBe(4);
      expect(result.restoredAmmo).toBe(0);
    });

    it("does not crash when applying a boost while the prior boost has already expired", () => {
      const result = applyPickup({
        player: { health: 100, maxHealth: 100 },
        boost: { activeUntilMs: 500, multiplier: 1.2 },
        pickup: { id: "overdrive", kind: "boost", amount: 1.5, durationMs: 1_000 },
        nowMs: 5_000
      });

      // Expired boost: should restart from now, not from the stale activeUntilMs.
      expect(result.consumed).toBe(true);
      expect(result.boost?.activeUntilMs).toBe(6_000);
      expect(result.boost?.multiplier).toBe(1.5);
    });

    it("treats a zero-amount boost as a no-op without throwing", () => {
      const result = applyPickup({
        player: { health: 100, maxHealth: 100 },
        boost: { activeUntilMs: 1_000, multiplier: 1.5 },
        pickup: { id: "overdrive-empty", kind: "boost", amount: 0, durationMs: 2_000 },
        nowMs: 500
      });

      expect(result.consumed).toBe(false);
      expect(result.boost?.activeUntilMs).toBe(1_000);
      expect(result.boost?.multiplier).toBe(1.5);
    });

    it("cumulates two health pickups in sequence below the cap", () => {
      const first = applyPickup({
        player: { health: 30, maxHealth: 100 },
        pickup: { id: "med-1", kind: "health", amount: 20 }
      });

      expect(first.player.health).toBe(50);
      expect(first.restoredHealth).toBe(20);

      const second = applyPickup({
        player: first.player,
        pickup: { id: "med-2", kind: "health", amount: 25 }
      });

      expect(second.player.health).toBe(75);
      expect(second.restoredHealth).toBe(25);
      expect(second.consumed).toBe(true);
    });
  });
});
