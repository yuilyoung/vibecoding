import Phaser from "phaser";
import { createCenteredRect, intersectsRect } from "../domain/collision/CollisionLogic";
import { canApplyHazard, canPlayerUseCombatInteraction, isGateInteractionAllowed, type CombatAvailabilityInput } from "../domain/combat/CombatRuntime";
import { resolveHazardOutcome } from "../domain/combat/CombatResolution";
import { HazardZoneLogic } from "../domain/map/HazardZoneLogic";
import type { StagePickupDefinition } from "../domain/map/StageContentDefinition";
import type { StageContentSpawnPlan } from "../domain/map/StageContentSpawner";
import type { StageDefinition } from "../domain/map/StageDefinition";
import type { SoundCueEvent } from "../domain/audio/SoundCueLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { CoverEffectId, GameBalance, GateView, HazardZoneView, ImpactProfile, ObstacleView, PickupView, TerrainCrop } from "./scene-types";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { ActorCollisionResolver } from "./actor-collision";
import { addTerrainSurface } from "./arena-textures";
import {
  GATE_PANEL_KEY,
  OBSTACLE_BARRIER_KEY,
  OBSTACLE_CORE_KEY,
  OBSTACLE_TOWER_KEY,
  PICKUP_AMMO_KEY,
  PICKUP_HEALTH_KEY,
  VENT_PANEL_KEY,
} from "./scene-constants";

export interface StageGeometryMoveKeys {
  interact: Phaser.Input.Keyboard.Key;
}

export interface StageGeometryDeps {
  getCombatAvailability(now: number): CombatAvailabilityInput;
  moveKeys(): StageGeometryMoveKeys | undefined;
  activePointer(): Phaser.Input.Pointer;
  restockPlayerAmmo(now: number): void;
  isAmmoOverdriveActive(now: number): boolean;
  activateAmmoOverdrive(now: number): void;
  emitSoundCue(event: SoundCueEvent): void;
  spawnPickupFx(x: number, y: number, profile: Extract<ImpactProfile, "pickup-ammo" | "pickup-health">): void;
  registerPlayerRoundWin(now: number): void;
  registerDummyRoundWin(): void;
  scheduleResetAfterRound(now: number): void;
  getCoverEffectId(index: number): CoverEffectId;
  getCoverLabel(index: number): string;
  isCoverActive(index: number): boolean;
  shouldHighlightCover(): boolean;
  suppressPointerFireUntil(untilMs: number): void;
}

export interface StageGeometryStaticObjects {
  gate: GateView;
  hazardZone: HazardZoneView;
  ammoPickup: PickupView;
  healthPickup: PickupView;
}

