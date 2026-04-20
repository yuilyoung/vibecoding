import Phaser from "phaser";
import { createCenteredRect, intersectsRect, type Rect } from "../domain/collision/CollisionLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import {
  ACTOR_COLLIDER_HEIGHT,
  ACTOR_COLLIDER_WIDTH,
  ACTOR_HALF_SIZE,
  OBSTACLE_CONTACT_EPSILON,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MAX_Y,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MIN_Y,
  SPIRAL_SCAN_MAX_STEPS,
  SPIRAL_SCAN_STEP_SIZE,
  STUCK_ESCAPE_THRESHOLD,
} from "./scene-constants";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { ActorCollisionResolution, ObstacleView } from "./scene-types";

export class ActorCollisionResolver {
  public constructor(private readonly state: SceneRuntimeState) {}

  public getActiveObstacles(): ObstacleView[] {
    if (this.state.gate === undefined) {
      return this.state.obstacles;
    }

    return this.state.obstacles.filter((obstacle) => obstacle !== this.state.gate || !this.state.gate.open);
  }

  public getActorCollisionBounds(centerX: number, centerY: number): Rect {
    return createCenteredRect(centerX, centerY, ACTOR_COLLIDER_WIDTH, ACTOR_COLLIDER_HEIGHT);
  }

  public resolveActorObstacleCollision(
    centerX: number,
    centerY: number,
    previousX: number,
    previousY: number,
    actorLogic: PlayerLogic
  ): ActorCollisionResolution {
    const attemptedBounds = this.getActorCollisionBounds(centerX, centerY);
    const isPlayer = actorLogic === this.state.playerLogic;

    if (!this.getActiveObstacles().some((obstacle) => intersectsRect(attemptedBounds, obstacle.bounds))) {
      this.resetBlockedFrames(isPlayer);
      return {
        blocked: false,
        centerX,
        centerY
      };
    }

    const xOnlyBounds = this.getActorCollisionBounds(centerX, previousY + ACTOR_HALF_SIZE);
    const yOnlyBounds = this.getActorCollisionBounds(previousX + ACTOR_HALF_SIZE, centerY);
    const canKeepX = !this.getActiveObstacles().some((obstacle) => intersectsRect(xOnlyBounds, obstacle.bounds));
    const canKeepY = !this.getActiveObstacles().some((obstacle) => intersectsRect(yOnlyBounds, obstacle.bounds));

    if (canKeepX) {
      actorLogic.state.positionX = centerX - ACTOR_HALF_SIZE;
      actorLogic.state.positionY = previousY;
      this.resetBlockedFrames(isPlayer);
      return {
        blocked: false,
        centerX,
        centerY: previousY + ACTOR_HALF_SIZE
      };
    }

    if (canKeepY) {
      actorLogic.state.positionX = previousX;
      actorLogic.state.positionY = centerY - ACTOR_HALF_SIZE;
      this.resetBlockedFrames(isPlayer);
      return {
        blocked: false,
        centerX: previousX + ACTOR_HALF_SIZE,
        centerY
      };
    }

    const overlapResolution = this.resolveObstacleOverlap(attemptedBounds);

    if (overlapResolution !== null) {
      actorLogic.state.positionX = overlapResolution.centerX - ACTOR_HALF_SIZE;
      actorLogic.state.positionY = overlapResolution.centerY - ACTOR_HALF_SIZE;
      this.resetBlockedFrames(isPlayer);
      return {
        blocked: false,
        centerX: overlapResolution.centerX,
        centerY: overlapResolution.centerY
      };
    }

    this.incrementBlockedFrames(isPlayer);
    const blockedFrames = this.getBlockedFrames(isPlayer);

    if (blockedFrames > STUCK_ESCAPE_THRESHOLD) {
      const escapePrevCenterX = previousX + ACTOR_HALF_SIZE;
      const escapePrevCenterY = previousY + ACTOR_HALF_SIZE;
      const spiralResult = this.findSpiralEscapePosition(escapePrevCenterX, escapePrevCenterY);

      if (spiralResult !== null) {
        actorLogic.state.positionX = spiralResult.centerX - ACTOR_HALF_SIZE;
        actorLogic.state.positionY = spiralResult.centerY - ACTOR_HALF_SIZE;
        this.resetBlockedFrames(isPlayer);
        return {
          blocked: false,
          centerX: spiralResult.centerX,
          centerY: spiralResult.centerY
        };
      }
    }

    actorLogic.state.positionX = previousX;
    actorLogic.state.positionY = previousY;

    if (isPlayer) {
      this.state.lastCombatEvent = "MOVE BLOCKED";
    }

    return {
      blocked: true,
      centerX: previousX + ACTOR_HALF_SIZE,
      centerY: previousY + ACTOR_HALF_SIZE
    };
  }

