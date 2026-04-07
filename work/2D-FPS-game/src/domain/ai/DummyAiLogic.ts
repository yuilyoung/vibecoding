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
    const hazardZone = this.findActiveHazardZone(input);

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

    if (input.healthRatio <= this.config.lowHealthThreshold && input.coverPoints.length > 0) {
      const targetCover = this.findBestCover(input);
      const coverDeltaX = targetCover.x - input.dummyX;
      const coverDeltaY = targetCover.y - input.dummyY;
      const coverDistance = Math.hypot(coverDeltaX, coverDeltaY) || 1;

      return {
        moveX: coverDeltaX / coverDistance,
        moveY: coverDeltaY / coverDistance,
        shouldFire: hasLineOfSight && distance <= this.config.shootRange * 0.65,
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