export class StageGeometryManager {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly collisionResolver: ActorCollisionResolver,
    private readonly gameBalance: GameBalance,
    private readonly deps: StageGeometryDeps
  ) {}

  public createStaticRuntimeObjects(): StageGeometryStaticObjects {
    const gate = this.state.gate ?? this.addGate(482, 430, 96, 24, 0xffc15d, { x: 448, y: 0, width: 96, height: 256 });
    const hazardZone = this.state.hazardZone ?? this.addHazardZone(510, 138, 170, 46);
    this.state.gate = gate;
    this.state.hazardZone = hazardZone;
    this.addCoverPointMarkers();

    const ammoPickup = this.state.ammoPickup ?? this.createPickup(160, 430, PICKUP_AMMO_KEY, "AMMO", "#9adfff", this.gameBalance.ammoPickupAmount, this.gameBalance.ammoPickupRespawnMs);
    const healthPickup = this.state.healthPickup ?? this.createPickup(870, 430, PICKUP_HEALTH_KEY, "MED", "#aaf5d6", this.gameBalance.healthPickupAmount, this.gameBalance.healthPickupRespawnMs);
    this.state.ammoPickup = ammoPickup;
    this.state.healthPickup = healthPickup;

    return {
      gate,
      hazardZone,
      ammoPickup,
      healthPickup
    };
  }

  public applyStageGeometry(stage: StageDefinition): void {
    this.clearStageGeometry();

    for (const obstacle of stage.obstacles) {
      const view = this.addObstacle(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        this.getStageObstacleColor(obstacle.id),
        this.getStageObstacleCrop(obstacle.width, obstacle.height)
      );
      this.state.stageObstacleViews.push(view);
    }
  }

  public applyStageContent(plan: StageContentSpawnPlan): void {
    if (this.state.gate !== undefined) {
      const gateDefinition = plan.gates[0];
      if (gateDefinition !== undefined) {
        this.state.gate.sprite
          .setPosition(gateDefinition.x, gateDefinition.y)
          .setSize(gateDefinition.width, gateDefinition.height)
          .setDisplaySize(gateDefinition.width, gateDefinition.height);
        this.state.gate.bounds = createCenteredRect(
          gateDefinition.x,
          gateDefinition.y,
          gateDefinition.width,
          gateDefinition.height
        );
        this.state.gate.open = !gateDefinition.locked;
        this.state.gate.sprite.setAlpha(this.state.gate.open ? 0.22 : 1);
      }
    }

    if (this.state.hazardZone !== undefined) {
      const hazardDefinition = plan.hazards[0];
      if (hazardDefinition !== undefined) {
        this.state.hazardZone.sprite
          .setPosition(hazardDefinition.x, hazardDefinition.y)
          .setSize(hazardDefinition.width, hazardDefinition.height)
          .setDisplaySize(hazardDefinition.width, hazardDefinition.height);
        this.state.hazardZone.bounds = createCenteredRect(
          hazardDefinition.x,
          hazardDefinition.y,
          hazardDefinition.width,
          hazardDefinition.height
        );
        this.state.hazardZone.logic = new HazardZoneLogic(hazardDefinition.damage, hazardDefinition.tickMs);
      }
    }

    this.applyPickupContent(this.state.ammoPickup, this.findStagePickup(plan, "ammo"), "AMMO");
    this.applyPickupContent(this.state.healthPickup, this.findStagePickup(plan, "health"), "MED");
  }

  public clearStageGeometry(): void {
    for (const obstacle of this.state.stageObstacleViews) {
      for (const visual of obstacle.visuals ?? []) {
        visual.destroy();
      }
      obstacle.sprite.destroy();
      const obstacleIndex = this.state.obstacles.indexOf(obstacle);
      if (obstacleIndex >= 0) {
        this.state.obstacles.splice(obstacleIndex, 1);
      }
    }

    this.state.stageObstacleViews.length = 0;
  }

  public handlePointerGateInteraction(now: number): void {
    if (!canPlayerUseCombatInteraction(this.deps.getCombatAvailability(now))) {
      return;
    }

    const playerSprite = this.requirePlayerSprite();
    const gate = this.requireGate();
    const playerDistanceToGate = Phaser.Math.Distance.Between(
      playerSprite.x,
      playerSprite.y,
      gate.sprite.x,
      gate.sprite.y
    );

    if (now < this.state.nextGateInteractionAtMs || !isGateInteractionAllowed(playerDistanceToGate, 92)) {
      return;
    }

    this.applyGateToggle();
    this.state.nextGateInteractionAtMs = now + 500;
    this.deps.suppressPointerFireUntil(now + 1000);
    this.deps.emitSoundCue({ kind: "gate", action: gate.open ? "open" : "close" });
  }

  public handleGateInteraction(now: number): void {
    const moveKeys = this.deps.moveKeys();
    if (moveKeys === undefined || !canPlayerUseCombatInteraction(this.deps.getCombatAvailability(now))) {
      return;
    }

    const playerSprite = this.requirePlayerSprite();
    const gate = this.requireGate();
    const pointer = this.deps.activePointer();
    const distanceToGate = Phaser.Math.Distance.Between(
      playerSprite.x,
      playerSprite.y,
      gate.sprite.x,
      gate.sprite.y
    );
    const pointerDistanceToGate = Phaser.Math.Distance.Between(
      pointer.worldX,
      pointer.worldY,
      gate.sprite.x,
      gate.sprite.y
    );
    const interactionPressed = Phaser.Input.Keyboard.JustDown(moveKeys.interact) || moveKeys.interact.isDown;
    const pointerPressedGate = pointer.leftButtonDown() && pointerDistanceToGate <= 36;

    if (now < this.state.nextGateInteractionAtMs || (!interactionPressed && !pointerPressedGate)) {
      return;
    }

    if (!pointerPressedGate && !isGateInteractionAllowed(distanceToGate, 92)) {
      this.state.lastCombatEvent = "GATE TOO FAR";
      return;
    }

    this.applyGateToggle();
    this.state.nextGateInteractionAtMs = now + 500;
    this.deps.suppressPointerFireUntil(now + 1000);
    this.deps.emitSoundCue({ kind: "gate", action: gate.open ? "open" : "close" });
  }

  public toggleGate(): void {
    this.applyGateToggle();
  }

  public updateHazards(now: number): void {
    if (!canApplyHazard(this.deps.getCombatAvailability(now))) {
      return;
    }

    this.applyHazardToActor("player", this.requirePlayerSprite(), this.state.playerLogic, now);
    this.applyHazardToActor("dummy", this.requireTargetDummy(), this.state.dummyLogic, now);
  }

  public handleAmmoPickup(now: number): void {
    const pickup = this.requireAmmoPickup();
    this.updatePickupAvailability(pickup, now);

    if (!pickup.available || this.state.playerLogic.isDead() || !this.deps.getCombatAvailability(now).isCombatLive || this.deps.getCombatAvailability(now).isMatchOver) {
      return;
    }

    const playerSprite = this.requirePlayerSprite();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(playerSprite.getBounds(), pickup.sprite.getBounds())) {
      return;
    }

    this.deps.restockPlayerAmmo(now);
    this.deps.activateAmmoOverdrive(now);
    pickup.available = false;
    pickup.respawnAtMs = now + pickup.respawnMs;
    pickup.sprite.setVisible(false);
    pickup.label.setVisible(false);
    this.deps.spawnPickupFx(playerSprite.x, playerSprite.y, "pickup-ammo");
    this.deps.spawnPickupFx(pickup.sprite.x, pickup.sprite.y, "pickup-ammo");
    this.state.lastCombatEvent = "AMMO OVERDRIVE";
    this.deps.emitSoundCue({ kind: "pickup", pickupId: "ammo" });
  }

  public handleHealthPickup(now: number): void {
    const pickup = this.requireHealthPickup();
    this.updatePickupAvailability(pickup, now);

    if (!pickup.available || this.state.playerLogic.isDead() || !this.deps.getCombatAvailability(now).isCombatLive || this.deps.getCombatAvailability(now).isMatchOver) {
      return;
    }

    const playerSprite = this.requirePlayerSprite();
    if (!Phaser.Geom.Intersects.RectangleToRectangle(playerSprite.getBounds(), pickup.sprite.getBounds())) {
      return;
    }

    const restoredHealth = this.state.playerLogic.heal(pickup.amount);

    if (restoredHealth === 0) {
      return;
    }

    pickup.available = false;
    pickup.respawnAtMs = now + pickup.respawnMs;
    pickup.sprite.setVisible(false);
    pickup.label.setVisible(false);
    this.deps.spawnPickupFx(playerSprite.x, playerSprite.y, "pickup-health");
    this.state.lastCombatEvent = `HEAL +${restoredHealth}`;
    this.deps.emitSoundCue({ kind: "pickup", pickupId: "health" });
  }

  public resetPickupState(): void {
    this.resetPickup(this.requireAmmoPickup());
    this.resetPickup(this.requireHealthPickup());
  }

  public resetHazardState(): void {
    this.requireHazardZone().logic.reset();
  }

  public updatePickupVisuals(now: number): void {
    const ammoPickup = this.requireAmmoPickup();
    const healthPickup = this.requireHealthPickup();
    const ammoBob = Math.sin(now / 150) * 3;
    const healthBob = Math.cos(now / 170) * 3;
    ammoPickup.sprite.setY(ammoPickup.baseY + ammoBob);
    ammoPickup.label.setY(ammoPickup.baseY - 26 + ammoBob);
    healthPickup.sprite.setY(healthPickup.baseY + healthBob);
    healthPickup.label.setY(healthPickup.baseY - 26 + healthBob);
    ammoPickup.sprite.setScale(ammoPickup.available ? 1.08 + Math.sin(now / 120) * 0.04 : 1);
    healthPickup.sprite.setScale(healthPickup.available ? 1.08 + Math.cos(now / 130) * 0.04 : 1);
    ammoPickup.label.setAlpha(ammoPickup.available ? 0.88 : 0.2);
    healthPickup.label.setAlpha(healthPickup.available ? 0.88 : 0.2);
  }

  public updateCoverPointVisuals(now: number): void {
    const highlightCover = this.deps.shouldHighlightCover();
    const pulse = 0.88 + Math.sin(now / 140) * 0.08;

    for (let index = 0; index < this.state.coverPointViews.length; index += 1) {
      const view = this.state.coverPointViews[index];
      const activeCover = this.deps.isCoverActive(index);
      const baseColor = this.deps.getCoverEffectId(index) === "vision-jam"
        ? 0xa78bfa
        : this.deps.getCoverEffectId(index) === "shield"
          ? 0x38bdf8
          : 0x34d399;
      const activeColor = this.deps.getCoverEffectId(index) === "vision-jam"
        ? 0xc4b5fd
        : this.deps.getCoverEffectId(index) === "shield"
          ? 0x7dd3fc
          : 0x86efac;

      view.sprite.setFillStyle(activeCover ? activeColor : highlightCover ? 0xfde68a : baseColor, activeCover ? 0.4 : highlightCover ? 0.34 : 0.18);
      view.sprite.setStrokeStyle(1, activeCover ? activeColor : highlightCover ? 0xfacc15 : baseColor, activeCover ? 0.98 : highlightCover ? 0.95 : 0.65);
      view.label.setText(this.deps.getCoverLabel(index));
      view.label.setColor(activeCover ? "#f8fafc" : highlightCover ? "#fde68a" : "#dbeafe");
      view.label.setAlpha(activeCover ? 0.98 : highlightCover ? 0.95 : 0.7);
      view.sprite.setScale(activeCover ? pulse * 1.06 : highlightCover ? pulse : 1);
    }
  }

  public getPickupStatus(now: number): string {
    if (this.deps.isAmmoOverdriveActive(now)) {
      return `LIVE ${Math.ceil((this.state.playerUnlimitedAmmoUntilMs - now) / 1000)}S`;
    }

    const pickup = this.requireAmmoPickup();
    if (pickup.available) {
      return "READY";
    }

    if (pickup.respawnAtMs === null) {
      return "OFF";
    }

    return Math.max(0, pickup.respawnAtMs - now).toFixed(0);
  }

  public getHealthPickupStatus(now: number): string {
    const pickup = this.requireHealthPickup();
    if (pickup.available) {
      return "READY";
    }

    if (pickup.respawnAtMs === null) {
      return "OFF";
    }

    return Math.max(0, pickup.respawnAtMs - now).toFixed(0);
  }

  public getGateOpen(): boolean {
    return this.state.gate?.open ?? false;
  }

  public getActiveObstacles(): ObstacleView[] {
    return this.collisionResolver.getActiveObstacles();
  }

  private findStagePickup(plan: StageContentSpawnPlan, kind: StagePickupDefinition["kind"]): StagePickupDefinition | undefined {
    return plan.pickups.find((pickup) => pickup.kind === kind);
  }

  private applyPickupContent(pickup: PickupView | undefined, definition: StagePickupDefinition | undefined, fallbackLabel: string): void {
    if (pickup === undefined || definition === undefined) {
      return;
    }

    pickup.baseX = definition.x;
    pickup.baseY = definition.y;
    pickup.amount = definition.amount;
    pickup.respawnMs = definition.respawnMs;
    pickup.sprite.setPosition(definition.x, definition.y);
    pickup.label
      .setText(definition.kind === "ammo" ? "AMMO" : definition.kind === "health" ? "MED" : fallbackLabel)
      .setPosition(definition.x, definition.y - 26);
  }

  private getStageObstacleColor(obstacleId: string): number {
    if (obstacleId.includes("tower") || obstacleId.includes("relay")) {
      return 0x6bb6ff;
    }

    if (obstacleId.includes("barrier") || obstacleId.includes("crate")) {
      return 0x7fd174;
    }

    if (obstacleId.includes("lock") || obstacleId.includes("drain")) {
      return 0xb49cff;
    }

    return 0xe0a54f;
  }

  private getStageObstacleCrop(width: number, height: number): TerrainCrop {
    if (width > 140) {
      return { x: 768, y: 320, width: 96, height: 96 };
    }

    if (height > width) {
      return { x: 448, y: 0, width: 96, height: 256 };
    }

    return { x: 792, y: 64, width: 64, height: 64 };
  }

  private addObstacle(x: number, y: number, width: number, height: number, color: number, crop?: TerrainCrop): ObstacleView {
    const visualKey = width > 140 ? OBSTACLE_BARRIER_KEY : height > width ? OBSTACLE_TOWER_KEY : OBSTACLE_CORE_KEY;
    const visuals: Phaser.GameObjects.GameObject[] = [];
    visuals.push(this.scene.add.rectangle(x + 6, y + 8, width, height, 0x0c1420, 0.26).setDepth(2));
    if (crop !== undefined) {
      visuals.push(addTerrainSurface(this.scene, x, y, width, height, crop, 0.92, 2));
    }
    visuals.push(this.scene.add.image(x, y, visualKey).setDisplaySize(width, height).setDepth(3).setAlpha(0.96));
    const sprite = this.scene.add
      .rectangle(x, y, width, height, color, crop === undefined ? 0.14 : 0.08)
      .setStrokeStyle(3, 0xffffff, crop === undefined ? 0.18 : 0.12)
      .setDepth(4);
    const obstacle = {
      sprite,
      bounds: createCenteredRect(x, y, width, height),
      visuals
    };
    this.state.obstacles.push(obstacle);
    return obstacle;
  }

  private addGate(x: number, y: number, width: number, height: number, color: number, crop?: TerrainCrop): GateView {
    this.scene.add.rectangle(x + 5, y + 6, width, height, 0x0c1420, 0.22).setDepth(2);
    if (crop !== undefined) {
      addTerrainSurface(this.scene, x, y, width, height, crop, 0.9, 2);
    }
    this.scene.add.image(x, y, GATE_PANEL_KEY).setDisplaySize(width, height).setDepth(3).setAlpha(0.95);
    const sprite = this.scene.add
      .rectangle(x, y, width, height, color, crop === undefined ? 0.12 : 0.08)
      .setStrokeStyle(3, 0xffffff, crop === undefined ? 0.24 : 0.16)
      .setDepth(4);
    const gate = {
      id: "service-gate",
      sprite,
      bounds: createCenteredRect(x, y, width, height),
      open: false
    };
    this.state.obstacles.push(gate);
    return gate;
  }

  private addHazardZone(x: number, y: number, width: number, height: number): HazardZoneView {
    this.scene.add.image(x, y, VENT_PANEL_KEY).setDisplaySize(width, height).setDepth(2).setAlpha(0.92);
    const sprite = this.scene.add
      .rectangle(x, y, width, height, 0xc34cff, 0.26)
      .setStrokeStyle(3, 0xffffff, 0.42)
      .setDepth(3);

    this.scene.add
      .text(x, y, "VENT", {
        color: "#f5d0fe",
        fontFamily: "monospace",
        fontSize: "12px"
      })
      .setOrigin(0.5)
      .setAlpha(0.82);

    return {
      sprite,
      bounds: createCenteredRect(x, y, width, height),
      logic: new HazardZoneLogic(this.gameBalance.hazardDamage, this.gameBalance.hazardTickMs)
    };
  }

  private addCoverPointMarkers(): void {
    if (this.state.coverPointViews.length > 0) {
      return;
    }

    for (const coverPoint of this.state.dummyCoverPoints) {
      const sprite = this.scene.add
        .circle(coverPoint.x, coverPoint.y, this.gameBalance.coverPointRadius, 0x4dc7ff, 0.22)
        .setStrokeStyle(3, 0xffffff, 0.72);
      const label = this.scene.add
        .text(coverPoint.x, coverPoint.y - this.gameBalance.coverPointRadius - 10, "COVER", {
          color: "#e6f7ff",
          fontFamily: "monospace",
          fontSize: "10px"
        })
        .setOrigin(0.5)
        .setAlpha(0.7);

      this.state.coverPointViews.push({ sprite, label });
    }
  }

  private createPickup(
    x: number,
    y: number,
    textureKey: string,
    labelText: string,
    labelColor: string,
    amount: number,
    respawnMs: number
  ): PickupView {
    return {
      sprite: this.scene.add.image(x, y, textureKey).setScale(0.44).setDepth(4),
      label: this.scene.add.text(x, y - 26, labelText, {
        color: labelColor,
        fontFamily: "monospace",
        fontSize: "10px"
      }).setOrigin(0.5).setAlpha(0.8),
      available: true,
      respawnAtMs: null,
      baseX: x,
      baseY: y,
      amount,
      respawnMs
    };
  }

  private applyGateToggle(): void {
    const gate = this.requireGate();
    gate.open = !gate.open;
    gate.sprite.setAlpha(gate.open ? 0.22 : 1);
    gate.sprite.setFillStyle(gate.open ? 0x6a7f91 : 0xf4a261, gate.open ? 0.22 : 1);
    this.state.lastCombatEvent = gate.open ? "GATE OPENED" : "GATE CLOSED";
  }

  private applyHazardToActor(
    actorId: "player" | "dummy",
    sprite: Phaser.GameObjects.Image,
    actorLogic: PlayerLogic,
    now: number
  ): void {
    if (actorLogic.isDead()) {
      return;
    }

    const overlapping = intersectsRect(
      this.collisionResolver.getActorCollisionBounds(sprite.x, sprite.y),
      this.requireHazardZone().bounds
    );
    const tick = this.requireHazardZone().logic.tick(actorId, overlapping, now);

    if (!tick.triggered) {
      return;
    }

    actorLogic.takeDamage(tick.damage, Math.floor(this.gameBalance.hitStunMs / 2), now);
    const hazardResolution = resolveHazardOutcome({
      actorId,
      triggered: tick.triggered,
      damage: tick.damage,
      actorDied: actorLogic.isDead()
    });

    if (hazardResolution.combatEvent !== null) {
      this.state.lastCombatEvent = hazardResolution.combatEvent;
    }

    this.deps.emitSoundCue({ kind: "hazard", source: "vent" });

    if (hazardResolution.roundWinner === null) {
      return;
    }

    if (hazardResolution.roundWinner === "DUMMY") {
      this.deps.registerDummyRoundWin();
    } else {
      this.deps.registerPlayerRoundWin(now);
    }

    this.deps.scheduleResetAfterRound(now);
  }

  private updatePickupAvailability(pickup: PickupView, now: number): void {
    if (pickup.available || pickup.respawnAtMs === null || now < pickup.respawnAtMs) {
      return;
    }

    pickup.available = true;
    pickup.respawnAtMs = null;
    pickup.sprite.setVisible(true);
    pickup.label.setVisible(true);
  }

  private resetPickup(pickup: PickupView): void {
    pickup.available = true;
    pickup.respawnAtMs = null;
    pickup.sprite.setVisible(true);
    pickup.label.setVisible(true);
  }

  private requireGate(): GateView {
    if (this.state.gate === undefined) {
      throw new Error("StageGeometryManager gate used before createStaticRuntimeObjects().");
    }

    return this.state.gate;
  }

  private requireHazardZone(): HazardZoneView {
    if (this.state.hazardZone === undefined) {
      throw new Error("StageGeometryManager hazard zone used before createStaticRuntimeObjects().");
    }

    return this.state.hazardZone;
  }

  private requireAmmoPickup(): PickupView {
    if (this.state.ammoPickup === undefined) {
      throw new Error("StageGeometryManager ammo pickup used before createStaticRuntimeObjects().");
    }

    return this.state.ammoPickup;
  }

  private requireHealthPickup(): PickupView {
    if (this.state.healthPickup === undefined) {
      throw new Error("StageGeometryManager health pickup used before createStaticRuntimeObjects().");
    }

    return this.state.healthPickup;
  }

  private requirePlayerSprite(): Phaser.GameObjects.Image {
    if (this.state.playerSprite === undefined) {
      throw new Error("StageGeometryManager player sprite used before MainScene.create().");
    }

    return this.state.playerSprite;
  }

  private requireTargetDummy(): Phaser.GameObjects.Image {
    if (this.state.targetDummy === undefined) {
      throw new Error("StageGeometryManager dummy sprite used before MainScene.create().");
    }

    return this.state.targetDummy;
  }
}
