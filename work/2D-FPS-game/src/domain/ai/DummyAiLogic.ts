export interface DummyAiConfig {
  readonly engageRange: number;
  readonly retreatRange: number;
  readonly shootRange: number;
  readonly lowHealthThreshold: number;
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
}

export interface DummyAiDecision {
  readonly moveX: number;
  readonly moveY: number;
  readonly shouldFire: boolean;
  readonly mode: "chase" | "retreat" | "strafe" | "cover" | "flank" | "reposition" | "avoid-hazard";
}

export class DummyAiLogic {
  private static readonly COVER_REENGAGE_PEEK_MS = 800;
  private static readonly COVER_REENGAGE_RESET_MS = 1400;
  private static readonly COVER_HOLD_PEEK_MS = 260;
  private static readonly COVER_HOLD_FIRE_MS = 520;
  private static readonly COVER_HOLD_RESET_MS = 1500;
  private readonly config: DummyAiConfig;

  public constructor(config: DummyAiConfig) {
    this.config = config;
  }

  public evaluate(input: DummyAiInput): DummyAiDecision {
    const deltaX = input.playerX - input.dummyX;
    const deltaY = input.playerY - input.dummyY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) {
      return {
        moveX: 0,
        moveY: -1,
        shouldFire: true,
        mode: "retreat"
      };
    }

    const normalizedX = deltaX / distance;
    const normalizedY = deltaY / distance;
    const hasLineOfSight = this.hasLineOfSight(input);
    const blockingObstacle = this.findBlockingObstacle(input);
    const hazardZone = this.findActiveHazardZone(input);
    const shouldPlayTactical = (input.currentHealth ?? Number.POSITIVE_INFINITY) <= 80;
    const shouldReengage = shouldPlayTactical && ((input.currentHealth ?? 0) >= 92 || (input.playerHealthRatio ?? 1) <= 0.45);

    if (hazardZone !== undefined) {
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

    if (!hasLineOfSight && blockingObstacle !== undefined) {
      const reroute = this.createObstacleBypass(input, normalizedX, normalizedY, blockingObstacle);

      return {
        moveX: reroute.moveX,
        moveY: reroute.moveY,
        shouldFire: false,
        mode: "reposition"
      };
    }

    if (!hasLineOfSight && input.coverPoints.length > 0) {
      const targetCover = this.findBestCover(input);
      const coverDeltaX = targetCover.x - input.dummyX;
      const coverDeltaY = targetCover.y - input.dummyY;
      const coverDistance = Math.hypot(coverDeltaX, coverDeltaY) || 1;

      return {
        moveX: coverDeltaX / coverDistance,
        moveY: coverDeltaY / coverDistance,
        shouldFire: false,
        mode: "reposition"
      };
    }

    if ((shouldPlayTactical || input.healthRatio <= this.config.lowHealthThreshold) && input.coverPoints.length > 0) {
      const targetCover = this.findBestCover(input);
      const coverDeltaX = targetCover.x - input.dummyX;
      const coverDeltaY = targetCover.y - input.dummyY;
      const coverDistance = Math.hypot(coverDeltaX, coverDeltaY) || 1;
      const alreadyInCover = distanceToPoint(input.dummyX, input.dummyY, targetCover.x, targetCover.y) <= 28;

      if (alreadyInCover) {
        if (shouldReengage) {
          if (distance > this.config.shootRange * 0.72) {
            return {
              moveX: normalizedX,
              moveY: normalizedY,
              shouldFire: false,
              mode: "chase"
            };
          }

          return this.createCoverReengageDecision(input.tickMs, normalizedX, normalizedY, hasLineOfSight);
        }

        return this.createCoverHoldDecision(
          input.tickMs,
          normalizedX,
          normalizedY,
          hasLineOfSight && distance <= this.config.shootRange
        );
      }

      return {
        moveX: coverDeltaX / coverDistance,
        moveY: coverDeltaY / coverDistance,
        shouldFire: false,
        mode: "cover"
      };
    }

    if (distance > this.config.engageRange) {
      return {
        moveX: normalizedX,
        moveY: normalizedY,
        shouldFire: false,
        mode: "chase"
      };
    }

    if (distance < this.config.retreatRange) {
      return {
        moveX: -normalizedX,
        moveY: -normalizedY,
        shouldFire: hasLineOfSight,
        mode: "retreat"
      };
    }

    const strafeDirection = Math.floor(input.tickMs / 700) % 2 === 0 ? 1 : -1;
    const flankDirection = Math.floor(input.tickMs / 1400) % 2 === 0 ? 1 : -1;

    if (distance <= this.config.shootRange * 0.9) {
      const flankVectorX = normalizedX + (-normalizedY * flankDirection);
      const flankVectorY = normalizedY + (normalizedX * flankDirection);
      const flankLength = Math.hypot(flankVectorX, flankVectorY) || 1;

      return {
        moveX: flankVectorX / flankLength,
        moveY: flankVectorY / flankLength,
        shouldFire: hasLineOfSight,
        mode: "flank"
      };
    }

    return {
      moveX: -normalizedY * strafeDirection,
      moveY: normalizedX * strafeDirection,
      shouldFire: hasLineOfSight && distance <= this.config.shootRange,
      mode: "strafe"
    };
  }

