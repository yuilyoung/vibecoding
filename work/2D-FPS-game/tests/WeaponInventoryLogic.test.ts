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
});
