import { AiStateMachine, type AiState } from "./AiStateMachine";
import { hasLineOfSight, lineIntersectsObstacle } from "./LineOfSightLogic";

export interface DummyAiBotTacticsConfig {
  readonly engageRange: number;
  readonly preferredHoldRange: number;
  readonly flankRange: number;
  readonly retreatRange: number;
  readonly retreatHealthThreshold: number;
  readonly coverHealthThreshold: number;
  readonly reengageHealthThreshold: number;
  readonly targetWeakHealthThreshold: number;
  readonly coverSearchRadius: number;
  readonly flankCommitMs: number;
  readonly weatherCautionVisionMultiplier: number;
}

export interface DummyAiCombatTuningConfig {
  readonly intentCooldownMs: number;
}

export interface DummyAiConfig {
  readonly engageRange: number;
  readonly retreatRange: number;
  readonly shootRange: number;
  readonly lowHealthThreshold: number;
  readonly botTactics?: Partial<DummyAiBotTacticsConfig>;
  readonly combatTuning?: Partial<DummyAiCombatTuningConfig>;
}

export interface CoverPoint {
  readonly x: number;
  readonly y: number;
}

export interface LineOfSightBlocker {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HazardAvoidanceZone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

export interface DummyAiInput {
  readonly dummyX: number;
  readonly dummyY: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly tickMs: number;
  readonly currentHealth?: number;
  readonly playerHealthRatio?: number;
  readonly healthRatio: number;
  readonly coverPoints: CoverPoint[];
  readonly lineOfSightBlockers?: readonly LineOfSightBlocker[];
  readonly hazardZones?: readonly HazardAvoidanceZone[];
  readonly effectiveVisionRange?: number;
}

export interface DummyAiDecision {
  readonly moveX: number;
  readonly moveY: number;
  readonly shouldFire: boolean;
  readonly mode: "chase" | "retreat" | "strafe" | "cover" | "flank" | "reposition" | "avoid-hazard";
}

interface ResolvedDummyAiConfig {
  readonly engageRange: number;
  readonly retreatRange: number;
  readonly shootRange: number;
  readonly preferredHoldRange: number;
  readonly flankRange: number;
  readonly lowHealthThreshold: number;
  readonly coverHealthThreshold: number;
  readonly reengageHealthThreshold: number;
  readonly targetWeakHealthThreshold: number;
  readonly coverSearchRadius: number;
  readonly flankCommitMs: number;
  readonly intentCooldownMs: number;
  readonly weatherCautionVisionMultiplier: number;
}

export class DummyAiLogic {
  private static readonly COVER_REENGAGE_PEEK_MS = 800;
  private static readonly COVER_REENGAGE_RESET_MS = 1400;
  private static readonly COVER_HOLD_PEEK_MS = 260;
  private static readonly COVER_HOLD_FIRE_MS = 520;
  private static readonly COVER_HOLD_RESET_MS = 1500;
  private readonly config: ResolvedDummyAiConfig;
  private readonly stateMachine: AiStateMachine;
  private currentState: AiState = "idle";
  private stateEnteredAtMs = 0;

  public constructor(config: DummyAiConfig) {
    this.config = resolveConfig(config);
    this.stateMachine = new AiStateMachine({
      engageRange: this.config.engageRange,
      preferredHoldRange: this.config.preferredHoldRange,
      flankRange: this.config.flankRange,
      retreatRange: this.config.retreatRange,
      lowHealthThreshold: this.config.lowHealthThreshold,
      coverHealthThreshold: this.config.coverHealthThreshold,
      flankCommitMs: this.config.flankCommitMs,
      intentCooldownMs: this.config.intentCooldownMs,
      weatherCautionVisionMultiplier: this.config.weatherCautionVisionMultiplier
    });
  }

  public evaluate(input: DummyAiInput): DummyAiDecision {
    const deltaX = input.playerX - input.dummyX;
    const deltaY = input.playerY - input.dummyY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) {
      this.transitionTo("retreat", input.tickMs);
      return {
        moveX: 0,
        moveY: -1,
        shouldFire: true,
        mode: "retreat"
      };
    }

    const normalizedX = deltaX / distance;
    const normalizedY = deltaY / distance;
    const lineOfSightBlockers = input.lineOfSightBlockers ?? [];
    const lineOfSightClear = hasLineOfSight(
      { x: input.dummyX, y: input.dummyY },
      { x: input.playerX, y: input.playerY },
      lineOfSightBlockers
    );
    const coverAvailable = this.hasCoverInRange(input);
    this.transitionTo(this.stateMachine.evaluate({
      currentState: this.currentState,
      distanceToTarget: distance,
      healthRatio: input.healthRatio,
      hasLineOfSight: lineOfSightClear,
      hasCoverAvailable: coverAvailable,
      effectiveVisionRange: input.effectiveVisionRange,
      nowMs: input.tickMs,
      stateEnteredAtMs: this.stateEnteredAtMs
    }), input.tickMs);

