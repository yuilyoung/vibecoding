import { WeaponLogic, type WeaponConfig, type WeaponSelectionContext } from "./WeaponLogic";

export interface WeaponSlotState {
  readonly id: string;
  readonly label: string;
  readonly logic?: WeaponLogic;
}

export interface WeaponInventoryConfig {
  readonly id: string;
  readonly label: string;
  readonly config: WeaponConfig;
}

export interface WeaponSelectionResult {
  readonly selectedIndex: number;
  readonly changed: boolean;
  readonly slot: WeaponSlotState;
  readonly role: string | null;
  readonly score: number;
  readonly reasons: readonly string[];
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

  public static fromConfigs(configs: readonly WeaponInventoryConfig[]): WeaponInventoryLogic {
    return new WeaponInventoryLogic(configs.map((entry) => ({
      id: entry.id,
      label: entry.label,
      logic: new WeaponLogic(entry.config)
    })));
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getActiveSlot(): WeaponSlotState {
    return this.slots[this.activeIndex];
  }

  public getActiveWeapon(): WeaponLogic {
    const activeWeapon = this.getActiveSlot().logic;

    if (activeWeapon === undefined) {
      throw new Error("Active weapon slot does not own a WeaponLogic instance.");
    }

    return activeWeapon;
  }

  public selectSlot(index: number, atTimeMs = 0): boolean {
    if (index < 0 || index >= this.slots.length || index === this.activeIndex) {
      return false;
    }

    this.slots[this.activeIndex].logic?.cancelReload(atTimeMs);
    this.activeIndex = index;
    return true;
  }

  public selectBestWeapon(
    context: WeaponSelectionContext,
    atTimeMs = 0
  ): WeaponSelectionResult {
    let bestIndex = this.activeIndex;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestRole: string | null = null;
    let bestReasons: readonly string[] = [];

    this.slots.forEach((slot, index) => {
      const logic = slot.logic;
      if (logic === undefined) {
        return;
      }

      const evaluation = logic.evaluateSelection(context, atTimeMs);
      const tieBreaker = index === this.activeIndex ? 1 : 0;
      const weightedScore = evaluation.score + tieBreaker;
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestIndex = index;
        bestRole = evaluation.role;
        bestReasons = evaluation.reasons;
      }
    });

    const changed = this.selectSlot(bestIndex, atTimeMs);
    return {
      selectedIndex: bestIndex,
      changed,
      slot: this.slots[bestIndex],
      role: bestRole,
      score: bestScore,
      reasons: bestReasons
    };
  }

  public reset(): void {
    this.activeIndex = 0;
  }
}
