export interface WeaponSlotState {
  readonly id: string;
  readonly label: string;
}

export class WeaponInventoryLogic {
  public readonly slots: readonly WeaponSlotState[];
  private activeIndex: number;

  public constructor(slots: readonly WeaponSlotState[]) {
    if (slots.length === 0) {
      throw new Error("WeaponInventoryLogic requires at least one weapon slot.");
    }

    this.slots = slots;
    this.activeIndex = 0;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getActiveSlot(): WeaponSlotState {
    return this.slots[this.activeIndex];
  }

  public selectSlot(index: number): boolean {
    if (index < 0 || index >= this.slots.length || index === this.activeIndex) {
      return false;
    }

    this.activeIndex = index;
    return true;
  }

  public reset(): void {
    this.activeIndex = 0;
  }
}
