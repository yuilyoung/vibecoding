import { WeaponInventoryLogic } from "../src/domain/combat/WeaponInventoryLogic";

describe("WeaponInventoryLogic", () => {
  it("starts on the first slot and selects another valid slot", () => {
    const inventory = new WeaponInventoryLogic([
      { id: "carbine", label: "Carbine" },
      { id: "scatter", label: "Scatter" }
    ]);

    expect(inventory.getActiveSlot().id).toBe("carbine");
    expect(inventory.selectSlot(1)).toBe(true);
    expect(inventory.getActiveSlot().id).toBe("scatter");
  });

  it("rejects invalid and duplicate slot selections", () => {
    const inventory = new WeaponInventoryLogic([
      { id: "carbine", label: "Carbine" },
      { id: "scatter", label: "Scatter" }
    ]);

    expect(inventory.selectSlot(0)).toBe(false);
    expect(inventory.selectSlot(2)).toBe(false);
    expect(inventory.getActiveIndex()).toBe(0);
  });

  it("resets back to the first slot", () => {
    const inventory = new WeaponInventoryLogic([
      { id: "carbine", label: "Carbine" },
      { id: "scatter", label: "Scatter" }
    ]);

    inventory.selectSlot(1);
    inventory.reset();

    expect(inventory.getActiveSlot().id).toBe("carbine");
  });

  it("requires at least one slot", () => {
    expect(() => new WeaponInventoryLogic([])).toThrow("at least one weapon slot");
  });

  it("creates weapon logic instances from weapon configs", () => {
    const inventory = WeaponInventoryLogic.fromConfigs([
      {
        id: "carbine",
        label: "Carbine",
        config: {
          fireRateMs: 180,
          bulletSpeed: 540,
          damage: 20,
          magazineSize: 6,
          reloadTimeMs: 1200,
          reserveAmmo: 24,
          projectile: {
            trajectory: "linear",
            speed: 540
          }
        }
      },
      {
        id: "bazooka",
        label: "Bazooka",
        config: {
          fireRateMs: 1250,
          bulletSpeed: 292,
          damage: 45,
          magazineSize: 1,
          reloadTimeMs: 1700,
          reserveAmmo: 5,
          projectile: {
            trajectory: "arc",
            speed: 292,
            gravity: 300,
            blastRadius: 60
          }
        }
      }
    ]);

    expect(inventory.getActiveWeapon().tryFire(0).projectile.trajectory).toBe("linear");
    expect(inventory.selectSlot(1)).toBe(true);
    expect(inventory.getActiveWeapon().tryFire(0).projectile.trajectory).toBe("arc");
  });

  it("cancels the previous weapon reload when selecting a new slot", () => {
    const inventory = WeaponInventoryLogic.fromConfigs([
      {
        id: "carbine",
        label: "Carbine",
        config: {
          fireRateMs: 10,
          bulletSpeed: 540,
          damage: 20,
          magazineSize: 2,
          reloadTimeMs: 500,
          reserveAmmo: 4
        }
      },
      {
        id: "scatter",
        label: "Scatter",
        config: {
          fireRateMs: 10,
          bulletSpeed: 440,
          damage: 12,
          magazineSize: 2,
          reloadTimeMs: 500,
          reserveAmmo: 4
        }
      }
    ]);

    const carbine = inventory.getActiveWeapon();
    carbine.tryFire(0);
    carbine.startReload(20);

    expect(carbine.isReloading(100)).toBe(true);
    expect(inventory.selectSlot(1, 100)).toBe(true);
    expect(carbine.isReloading(100)).toBe(false);
  });

  it("throws when the active metadata-only slot has no weapon logic", () => {
    const inventory = new WeaponInventoryLogic([{ id: "carbine", label: "Carbine" }]);

    expect(() => inventory.getActiveWeapon()).toThrow("does not own");
  });

  it("selects a pressure weapon for close-range engagements", () => {
    const inventory = WeaponInventoryLogic.fromConfigs([
      {
        id: "carbine",
        label: "Carbine",
        config: {
          fireRateMs: 180,
          bulletSpeed: 540,
          damage: 20,
          magazineSize: 6,
          reloadTimeMs: 1200,
          reserveAmmo: 24,
          roleProfile: {
            role: "carbine",
            idealRange: [160, 340],
            burstSize: 1,
            tacticalTags: ["hold", "anchor"],
            splashRisk: "low"
          }
        }
      },
      {
        id: "scatter",
        label: "Scatter",
        config: {
          fireRateMs: 560,
          bulletSpeed: 480,
          damage: 12,
          magazineSize: 3,
          reloadTimeMs: 1500,
          reserveAmmo: 12,
          roleProfile: {
            role: "scatter",
            idealRange: [0, 140],
            burstSize: 3,
            tacticalTags: ["pressure", "flank"],
            splashRisk: "low"
          }
        }
      }
    ]);

    const selection = inventory.selectBestWeapon({
      distanceToTarget: 70,
      tacticalIntent: "pressure",
      splashRiskTolerance: "avoid"
    }, 0);

    expect(selection.slot.id).toBe("scatter");
    expect(selection.role).toBe("scatter");
    expect(selection.changed).toBe(true);
    expect(inventory.getActiveSlot().id).toBe("scatter");
  });

  it("keeps the current weapon when it remains the best role fit", () => {
    const inventory = WeaponInventoryLogic.fromConfigs([
      {
        id: "carbine",
        label: "Carbine",
        config: {
          fireRateMs: 180,
          bulletSpeed: 540,
          damage: 20,
          magazineSize: 6,
          reloadTimeMs: 1200,
          reserveAmmo: 24,
          roleProfile: {
            role: "carbine",
            idealRange: [160, 340],
            burstSize: 1,
            tacticalTags: ["hold", "anchor"],
            splashRisk: "low"
          }
        }
      },
      {
        id: "scatter",
        label: "Scatter",
        config: {
          fireRateMs: 560,
          bulletSpeed: 480,
          damage: 12,
          magazineSize: 3,
          reloadTimeMs: 1500,
          reserveAmmo: 12,
          roleProfile: {
            role: "scatter",
            idealRange: [0, 140],
            burstSize: 3,
            tacticalTags: ["pressure"],
            splashRisk: "low"
          }
        }
      }
    ]);

    const selection = inventory.selectBestWeapon({
      distanceToTarget: 240,
      tacticalIntent: "hold",
      splashRiskTolerance: "avoid"
    }, 0);

    expect(selection.slot.id).toBe("carbine");
    expect(selection.changed).toBe(false);
    expect(inventory.getActiveSlot().id).toBe("carbine");
  });

  it("avoids splash-heavy weapons when close spacing makes explosives unsafe", () => {
    const inventory = WeaponInventoryLogic.fromConfigs([
      {
        id: "carbine",
        label: "Carbine",
        config: {
          fireRateMs: 180,
          bulletSpeed: 540,
          damage: 20,
          magazineSize: 6,
          reloadTimeMs: 1200,
          reserveAmmo: 24,
          roleProfile: {
            role: "carbine",
            idealRange: [150, 340],
            burstSize: 1,
            tacticalTags: ["hold", "safe"],
            splashRisk: "low"
          }
        }
      },
      {
        id: "bazooka",
        label: "Bazooka",
        config: {
          fireRateMs: 1100,
          bulletSpeed: 360,
          damage: 45,
          magazineSize: 1,
          reloadTimeMs: 1800,
          reserveAmmo: 5,
          roleProfile: {
            role: "explosive",
            idealRange: [160, 320],
            burstSize: 1,
            tacticalTags: ["pressure", "denial"],
            splashRisk: "high"
          }
        }
      }
    ]);

    const selection = inventory.selectBestWeapon({
      distanceToTarget: 210,
      tacticalIntent: "pressure",
      splashRiskTolerance: "avoid",
      targetSpacing: "tight"
    }, 0);

    expect(selection.slot.id).toBe("carbine");
    expect(selection.role).toBe("carbine");
  });
});
