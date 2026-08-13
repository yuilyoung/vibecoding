export interface HazardTick {
  readonly triggered: boolean;
  readonly damage: number;
  readonly nextReadyAtMs: number;
}

export class HazardZoneLogic {
  private readonly damage: number;
  private readonly tickRateMs: number;
  private readonly nextReadyByActor: Map<string, number>;

  public constructor(damage: number, tickRateMs: number) {
    this.damage = damage;
    this.tickRateMs = tickRateMs;
    this.nextReadyByActor = new Map();
  }

  public tick(actorId: string, overlapping: boolean, atTimeMs: number): HazardTick {
    const nextReadyAtMs = this.nextReadyByActor.get(actorId) ?? 0;

    if (!overlapping || atTimeMs < nextReadyAtMs) {
      return {
        triggered: false,
        damage: 0,
        nextReadyAtMs
      };
    }

    const nextTickAtMs = atTimeMs + this.tickRateMs;
    this.nextReadyByActor.set(actorId, nextTickAtMs);

    return {
      triggered: true,
      damage: this.damage,
      nextReadyAtMs: nextTickAtMs
    };
  }

  public reset(): void {
    this.nextReadyByActor.clear();
  }
}