    const hazardZone = this.findActiveHazardZone(input);
    if (hazardZone !== undefined) {
      return this.createHazardAvoidanceDecision(input, hazardZone);
    }

    const blockingObstacle = this.findBlockingObstacle(input);
    if (!lineOfSightClear && blockingObstacle !== undefined) {
      const reroute = this.createObstacleBypass(input, normalizedX, normalizedY, blockingObstacle);

      return {
        moveX: reroute.moveX,
        moveY: reroute.moveY,
        shouldFire: false,
        mode: "reposition"
      };
    }

    switch (this.currentState) {
      case "retreat":
        return this.createRetreatDecision(input, distance, normalizedX, normalizedY, lineOfSightClear);
      case "hold":
        return this.createHoldDecision(input, distance, normalizedX, normalizedY, lineOfSightClear);
      case "flank":
        if (!lineOfSightClear && coverAvailable) {
          return this.createCoverApproachDecision(input);
        }

        return this.createFlankDecision(normalizedX, normalizedY, input.tickMs, lineOfSightClear && distance <= this.config.shootRange);
      case "pressure":
        return this.createPressureDecision(distance, normalizedX, normalizedY, lineOfSightClear, input.tickMs);
      case "idle":
      default:
        return {
          moveX: 0,
          moveY: 0,
          shouldFire: false,
          mode: "strafe"
        };
    }
  }

  public getCurrentState(): AiState {
    return this.currentState;
  }

  private transitionTo(nextState: AiState, tickMs: number): void {
    if (nextState === this.currentState) {
      return;
    }

    this.currentState = nextState;
    this.stateEnteredAtMs = tickMs;
  }

  private hasCoverInRange(input: DummyAiInput): boolean {
    return input.coverPoints.some((coverPoint) =>
      distanceToPoint(input.dummyX, input.dummyY, coverPoint.x, coverPoint.y) <= this.config.coverSearchRadius
    );
  }

  private createHazardAvoidanceDecision(input: DummyAiInput, hazardZone: HazardAvoidanceZone): DummyAiDecision {
    const hazardCenterX = hazardZone.x + hazardZone.width / 2;
    const hazardCenterY = hazardZone.y + hazardZone.height / 2;
    const hazardDeltaX = input.dummyX - hazardCenterX;
    const hazardDeltaY = input.dummyY - hazardCenterY;
    const hazardDistance = Math.hypot(hazardDeltaX, hazardDeltaY) || 1;

    return {
      moveX: hazardDeltaX / hazardDistance,
      moveY: hazardDeltaY / hazardDistance,
      shouldFire: false,
      mode: "avoid-hazard"
    };
  }

  private createRetreatDecision(
    input: DummyAiInput,
    distance: number,
    normalizedX: number,
    normalizedY: number,
    lineOfSightClear: boolean
  ): DummyAiDecision {
    const shouldSeekCover = this.hasCoverInRange(input);
    if (shouldSeekCover) {
      const targetCover = this.findBestCover(input);
      const alreadyInCover = distanceToPoint(input.dummyX, input.dummyY, targetCover.x, targetCover.y) <= 28;

      if (!alreadyInCover) {
        return this.createMoveToPointDecision(input.dummyX, input.dummyY, targetCover.x, targetCover.y, "cover");
      }

      return this.createCoverHoldDecision(
        input.tickMs,
        normalizedX,
        normalizedY,
        lineOfSightClear && distance <= this.config.shootRange * 0.8
      );
    }

    return {
      moveX: -normalizedX,
      moveY: -normalizedY,
      shouldFire: lineOfSightClear && distance <= this.config.shootRange * 0.6,
      mode: "retreat"
    };
  }

