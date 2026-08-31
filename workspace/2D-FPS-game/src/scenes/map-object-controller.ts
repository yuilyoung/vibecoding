import Phaser from "phaser";
import { createCenteredRect, type Rect } from "../domain/collision/CollisionLogic";
import {
  createMapObject,
  damageMapObject,
  destroyMapObject,
  type MapObjectKind,
  type MapObjectState
} from "../domain/map/MapObjectLogic";
import {
  advanceMapObjects,
  type MapObjectActor,
  type MapObjectDrop,
  type MapObjectTeleport,
  type MapObjectTickResult
} from "../domain/map/MapObjectRuntime";
import type { StageMapObjectDefinition } from "../domain/map/StageContentDefinition";
import type { GameBalanceMapObjects } from "./scene-types";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { VfxController } from "./vfx-controller";
import type { CombatController } from "./combat-controller";
import { ACTOR_HALF_SIZE } from "./scene-constants";
import { getMapObjectVisual } from "../domain/visual/VisualAssetCatalog";
import type {
  WorldObjectPresentationHandle,
  WorldObjectPresentationPort
} from "./world-object-presentation-composition";
import type { PresentationEventPort } from "../domain/visual/PresentationEvent";

const BARREL_SIZE = 24;
const CRATE_SIZE = 20;
const MINE_RADIUS = 8;
const COVER_WIDTH = 48;
const COVER_HEIGHT = 16;
const BOUNCE_WALL_WIDTH = 48;
const BOUNCE_WALL_HEIGHT = 8;
const TELEPORTER_RADIUS = 24;

export interface MapObjectCollisionRect {
  readonly id: string;
  readonly kind: MapObjectKind;
  readonly rect: Rect;
  readonly state: MapObjectState;
}

export interface MapObjectDamageResult {
  readonly id: string;
  readonly before: MapObjectState;
  readonly after: MapObjectState;
  readonly destroyed: boolean;
}

export interface MapObjectDebugSummary {
  readonly total: number;
  readonly active: number;
  readonly destroyed: number;
  readonly drops: number;
  readonly typeBreakdown: Record<MapObjectKind, number>;
}

export interface MapObjectControllerDeps {
  readonly gameBalanceMapObjects: GameBalanceMapObjects;
  readonly rng?: () => number;
  readonly onObjectDamaged?: (result: MapObjectDamageResult) => void;
  readonly onObjectDestroyed?: (state: MapObjectState) => void;
  readonly onMineTriggered?: (id: string, state: MapObjectState | undefined) => void;
  readonly onDrop?: (drop: MapObjectDrop) => void;
  readonly onRuntimeAdvanced?: (result: MapObjectTickResult) => void;
}

interface ActorSpriteHandle {
  x: number;
  y: number;
  setPosition(x: number, y: number): unknown;
}

export interface MapObjectActorBinding {
  readonly id: string;
  readonly logic: PlayerLogic;
  readonly sprite: ActorSpriteHandle;
}

export interface MapObjectSideEffectsBinding {
  readonly actors: readonly MapObjectActorBinding[];
  readonly vfxController: VfxController;
  readonly combatController: CombatController;
  readonly runtimeState: SceneRuntimeState;
}

interface MapObjectView {
  state: MapObjectState;
  readonly sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  readonly visuals: readonly (Phaser.GameObjects.Shape | Phaser.GameObjects.Text)[];
  readonly statusLabel: Phaser.GameObjects.Text;
  readonly bounds: Rect;
  readonly blinkTween?: Phaser.Tweens.Tween;
  readonly presentationHandle: WorldObjectPresentationHandle | null;
}