  private hasLineOfSight(input: DummyAiInput): boolean {
    return !input.lineOfSightBlockers?.some((blocker) =>
      this.lineIntersectsRect(input.dummyX, input.dummyY, input.playerX, input.playerY, blocker)
    );
  }

  private findBlockingObstacle(input: DummyAiInput): LineOfSightBlocker | undefined {
    if (input.lineOfSightBlockers === undefined) {
      return undefined;
    }

    let bestBlocker: LineOfSightBlocker | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const blocker of input.lineOfSightBlockers) {
      if (!this.lineIntersectsRect(input.dummyX, input.dummyY, input.playerX, input.playerY, blocker)) {
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

  private lineIntersectsRect(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    rect: LineOfSightBlocker
  ): boolean {
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    if (this.pointInsideRect(startX, startY, left, right, top, bottom) || this.pointInsideRect(endX, endY, left, right, top, bottom)) {
      return true;
    }

    return (
      this.linesIntersect(startX, startY, endX, endY, left, top, right, top) ||
      this.linesIntersect(startX, startY, endX, endY, right, top, right, bottom) ||
      this.linesIntersect(startX, startY, endX, endY, right, bottom, left, bottom) ||
      this.linesIntersect(startX, startY, endX, endY, left, bottom, left, top)
    );
  }

  private pointInsideRect(x: number, y: number, left: number, right: number, top: number, bottom: number): boolean {
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  private linesIntersect(
    aStartX: number,
    aStartY: number,
    aEndX: number,
    aEndY: number,
    bStartX: number,
    bStartY: number,
    bEndX: number,
    bEndY: number
  ): boolean {
    const denominator = (aEndX - aStartX) * (bEndY - bStartY) - (aEndY - aStartY) * (bEndX - bStartX);

    if (denominator === 0) {
      return false;
    }

    const numeratorA = (aStartY - bStartY) * (bEndX - bStartX) - (aStartX - bStartX) * (bEndY - bStartY);
    const numeratorB = (aStartY - bStartY) * (aEndX - aStartX) - (aStartX - bStartX) * (aEndY - aStartY);
    const scalarA = numeratorA / denominator;
    const scalarB = numeratorB / denominator;

    return scalarA >= 0 && scalarA <= 1 && scalarB >= 0 && scalarB <= 1;
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
    hasLineOfSight: boolean
  ): DummyAiDecision {
    const cycleMs = tickMs % DummyAiLogic.COVER_REENGAGE_RESET_MS;

    if (!hasLineOfSight) {
      return {
        moveX: normalizedX,
        moveY: normalizedY,
        shouldFire: false,
        mode: "chase"
      };
    }

    if (cycleMs < DummyAiLogic.COVER_REENGAGE_PEEK_MS) {
      return this.createFlankDecision(normalizedX, normalizedY, tickMs, true);
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