  private createHoldDecision(
    input: DummyAiInput,
    distance: number,
    normalizedX: number,
    normalizedY: number,
    lineOfSightClear: boolean
  ): DummyAiDecision {
    const shouldUseCover = this.hasCoverInRange(input) && input.healthRatio <= this.config.coverHealthThreshold;
    if (shouldUseCover) {
      const targetCover = this.findBestCover(input);
      const alreadyInCover = distanceToPoint(input.dummyX, input.dummyY, targetCover.x, targetCover.y) <= 28;

      if (!alreadyInCover) {
        return this.createMoveToPointDecision(input.dummyX, input.dummyY, targetCover.x, targetCover.y, "cover");
      }

      const shouldReengage = input.healthRatio >= this.config.reengageHealthThreshold
        || (input.playerHealthRatio ?? 1) <= this.config.targetWeakHealthThreshold;
      if (shouldReengage && lineOfSightClear) {
        return this.createCoverReengageDecision(input.tickMs, normalizedX, normalizedY, distance <= this.config.shootRange);
      }

      return this.createCoverHoldDecision(
        input.tickMs,
        normalizedX,
        normalizedY,
        lineOfSightClear && distance <= this.config.shootRange
      );
    }

    const strafeDirection = Math.floor(input.tickMs / 700) % 2 === 0 ? 1 : -1;
    return {
      moveX: -normalizedY * strafeDirection,
      moveY: normalizedX * strafeDirection,
      shouldFire: lineOfSightClear && distance <= this.config.shootRange,
      mode: "strafe"
    };
  }

  private createPressureDecision(
    distance: number,
    normalizedX: number,
    normalizedY: number,
    lineOfSightClear: boolean,
    tickMs: number
  ): DummyAiDecision {
    if (distance > this.config.shootRange * 0.82) {
      return {
        moveX: normalizedX,
        moveY: normalizedY,
        shouldFire: false,
        mode: "chase"
      };
    }

    const strafeDirection = Math.floor(tickMs / 700) % 2 === 0 ? 1 : -1;
    return {
      moveX: normalizedX * 0.6 + (-normalizedY * 0.4 * strafeDirection),
      moveY: normalizedY * 0.6 + (normalizedX * 0.4 * strafeDirection),
      shouldFire: lineOfSightClear && distance <= this.config.shootRange,
      mode: "strafe"
    };
  }

  private createCoverApproachDecision(input: DummyAiInput): DummyAiDecision {
    const targetCover = this.findBestCover(input);
    return this.createMoveToPointDecision(input.dummyX, input.dummyY, targetCover.x, targetCover.y, "reposition");
  }

  private createMoveToPointDecision(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    mode: "cover" | "reposition"
  ): DummyAiDecision {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const length = Math.hypot(deltaX, deltaY) || 1;

    return {
      moveX: deltaX / length,
      moveY: deltaY / length,
      shouldFire: false,
      mode
    };
  }

  private findBlockingObstacle(input: DummyAiInput): LineOfSightBlocker | undefined {
    if (input.lineOfSightBlockers === undefined) {
      return undefined;
    }

    let bestBlocker: LineOfSightBlocker | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const blocker of input.lineOfSightBlockers) {
      if (!lineIntersectsObstacle(
        { x: input.dummyX, y: input.dummyY },
        { x: input.playerX, y: input.playerY },
        blocker
      )) {
        continue;
      }

      const blockerCenterX = blocker.x + blocker.width / 2;
      const blockerCenterY = blocker.y + blocker.height / 2;
      const distanceToDummy = Math.hypot(blockerCenterX - input.dummyX, blockerCenterY - input.dummyY);

      if (distanceToDummy < bestDistance) {
        bestBlocker = blocker;
        bestDistance = distanceToDummy;
      }
    }