  public resolveObstacleOverlap(targetBounds: Rect): { centerX: number; centerY: number } | null {
    const overlappingObstacles = this.getActiveObstacles().filter((obstacle) => intersectsRect(targetBounds, obstacle.bounds));

    if (overlappingObstacles.length === 0) {
      return null;
    }

    const targetCenterX = targetBounds.x + targetBounds.width / 2;
    const targetCenterY = targetBounds.y + targetBounds.height / 2;
    let bestCandidate: { centerX: number; centerY: number; translation: number } | null = null;

    for (const obstacle of overlappingObstacles) {
      const bounds = obstacle.bounds;
      const leftPush = bounds.x - (targetBounds.x + targetBounds.width) - OBSTACLE_CONTACT_EPSILON;
      const rightPush = bounds.x + bounds.width - targetBounds.x + OBSTACLE_CONTACT_EPSILON;
      const topPush = bounds.y - (targetBounds.y + targetBounds.height) - OBSTACLE_CONTACT_EPSILON;
      const bottomPush = bounds.y + bounds.height - targetBounds.y + OBSTACLE_CONTACT_EPSILON;

      const translations = [
        { x: leftPush, y: 0 },
        { x: rightPush, y: 0 },
        { x: 0, y: topPush },
        { x: 0, y: bottomPush },
        { x: leftPush, y: topPush },
        { x: rightPush, y: topPush },
        { x: leftPush, y: bottomPush },
        { x: rightPush, y: bottomPush }
      ];

      for (const translation of translations) {
        const candidateCenterX = Phaser.Math.Clamp(
          targetCenterX + translation.x,
          PLAYFIELD_MIN_X,
          PLAYFIELD_MAX_X
        );
        const candidateCenterY = Phaser.Math.Clamp(
          targetCenterY + translation.y,
          PLAYFIELD_MIN_Y,
          PLAYFIELD_MAX_Y
        );
        const candidateBounds = this.getActorCollisionBounds(candidateCenterX, candidateCenterY);

        if (this.getActiveObstacles().some((activeObstacle) => intersectsRect(candidateBounds, activeObstacle.bounds))) {
          continue;
        }

        const translationDistance = Math.abs(translation.x) + Math.abs(translation.y);
        if (bestCandidate === null || translationDistance < bestCandidate.translation) {
          bestCandidate = {
            centerX: candidateCenterX,
            centerY: candidateCenterY,
            translation: translationDistance
          };
        }
      }
    }

    if (bestCandidate === null) {
      return null;
    }

    return {
      centerX: bestCandidate.centerX,
      centerY: bestCandidate.centerY
    };
  }

  public findSpiralEscapePosition(originX: number, originY: number): { centerX: number; centerY: number } | null {
    const step = SPIRAL_SCAN_STEP_SIZE;
    let x = 0;
    let y = 0;
    let dx = step;
    let dy = 0;
    let segmentLength = 1;
    let segmentPassed = 0;
    let turnsMade = 0;

    for (let i = 0; i < SPIRAL_SCAN_MAX_STEPS; i++) {
      x += dx;
      y += dy;
      segmentPassed++;

      const candidateX = Phaser.Math.Clamp(
        originX + x,
        PLAYFIELD_MIN_X,
        PLAYFIELD_MAX_X
      );
      const candidateY = Phaser.Math.Clamp(
        originY + y,
        PLAYFIELD_MIN_Y,
        PLAYFIELD_MAX_Y
      );
      const candidateBounds = this.getActorCollisionBounds(candidateX, candidateY);

      if (!this.getActiveObstacles().some((obstacle) => intersectsRect(candidateBounds, obstacle.bounds))) {
        return { centerX: candidateX, centerY: candidateY };
      }

      if (segmentPassed === segmentLength) {
        segmentPassed = 0;
        const tempDx = dx;
        dx = -dy;
        dy = tempDx;
        turnsMade++;
        if (turnsMade % 2 === 0) {
          segmentLength++;
        }
      }
    }

    return null;
  }

  public resolveStaticActorCenter(
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic,
    targetCenterX: number,
    targetCenterY: number
  ): { x: number; y: number } {
    const clampedCenterX = Phaser.Math.Clamp(targetCenterX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X);
    const clampedCenterY = Phaser.Math.Clamp(targetCenterY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y);
    const targetBounds = this.getActorCollisionBounds(clampedCenterX, clampedCenterY);

    if (this.getActiveObstacles().some((obstacle) => intersectsRect(targetBounds, obstacle.bounds))) {
      return {
        x: sprite.x,
        y: sprite.y
      };
    }

    actorLogic.state.positionX = clampedCenterX - ACTOR_HALF_SIZE;
    actorLogic.state.positionY = clampedCenterY - ACTOR_HALF_SIZE;

    return {
      x: clampedCenterX,
      y: clampedCenterY
    };
  }

  private resetBlockedFrames(isPlayer: boolean): void {
    if (isPlayer) {
      this.state.playerConsecutiveBlockedFrames = 0;
      return;
    }

    this.state.dummyConsecutiveBlockedFrames = 0;
  }

  private incrementBlockedFrames(isPlayer: boolean): void {
    if (isPlayer) {
      this.state.playerConsecutiveBlockedFrames++;
      return;
    }

    this.state.dummyConsecutiveBlockedFrames++;
  }

  private getBlockedFrames(isPlayer: boolean): number {
    return isPlayer
      ? this.state.playerConsecutiveBlockedFrames
      : this.state.dummyConsecutiveBlockedFrames;
  }
}