export class MapObjectController {
  private readonly viewsById = new Map<string, MapObjectView>();
  private readonly emittedDropIds = new Set<string>();
  private sideEffects: MapObjectSideEffectsBinding | undefined;
  private presentation: WorldObjectPresentationPort | undefined;
  private presentationEvents: PresentationEventPort | undefined;
  private readonly presentationSequences = new Map<string, number>();

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: MapObjectControllerDeps
  ) {}

  public wireSideEffects(binding: MapObjectSideEffectsBinding): void {
    this.sideEffects = binding;
  }

  public wirePresentation(presentation: WorldObjectPresentationPort): void {
    if (this.presentation === presentation) return;
    if (this.presentation !== undefined) {
      for (const view of this.viewsById.values()) this.presentation.detach(view.presentationHandle);
    }
    this.presentation = presentation;
    this.presentation.initialize();
  }

  public wirePresentationEvents(events: PresentationEventPort | undefined): void {
    this.presentationEvents = events;
  }

  public advanceTick(now: number, dt: number): MapObjectTickResult {
    const binding = this.sideEffects;
    if (binding === undefined) {
      return this.advance(now, dt, []);
    }
    const actors = binding.actors.map((actor) => ({ id: actor.id, x: actor.sprite.x, y: actor.sprite.y }));
    const result = this.advance(now, dt, actors);
    this.handleMineTriggers(result.triggered, binding);
    this.handleDropEffects(result.drops, binding);
    this.handleTeleports(result.teleports, binding);
    return result;
  }

  private handleMineTriggers(triggeredIds: readonly string[], binding: MapObjectSideEffectsBinding): void {
    for (const id of triggeredIds) {
      const state = this.viewsById.get(id)?.state;
      if (state === undefined) {
        continue;
      }
      binding.vfxController.spawnImpactEffect(state.x, state.y, "grenade");
      binding.combatController.applyExplosionDamage(
        state.x,
        state.y,
        this.deps.gameBalanceMapObjects.mine.blastRadius,
        this.deps.gameBalanceMapObjects.mine.blastDamage,
        0,
        "player"
      );
    }
  }

  private handleDropEffects(drops: readonly MapObjectDrop[], binding: MapObjectSideEffectsBinding): void {
    for (const drop of drops) {
      binding.vfxController.spawnImpactEffect(drop.x, drop.y, drop.type === "ammo" ? "pickup-ammo" : "pickup-health");
      binding.runtimeState.lastCombatEvent = `${drop.type.toUpperCase()} DROP`;
    }
  }

  private handleTeleports(teleports: readonly MapObjectTeleport[], binding: MapObjectSideEffectsBinding): void {
    for (const teleport of teleports) {
      const actor = binding.actors.find((candidate) => candidate.id === teleport.actorId);
      if (actor !== undefined) {
        actor.logic.state.positionX = teleport.x - ACTOR_HALF_SIZE;
        actor.logic.state.positionY = teleport.y - ACTOR_HALF_SIZE;
        actor.sprite.setPosition(teleport.x, teleport.y);
      }
      binding.vfxController.spawnImpactEffect(teleport.x, teleport.y, "sniper");
      binding.runtimeState.lastCombatEvent = "TELEPORT";
    }
  }

  public applyMapObjects(definitions: readonly StageMapObjectDefinition[], now: number = this.scene.time.now): void {
    this.clear();

    for (const definition of definitions) {
      const state = createMapObject({
        id: definition.id,
        kind: definition.kind,
        x: definition.x,
        y: definition.y,
        hp: this.getHpForKind(definition.kind),
        armedAt: definition.kind === "mine" ? now + this.deps.gameBalanceMapObjects.mine.armDelayMs : undefined,
        angleDegrees: definition.angleDegrees,
        pairId: definition.pairId,
        reflectionsRemaining: definition.kind === "bounce-wall"
          ? this.deps.gameBalanceMapObjects.bounceWall.maxReflections
          : undefined,
        cooldownMs: definition.kind === "teleporter"
          ? this.deps.gameBalanceMapObjects.teleporter.cooldownMs
          : undefined
      });

      this.viewsById.set(state.id, this.createView(state));
    }
  }

  public advance(now: number, dt: number, actors: readonly MapObjectActor[]): MapObjectTickResult {
    const previousStates = new Map<string, MapObjectState>();
    const states = this.getStates();

    for (const state of states) {
      previousStates.set(state.id, state);
    }

    const result = advanceMapObjects(
      now,
      dt,
      actors,
      states,
      this.deps.gameBalanceMapObjects,
      this.deps.rng,
      this.sideEffects?.runtimeState.currentWeather
    );

    this.applyRuntimeStates(result.objects, previousStates, now);

    for (const triggeredId of result.triggered) {
      this.deps.onMineTriggered?.(triggeredId, this.viewsById.get(triggeredId)?.state);
    }

    const filteredDrops = result.drops.filter((drop) => {
      if (this.emittedDropIds.has(drop.id)) {
        return false;
      }

      this.emittedDropIds.add(drop.id);
      this.deps.onDrop?.(drop);
      return true;
    });

    const filteredResult: MapObjectTickResult = {
      objects: this.getStates(),
      triggered: result.triggered,
      drops: filteredDrops,
      teleports: result.teleports
    };

    this.deps.onRuntimeAdvanced?.(filteredResult);
    return filteredResult;
  }

  public getStates(): MapObjectState[] {
    return Array.from(this.viewsById.values(), (view) => view.state);
  }

  public getState(id: string): MapObjectState | undefined {
    return this.viewsById.get(id)?.state;
  }

  public getActiveCollisionRects(): MapObjectCollisionRect[] {
    return Array.from(this.viewsById.values())
      .filter((view) => view.state.active && view.state.kind !== "teleporter")
      .map((view) => ({
        id: view.state.id,
        kind: view.state.kind,
        rect: { ...view.bounds },
        state: view.state
      }));
  }

  public damageObject(id: string, damage: number): MapObjectDamageResult | null {
    const view = this.viewsById.get(id);

    if (view === undefined) {
      return null;
    }

    const before = view.state;
    const after = damageMapObject(before, damage);
    view.state = after;
    this.syncVisual(view);

    const result: MapObjectDamageResult = {
      id,
      before,
      after,
      destroyed: before.active && !after.active
    };

    this.deps.onObjectDamaged?.(result);
    if (result.destroyed) {
      this.publishBarrelEvent(after, "destroy");
      this.deps.onObjectDestroyed?.(after);
    } else if (before.active && before.hp !== after.hp) {
      this.publishBarrelEvent(after, "damage");
    }

    return result;
  }

  public destroyObject(id: string): MapObjectDamageResult | null {
    const view = this.viewsById.get(id);

    if (view === undefined) {
      return null;
    }

    const before = view.state;
    const after = destroyMapObject(before);
    view.state = after;
    this.syncVisual(view);

    const result: MapObjectDamageResult = {
      id,
      before,
      after,
      destroyed: before.active && !after.active
    };

    if (result.destroyed) {
      this.publishBarrelEvent(after, "destroy");
      this.deps.onObjectDestroyed?.(after);
    }

    return result;
  }

  public setObjectState(id: string, state: MapObjectState): MapObjectState | null {
    const view = this.viewsById.get(id);

    if (view === undefined) {
      return null;
    }

    const wasActive = view.state.active;
    view.state = state;
    this.syncVisual(view);

    if (wasActive && !state.active) {
      this.publishBarrelEvent(state, "destroy");
      this.deps.onObjectDestroyed?.(state);
    }

    return state;
  }

  public getDebugSummary(): MapObjectDebugSummary {
    const typeBreakdown: Record<MapObjectKind, number> = {
      barrel: 0,
      mine: 0,
      crate: 0,
      cover: 0,
      "bounce-wall": 0,
      teleporter: 0
    };
    let active = 0;
    let destroyed = 0;

    for (const view of this.viewsById.values()) {
      typeBreakdown[view.state.kind] += 1;

      if (view.state.active) {
        active += 1;
      } else {
        destroyed += 1;
      }
    }

    return {
      total: this.viewsById.size,
      active,
      destroyed,
      drops: this.emittedDropIds.size,
      typeBreakdown
    };
  }

  public clear(): void {
    for (const view of this.viewsById.values()) {
      view.blinkTween?.stop();
      this.presentation?.detach(view.presentationHandle);
      for (const visual of view.visuals) {
        visual.destroy();
      }
    }

    this.viewsById.clear();
    this.emittedDropIds.clear();
  }

  public destroy(): void {
    this.clear();
  }

  private applyRuntimeStates(
    states: readonly MapObjectState[],
    previousStates: ReadonlyMap<string, MapObjectState>,
    now: number
  ): void {
    for (const state of states) {
      const view = this.viewsById.get(state.id);

      if (view === undefined) {
        continue;
      }

      const previous = previousStates.get(state.id);
      view.state = state;
      this.syncVisual(view, now);

      if (previous?.active === true && !state.active) {
        this.publishBarrelEvent(state, "destroy");
        this.deps.onObjectDestroyed?.(state);
      }
    }
  }

  private publishBarrelEvent(state: MapObjectState, kind: "damage" | "destroy"): void {
    if (state.kind !== "barrel") return;
    const sequence = (this.presentationSequences.get(state.id) ?? 0) + 1;
    this.presentationSequences.set(state.id, sequence);
    this.presentationEvents?.publish({ subjectId: state.id, family: "barrel", kind, sequence, x: state.x, y: state.y });
  }

  private createView(state: MapObjectState): MapObjectView {
    const { sprite, visuals, statusLabel } = this.createSprite(state);
    const collisionSize = this.getCollisionSize(state);
    const bounds = createCenteredRect(state.x, state.y, collisionSize.width, collisionSize.height);
    const blinkTween = state.kind === "mine"
      ? this.scene.tweens.add({
        targets: sprite,
        alpha: 0.35,
        duration: 360,
        yoyo: true,
        repeat: -1
      })
      : undefined;

    const view = {
      state,
      sprite,
      visuals,
      statusLabel,
      bounds,
      blinkTween,
      presentationHandle: this.presentation?.attach(sprite, state.kind, state.id) ?? null
    };
    this.syncVisual(view);
    return view;
  }

  private createSprite(state: MapObjectState): {
    sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
    visuals: readonly (Phaser.GameObjects.Shape | Phaser.GameObjects.Text)[];
    statusLabel: Phaser.GameObjects.Text;
  } {
    const theme = getMapObjectVisual(state.kind);
    const createStatusLabel = (text = theme.glyph): Phaser.GameObjects.Text => this.scene.add.text(
      state.x,
      state.y,
      text,
      { fontFamily: "monospace", fontSize: "10px", fontStyle: "bold", color: `#${theme.accentColor.toString(16).padStart(6, "0")}` }
    ).setOrigin(0.5).setDepth(6);

    if (state.kind === "mine") {
      const shadow = this.scene.add.circle(state.x + 2, state.y + 3, MINE_RADIUS + 3, theme.shadowColor, 0.48).setDepth(3);
      const sprite = this.scene.add.circle(state.x, state.y, MINE_RADIUS, theme.fillColor, 0.96)
        .setStrokeStyle(2, theme.accentColor, 0.9)
        .setDepth(4);
      const core = this.scene.add.circle(state.x, state.y, 3, theme.accentColor, 0.9).setDepth(5);
      const statusLabel = createStatusLabel("…").setY(state.y - 16);
      return { sprite, visuals: [shadow, sprite, core, statusLabel], statusLabel };
    }

    if (state.kind === "crate") {
      const shadow = this.scene.add.rectangle(state.x + 3, state.y + 4, CRATE_SIZE + 4, CRATE_SIZE + 4, theme.shadowColor, 0.48).setDepth(3);
      const sprite = this.scene.add
        .rectangle(state.x, state.y, CRATE_SIZE, CRATE_SIZE, theme.fillColor, 1)
        .setStrokeStyle(2, theme.accentColor, 1)
        .setDepth(4);
      const band = this.scene.add.rectangle(state.x, state.y, CRATE_SIZE - 5, 4, theme.accentColor, 0.62).setDepth(5);
      const statusLabel = createStatusLabel();
      return { sprite, visuals: [shadow, sprite, band, statusLabel], statusLabel };
    }

    if (state.kind === "cover") {
      const shadow = this.scene.add.rectangle(state.x + 3, state.y + 4, COVER_WIDTH + 4, COVER_HEIGHT + 4, theme.shadowColor, 0.45).setDepth(3);
      const sprite = this.scene.add.rectangle(state.x, state.y, COVER_WIDTH, COVER_HEIGHT, theme.fillColor, 1)
        .setStrokeStyle(2, theme.accentColor, 0.9)
        .setDepth(4);
      const brace = this.scene.add.rectangle(state.x, state.y, 5, COVER_HEIGHT, theme.accentColor, 0.66).setDepth(5);
      const statusLabel = createStatusLabel();
      return { sprite, visuals: [shadow, sprite, brace, statusLabel], statusLabel };
    }

    if (state.kind === "bounce-wall") {
      const rotation = Phaser.Math.DegToRad(state.angleDegrees ?? 0);
      const shadow = this.scene.add.rectangle(state.x + 3, state.y + 4, BOUNCE_WALL_WIDTH + 4, BOUNCE_WALL_HEIGHT + 4, theme.shadowColor, 0.42)
        .setRotation(rotation)
        .setDepth(3);
      const sprite = this.scene.add
        .rectangle(state.x, state.y, BOUNCE_WALL_WIDTH, BOUNCE_WALL_HEIGHT, theme.fillColor, 1)
        .setStrokeStyle(2, theme.accentColor, 1)
        .setRotation(rotation)
        .setDepth(4);
      const energy = this.scene.add.rectangle(state.x, state.y, BOUNCE_WALL_WIDTH - 8, 2, theme.accentColor, 0.9)
        .setRotation(rotation)
        .setDepth(5);
      const statusLabel = createStatusLabel().setY(state.y - 13);
      return { sprite, visuals: [shadow, sprite, energy, statusLabel], statusLabel };
    }

    if (state.kind === "teleporter") {
      const shadow = this.scene.add.circle(state.x + 2, state.y + 4, TELEPORTER_RADIUS + 3, theme.shadowColor, 0.42).setDepth(3);
      const sprite = this.scene.add.circle(state.x, state.y, TELEPORTER_RADIUS, theme.fillColor, 0.32)
        .setStrokeStyle(3, theme.accentColor, 0.92)
        .setDepth(4);
      const core = this.scene.add.circle(state.x, state.y, TELEPORTER_RADIUS - 8, theme.accentColor, 0.12)
        .setStrokeStyle(1, theme.accentColor, 0.7)
        .setDepth(5);
      const statusLabel = createStatusLabel((state.pairId ?? "T").slice(-2).toUpperCase()).setFontSize(9);
      return { sprite, visuals: [shadow, sprite, core, statusLabel], statusLabel };
    }

    const shadow = this.scene.add.ellipse(state.x + 3, state.y + 4, BARREL_SIZE + 4, BARREL_SIZE - 2, theme.shadowColor, 0.5).setDepth(3);
    const sprite = this.scene.add.rectangle(state.x, state.y, BARREL_SIZE, BARREL_SIZE, theme.fillColor, 1)
      .setStrokeStyle(2, theme.accentColor, 0.92)
      .setDepth(4);
    const band = this.scene.add.rectangle(state.x, state.y, BARREL_SIZE, 5, theme.accentColor, 0.55).setDepth(5);
    const statusLabel = createStatusLabel();
    return { sprite, visuals: [shadow, sprite, band, statusLabel], statusLabel };
  }

  private syncVisual(view: MapObjectView, now: number = this.scene.time.now): void {
    if (this.presentation?.atlasActive === true && view.presentationHandle !== null) {
      for (const visual of view.visuals) visual.setVisible(false);
      this.presentation.sync(view.presentationHandle, {
        active: view.state.active,
        hp: view.state.hp,
        maxHp: this.getHpForKind(view.state.kind),
        now,
        armedAt: view.state.armedAt,
        reflectionsRemaining: view.state.reflectionsRemaining,
        cooldownUntil: view.state.cooldownUntil
      });
      return;
    }

    if (!view.state.active) {
      view.blinkTween?.pause();
      for (const visual of view.visuals) {
        visual.setVisible(true).setAlpha(0.16);
      }
      view.statusLabel.setText("×").setAlpha(0.62).setColor("#94a3b8");
      return;
    }

    for (const visual of view.visuals) {
      visual.setVisible(true);
      if (view.state.kind !== "mine") {
        visual.setAlpha(1);
      }
    }

    const theme = getMapObjectVisual(view.state.kind);
    if (view.state.kind === "mine") {
      const armed = now >= (view.state.armedAt ?? 0);
      view.statusLabel.setText(armed ? theme.glyph : "…").setColor(armed ? "#ffdf5d" : "#cbd5e1").setAlpha(1);
      if (armed && view.blinkTween?.isPaused()) {
        view.blinkTween.resume();
      } else if (!armed) {
        view.blinkTween?.pause();
        view.sprite.setAlpha(0.52);
      }
      return;
    }

    const maxHp = this.getHpForKind(view.state.kind);
    const hpRatio = maxHp === undefined || view.state.hp === undefined ? 1 : Phaser.Math.Clamp(view.state.hp / maxHp, 0, 1);
    view.sprite.setAlpha(0.42 + hpRatio * 0.58);
    view.statusLabel
      .setText(hpRatio < 1 ? `${Math.ceil(hpRatio * 100)}%` : theme.glyph)
      .setColor(`#${theme.accentColor.toString(16).padStart(6, "0")}`)
      .setAlpha(1);

    if (view.state.kind === "cover") {
      view.sprite.setStrokeStyle(2, hpRatio < 0.5 ? 0xff8a65 : theme.accentColor, 0.9);
    }
  }

  private getHpForKind(kind: MapObjectKind): number | undefined {
    if (kind === "barrel") {
      return this.deps.gameBalanceMapObjects.barrel.hp;
    }

    if (kind === "crate") {
      return this.deps.gameBalanceMapObjects.crate.hp;
    }

    if (kind === "cover") {
      return this.deps.gameBalanceMapObjects.cover.hp;
    }

    return undefined;
  }

  private getCollisionSize(state: MapObjectState): { width: number; height: number } {
    const kind = state.kind;
    if (kind === "barrel") {
      return { width: BARREL_SIZE, height: BARREL_SIZE };
    }

    if (kind === "crate") {
      return { width: CRATE_SIZE, height: CRATE_SIZE };
    }

    if (kind === "cover") {
      return { width: COVER_WIDTH, height: COVER_HEIGHT };
    }

    if (kind === "bounce-wall") {
      const isVertical = Math.abs((state.angleDegrees ?? 0) % 180) === 90;
      return {
        width: isVertical ? BOUNCE_WALL_HEIGHT : BOUNCE_WALL_WIDTH,
        height: isVertical ? BOUNCE_WALL_WIDTH : BOUNCE_WALL_HEIGHT
      };
    }

    if (kind === "teleporter") {
      return { width: TELEPORTER_RADIUS * 2, height: TELEPORTER_RADIUS * 2 };
    }

    return { width: MINE_RADIUS * 2, height: MINE_RADIUS * 2 };
  }
}