    return bestBlocker;
  }

  private findActiveHazardZone(input: DummyAiInput): HazardAvoidanceZone | undefined {
    return input.hazardZones?.find((zone) => {
      const left = zone.x - zone.padding;
      const right = zone.x + zone.width + zone.padding;
      const top = zone.y - zone.padding;
      const bottom = zone.y + zone.height + zone.padding;
      return this.pointInsideRect(input.dummyX, input.dummyY, left, right, top, bottom);
    });
  }

  private pointInsideRect(x: number, y: number, left: number, right: number, top: number, bottom: number): boolean {
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  private createObstacleBypass(
    input: DummyAiInput,
    normalizedX: number,
    normalizedY: number,
    blocker: LineOfSightBlocker
  ): { moveX: number; moveY: number } {
    const blockerCenterX = blocker.x + blocker.width / 2;
    const blockerCenterY = blocker.y + blocker.height / 2;
    const blockerDeltaX = blockerCenterX - input.dummyX;
    const blockerDeltaY = blockerCenterY - input.dummyY;
    const cross = normalizedX * blockerDeltaY - normalizedY * blockerDeltaX;
    const side = Math.abs(cross) < 0.001
      ? (Math.floor(input.tickMs / 900) % 2 === 0 ? 1 : -1)
      : (cross > 0 ? -1 : 1);
    const lateralX = -normalizedY * side;
    const lateralY = normalizedX * side;
    const blendedX = lateralX * 0.82 + normalizedX * 0.28;
    const blendedY = lateralY * 0.82 + normalizedY * 0.28;
    const length = Math.hypot(blendedX, blendedY) || 1;

    return {
      moveX: blendedX / length,
      moveY: blendedY / length
    };
  }

  private createCoverReengageDecision(
    tickMs: number,
    normalizedX: number,
    normalizedY: number,
    shouldFire: boolean
  ): DummyAiDecision {
    const cycleMs = tickMs % DummyAiLogic.COVER_REENGAGE_RESET_MS;

    if (cycleMs < DummyAiLogic.COVER_REENGAGE_PEEK_MS) {
      return this.createFlankDecision(normalizedX, normalizedY, tickMs, shouldFire);
    }

    return {
      moveX: 0,
      moveY: 0,
      shouldFire: false,
      mode: "cover"
    };
  }

  private createCoverHoldDecision(
    tickMs: number,
    normalizedX: number,
    normalizedY: number,
    canFireFromCover: boolean
  ): DummyAiDecision {
    if (!canFireFromCover) {
      return {
        moveX: 0,
        moveY: 0,
        shouldFire: false,
        mode: "cover"
      };
    }

    const cycleMs = tickMs % DummyAiLogic.COVER_HOLD_RESET_MS;

    if (cycleMs < DummyAiLogic.COVER_HOLD_PEEK_MS) {
      const strafeDirection = Math.floor(tickMs / 850) % 2 === 0 ? 1 : -1;
      return {
        moveX: -normalizedY * 0.34 * strafeDirection,
        moveY: normalizedX * 0.34 * strafeDirection,
        shouldFire: true,
        mode: "cover"
      };
    }

    if (cycleMs < DummyAiLogic.COVER_HOLD_FIRE_MS) {
      return {
        moveX: 0,
        moveY: 0,
        shouldFire: true,
        mode: "cover"
      };
    }

    return {
      moveX: 0,
      moveY: 0,
      shouldFire: false,
      mode: "cover"
    };
  }

  private createFlankDecision(
    normalizedX: number,
    normalizedY: number,
    tickMs: number,
    shouldFire: boolean
  ): DummyAiDecision {
    const flankDirection = Math.floor(tickMs / 900) % 2 === 0 ? 1 : -1;
    const flankVectorX = normalizedX + (-normalizedY * flankDirection);
    const flankVectorY = normalizedY + (normalizedX * flankDirection);
    const flankLength = Math.hypot(flankVectorX, flankVectorY) || 1;

    return {
      moveX: flankVectorX / flankLength,
      moveY: flankVectorY / flankLength,
      shouldFire,
      mode: "flank"
    };
  }

  private findBestCover(input: DummyAiInput): CoverPoint {
    let bestPoint = input.coverPoints[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const coverPoint of input.coverPoints) {
      const distanceToDummy = Math.hypot(coverPoint.x - input.dummyX, coverPoint.y - input.dummyY);
      if (distanceToDummy > this.config.coverSearchRadius) {
        continue;
      }

      const distanceToPlayer = Math.hypot(coverPoint.x - input.playerX, coverPoint.y - input.playerY);
      const score = distanceToDummy - distanceToPlayer * 0.25;

      if (score < bestScore) {
        bestPoint = coverPoint;
        bestScore = score;
      }
    }

    return bestPoint;
  }
}

function distanceToPoint(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.hypot(toX - fromX, toY - fromY);
}

function resolveConfig(config: DummyAiConfig): ResolvedDummyAiConfig {
  const botTactics = config.botTactics ?? {};
  const combatTuning = config.combatTuning ?? {};

  return {
    engageRange: botTactics.engageRange ?? config.engageRange,
    retreatRange: botTactics.retreatRange ?? config.retreatRange,
    shootRange: config.shootRange,
    preferredHoldRange: botTactics.preferredHoldRange ?? Math.max(config.retreatRange + 20, Math.round(config.shootRange * 0.56)),
    flankRange: botTactics.flankRange ?? Math.round(config.shootRange * 0.7),
    lowHealthThreshold: botTactics.retreatHealthThreshold ?? config.lowHealthThreshold,
    coverHealthThreshold: botTactics.coverHealthThreshold ?? 0.8,
    reengageHealthThreshold: botTactics.reengageHealthThreshold ?? 0.92,
    targetWeakHealthThreshold: botTactics.targetWeakHealthThreshold ?? 0.45,
    coverSearchRadius: botTactics.coverSearchRadius ?? config.engageRange,
    flankCommitMs: botTactics.flankCommitMs ?? 1400,
    intentCooldownMs: combatTuning.intentCooldownMs ?? 900,
    weatherCautionVisionMultiplier: botTactics.weatherCautionVisionMultiplier ?? 0.85
  };
}
