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
  type MapObjectTickResult
} from "../domain/map/MapObjectRuntime";
import type { StageMapObjectDefinition } from "../domain/map/StageContentDefinition";
import type { GameBalanceMapObjects } from "./scene-types";

const BARREL_SIZE = 24;
const CRATE_SIZE = 20;
const MINE_RADIUS = 8;

const BARREL_COLOR = 0xd84040;
const MINE_COLOR = 0xf2d84c;
const CRATE_COLOR = 0x8b5a2b;
const CRATE_STROKE_COLOR = 0xd6a83b;

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

interface MapObjectView {
  state: MapObjectState;
  readonly sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  readonly bounds: Rect;
  readonly blinkTween?: Phaser.Tweens.Tween;
}

export class MapObjectController {
  private readonly viewsById = new Map<string, MapObjectView>();
  private readonly emittedDropIds = new Set<string>();

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: MapObjectControllerDeps
  ) {}

  public applyMapObjects(definitions: readonly StageMapObjectDefinition[], now: number = this.scene.time.now): void {
    this.clear();

    for (const definition of definitions) {
      const state = createMapObject({
        id: definition.id,
        kind: definition.kind,
        x: definition.x,
        y: definition.y,
        hp: this.getHpForKind(definition.kind),
        armedAt: definition.kind === "mine" ? now + this.deps.gameBalanceMapObjects.mine.armDelayMs : undefined
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
      this.deps.rng
    );

    this.applyRuntimeStates(result.objects, previousStates);

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
      drops: filteredDrops
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
      .filter((view) => view.state.active)
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
      this.deps.onObjectDestroyed?.(after);
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
      this.deps.onObjectDestroyed?.(after);
    }

    return result;
  }

  public getDebugSummary(): MapObjectDebugSummary {
    const typeBreakdown: Record<MapObjectKind, number> = {
      barrel: 0,
      mine: 0,
      crate: 0
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
      view.sprite.destroy();
    }

    this.viewsById.clear();
    this.emittedDropIds.clear();
  }

  public destroy(): void {
    this.clear();
  }

  private applyRuntimeStates(
    states: readonly MapObjectState[],
    previousStates: ReadonlyMap<string, MapObjectState>
  ): void {
    for (const state of states) {
      const view = this.viewsById.get(state.id);

      if (view === undefined) {
        continue;
      }

      const previous = previousStates.get(state.id);
      view.state = state;
      this.syncVisual(view);

      if (previous?.active === true && !state.active) {
        this.deps.onObjectDestroyed?.(state);
      }
    }
  }

  private createView(state: MapObjectState): MapObjectView {
    const sprite = this.createSprite(state);
    const bounds = createCenteredRect(
      state.x,
      state.y,
      this.getCollisionSize(state.kind),
      this.getCollisionSize(state.kind)
    );
    const blinkTween = state.kind === "mine"
      ? this.scene.tweens.add({
        targets: sprite,
        alpha: 0.35,
        duration: 360,
        yoyo: true,
        repeat: -1
      })
      : undefined;

    return {
      state,
      sprite,
      bounds,
      blinkTween
    };
  }

  private createSprite(state: MapObjectState): Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc {
    if (state.kind === "mine") {
      return this.scene.add.circle(state.x, state.y, MINE_RADIUS, MINE_COLOR, 0.9);
    }

    if (state.kind === "crate") {
      return this.scene.add
        .rectangle(state.x, state.y, CRATE_SIZE, CRATE_SIZE, CRATE_COLOR, 1)
        .setStrokeStyle(2, CRATE_STROKE_COLOR, 1);
    }

    return this.scene.add.rectangle(state.x, state.y, BARREL_SIZE, BARREL_SIZE, BARREL_COLOR, 1);
  }

  private syncVisual(view: MapObjectView): void {
    view.sprite.setVisible(view.state.active);

    if (!view.state.active) {
      view.blinkTween?.pause();
      return;
    }

    if (view.state.kind === "mine" && view.blinkTween?.isPaused()) {
      view.blinkTween.resume();
    }
  }

  private getHpForKind(kind: MapObjectKind): number | undefined {
    if (kind === "barrel") {
      return this.deps.gameBalanceMapObjects.barrel.hp;
    }

    if (kind === "crate") {
      return this.deps.gameBalanceMapObjects.crate.hp;
    }

    return undefined;
  }

  private getCollisionSize(kind: MapObjectKind): number {
    if (kind === "barrel") {
      return BARREL_SIZE;
    }

    if (kind === "crate") {
      return CRATE_SIZE;
    }

    return MINE_RADIUS * 2;
  }
}
