import Phaser from "phaser";
import { DummyAiLogic, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import {
  ACTOR_HALF_SIZE,
  BODY_TURN_RATE,
  PLAYFIELD_MAX_X,
  PLAYFIELD_MAX_Y,
  PLAYFIELD_MIN_X,
  PLAYFIELD_MIN_Y,
} from "./scene-constants";
import type { ActorCollisionResolver } from "./actor-collision";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { CoverEffectId } from "./scene-types";

export interface DummyActorControllerDeps {
  readonly dummyAiLogic: DummyAiLogic;
  readonly isCombatLive: (now: number) => boolean;
  readonly isMatchOver: () => boolean;
  readonly getPreferredDummyWeaponId: () => string;
  readonly getActorRotation: (angleRadians: number) => number;
  readonly emitMovementFxForActor: (actor: "dummy", now: number, throttleInput: number) => void;
  readonly coverPointRadius: number;
}

export class DummyActorController {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly collisionResolver: ActorCollisionResolver,
    private readonly deps: DummyActorControllerDeps
  ) {}

  public updateMovement(deltaSeconds: number, now: number): void {
    const targetDummy = this.requireTargetDummy();
    const playerSprite = this.requirePlayerSprite();

    if (
      this.state.dummyLogic.isDead() ||
      this.state.playerLogic.isDead() ||
      this.deps.isMatchOver() ||
      !this.deps.isCombatLive(now)
    ) {
      this.state.dummyLogic.move(
        { x: 0, y: 0, sprint: false },
        deltaSeconds,
        now,
        this.state.currentWeather.movementMultiplier
      );
      return;
    }

    const previousX = this.state.dummyLogic.state.positionX;
    const previousY = this.state.dummyLogic.state.positionY;
    const decision = this.deps.dummyAiLogic.evaluate({
      dummyX: targetDummy.x,
      dummyY: targetDummy.y,
      playerX: playerSprite.x,
      playerY: playerSprite.y,
      tickMs: now,
      currentHealth: this.state.dummyLogic.state.health,
      playerHealthRatio: this.state.playerLogic.state.health / this.state.playerLogic.state.maxHealth,
      healthRatio: this.state.dummyLogic.state.health / this.state.dummyLogic.state.maxHealth,
      coverPoints: this.state.dummyCoverPoints,
      lineOfSightBlockers: this.collisionResolver.getActiveObstacles().map((obstacle) => obstacle.bounds),
      hazardZones: [{
        ...this.requireHazardZone().bounds,
        padding: 26
      }]
    });
    const desiredSteer = now < this.state.dummySteerLockUntilMs
      ? {
          moveX: this.state.lastDummySteerX,
          moveY: this.state.lastDummySteerY
        }
      : this.stabilizeDummySteer(decision.moveX, decision.moveY);
    this.updateBodyAngle(desiredSteer.moveX, desiredSteer.moveY, deltaSeconds);

    this.state.currentDummyWeaponId = this.deps.getPreferredDummyWeaponId();
    this.state.lastDummyDecision = decision.mode;
    this.state.lastDummyShouldFire = decision.shouldFire;
    this.updateIntentEvent(decision);
    this.state.dummyLogic.move(
      {
        x: desiredSteer.moveX,
        y: desiredSteer.moveY,
        sprint: false
      },
      deltaSeconds,
      now,
      this.state.currentWeather.movementMultiplier
    );
    this.state.dummyLogic.updateAim(playerSprite.x - ACTOR_HALF_SIZE, playerSprite.y - ACTOR_HALF_SIZE, now);

    let dummyCenterX = Phaser.Math.Clamp(
      this.state.dummyLogic.state.positionX + ACTOR_HALF_SIZE,
      PLAYFIELD_MIN_X,
      PLAYFIELD_MAX_X
    );
    let dummyCenterY = Phaser.Math.Clamp(
      this.state.dummyLogic.state.positionY + ACTOR_HALF_SIZE,
      PLAYFIELD_MIN_Y,
      PLAYFIELD_MAX_Y
    );
    const collision = this.collisionResolver.resolveActorObstacleCollision(
      dummyCenterX,
      dummyCenterY,
      previousX,
      previousY,
      this.state.dummyLogic
    );
    const blocked = collision.blocked;
    dummyCenterX = collision.centerX;
    dummyCenterY = collision.centerY;

    if (blocked) {
      const blockedSteer = this.createBlockedSteer();
      this.state.lastDummySteerX = blockedSteer.moveX;
      this.state.lastDummySteerY = blockedSteer.moveY;
      this.state.dummySteerLockUntilMs = now + 220;
      dummyCenterX = previousX + ACTOR_HALF_SIZE;
      dummyCenterY = previousY + ACTOR_HALF_SIZE;
      this.state.lastDummyDecision = "strafe";
    }

    targetDummy.setPosition(dummyCenterX, dummyCenterY);
    targetDummy.setRotation(this.deps.getActorRotation(this.state.dummyBodyAngle));
    this.deps.emitMovementFxForActor("dummy", now, this.state.dummyLogic.state.lastAppliedSpeed > 0 ? 1 : 0);
  }

  public updateCoverState(now: number): void {
    const targetDummy = this.requireTargetDummy();
    const coverIndex = this.getActiveCoverIndexForActor(targetDummy.x, targetDummy.y);
    const inCoverNow = coverIndex !== null;

    if (inCoverNow && !this.state.dummyInCover) {
      this.state.dummyCoverBonusUntilMs = now + 1400;
      this.state.lastCombatEvent = this.getCoverEnterEvent(coverIndex);
    }

    this.state.dummyInCover = inCoverNow;
    this.state.activeDummyCoverIndex = coverIndex;

    if (
      coverIndex !== null &&
      this.getCoverEffectId(coverIndex) === "repair" &&
      now >= this.state.nextDummyRepairTickAtMs &&
      !this.state.dummyLogic.isDead()
    ) {
      const restored = this.state.dummyLogic.heal(2);
      this.state.nextDummyRepairTickAtMs = now + 280;

      if (restored > 0) {
        this.state.lastCombatEvent = `COVER REPAIR +${restored}`;
      }
    }
  }

  public hasCoverProtection(now: number): boolean {
    return this.state.activeDummyCoverIndex !== null && this.getCoverEffectId(this.state.activeDummyCoverIndex) === "shield"
      ? true
      : now < this.state.dummyCoverBonusUntilMs &&
          this.state.activeDummyCoverIndex !== null &&
          this.getCoverEffectId(this.state.activeDummyCoverIndex) === "shield";
  }

  public isActorInsideCoverZone(centerX: number, centerY: number): boolean {
    return this.getActiveCoverIndexForActor(centerX, centerY) !== null;
  }

  public getActiveCoverIndexForActor(centerX: number, centerY: number): number | null {
    const coverRadius = this.deps.coverPointRadius + 10;

    for (let index = 0; index < this.state.dummyCoverPoints.length; index += 1) {
      const coverPoint = this.state.dummyCoverPoints[index];
      if (Math.hypot(coverPoint.x - centerX, coverPoint.y - centerY) <= coverRadius) {
        return index;
      }
    }

    return null;
  }

  public getCoverEffectId(index: number): CoverEffectId {
    switch (index) {
      case 0:
        return "vision-jam";
      case 1:
        return "shield";
      default:
        return "repair";
    }
  }

  public getCoverLabel(index: number): string {
    switch (this.getCoverEffectId(index)) {
      case "vision-jam":
        return "VISION JAM";
      case "shield":
        return "SHIELD COVER";
      case "repair":
        return "REPAIR COVER";
    }
  }

  public getCoverEnterEvent(index: number | null): string {
    if (index === null) {
      return "DUMMY TOOK COVER";
    }

    switch (this.getCoverEffectId(index)) {
      case "vision-jam":
        return "DUMMY ACTIVATED VISION JAM";
      case "shield":
        return "DUMMY ACTIVATED SHIELD COVER";
      case "repair":
        return "DUMMY ACTIVATED REPAIR COVER";
    }
  }

  public shouldHighlightCover(): boolean {
    return this.state.lastDummyDecision === "cover" || this.state.lastDummyDecision === "reposition";
  }

  private stabilizeDummySteer(moveX: number, moveY: number): { moveX: number; moveY: number } {
    const blend = 0.28;
    const blendedX = Phaser.Math.Linear(this.state.lastDummySteerX, moveX, blend);
    const blendedY = Phaser.Math.Linear(this.state.lastDummySteerY, moveY, blend);
    const length = Math.hypot(blendedX, blendedY) || 1;

    this.state.lastDummySteerX = blendedX / length;
    this.state.lastDummySteerY = blendedY / length;
    this.state.dummySteerLockUntilMs = 0;

    return {
      moveX: this.state.lastDummySteerX,
      moveY: this.state.lastDummySteerY
    };
  }

  private createBlockedSteer(): { moveX: number; moveY: number } {
    const targetDummy = this.requireTargetDummy();
    const playerSprite = this.requirePlayerSprite();
    const deltaX = playerSprite.x - targetDummy.x;
    const deltaY = playerSprite.y - targetDummy.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const side = Math.floor(this.scene.time.now / 900) % 2 === 0 ? 1 : -1;

    return {
      moveX: -directionY * side,
      moveY: directionX * side
    };
  }

  private updateIntentEvent(decision: DummyAiDecision): void {
    const intentKey = `${decision.mode}:${decision.shouldFire}`;

    if (intentKey === this.state.lastDummyIntentKey) {
      return;
    }

    this.state.lastDummyIntentKey = intentKey;
    const nextEvent = this.getDummyIntentEvent(decision);

    if (nextEvent !== null) {
      this.state.lastCombatEvent = nextEvent;
    }
  }

  private getDummyIntentEvent(decision: DummyAiDecision): string | null {
    if (decision.mode === "cover") {
      if (decision.shouldFire) {
        return this.state.dummyInCover ? "DUMMY PEEKING FROM COVER" : "DUMMY HOLDING ANGLE";
      }

      return this.state.dummyInCover ? "DUMMY HOLDING COVER" : "DUMMY SETTING COVER";
    }

    if (decision.mode === "flank") {
      return this.state.dummyInCover ? "DUMMY RE-ENGAGING" : "DUMMY FLANKING";
    }

    if (decision.mode === "reposition") {
      return "DUMMY SHIFTING ANGLE";
    }

    if (decision.mode === "retreat" && decision.shouldFire) {
      return "DUMMY FALLING BACK";
    }

    if (decision.mode === "avoid-hazard") {
      return "DUMMY EVADING HAZARD";
    }

    return null;
  }

  private updateBodyAngle(moveX: number, moveY: number, deltaSeconds: number): void {
    if (moveX === 0 && moveY === 0) {
      return;
    }

    const desiredMoveAngle = Math.atan2(moveY, moveX);
    this.state.dummyBodyAngle = rotateAngleTowards(
      this.state.dummyBodyAngle,
      resolveHullAngle(this.state.dummyBodyAngle, desiredMoveAngle),
      BODY_TURN_RATE * deltaSeconds
    );
  }

  private requirePlayerSprite(): Phaser.GameObjects.Image {
    if (this.state.playerSprite === undefined) {
      throw new Error("DummyActorController player sprite used before MainScene.create().");
    }

    return this.state.playerSprite;
  }

  private requireTargetDummy(): Phaser.GameObjects.Image {
    if (this.state.targetDummy === undefined) {
      throw new Error("DummyActorController dummy sprite used before MainScene.create().");
    }

    return this.state.targetDummy;
  }

  private requireHazardZone() {
    if (this.state.hazardZone === undefined) {
      throw new Error("DummyActorController hazard zone used before StageGeometryManager.createStaticRuntimeObjects().");
    }

    return this.state.hazardZone;
  }
}

export function resolveHullAngle(currentHullAngle: number, desiredMoveAngle: number): number {
  const forwardDelta = Phaser.Math.Angle.Wrap(desiredMoveAngle - currentHullAngle);
  if (Math.abs(forwardDelta) <= Math.PI / 2) {
    return desiredMoveAngle;
  }

  return Phaser.Math.Angle.Wrap(desiredMoveAngle + Math.PI);
}

export function rotateAngleTowards(current: number, target: number, maxStep: number): number {
  const delta = Phaser.Math.Angle.Wrap(target - current);

  if (Math.abs(delta) <= maxStep) {
    return target;
  }

  return current + Math.sign(delta) * maxStep;
}
