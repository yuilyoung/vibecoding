import Phaser from "phaser";

import {
  WORLD_OBJECT_ATLAS_MANIFEST_CACHE_KEY,
  WORLD_OBJECT_ATLAS_MANIFEST_RUNTIME_PATH,
  getWorldObjectFrameKey,
  resolveWorldObjectSkinForRuntime,
  resolveWorldObjectVisualState,
  type ProductWorldObjectState,
  type WorldObjectAtlasAvailability,
  type WorldObjectFamily,
  type WorldObjectSkinDefinition,
  type WorldObjectSkinRuntimeResolution
} from "../domain/visual/WorldObjectSkinCatalog";

export interface WorldObjectPresentationSyncInput {
  readonly active: boolean;
  readonly hp: number;
  readonly maxHp?: number;
  readonly now: number;
  readonly armedAt?: number;
  readonly reflectionsRemaining?: number;
  readonly cooldownUntil?: number;
}

export interface WorldObjectPresentationHandle {
  readonly token: symbol;
}

export interface WorldObjectPresentationObjectDebug {
  readonly id: string;
  readonly family: WorldObjectFamily;
  readonly state: ProductWorldObjectState;
  readonly frameKey: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly visible: boolean;
  readonly alpha: number;
}

export interface WorldObjectPresentationDebugState {
  readonly requestedSkinId: string;
  readonly skinId: string;
  readonly fallbackReason: string | null;
  readonly atlasActive: boolean;
  readonly textureKey: string | null;
  readonly overlayCount: number;
  readonly objects: readonly WorldObjectPresentationObjectDebug[];
  readonly initialized: boolean;
  readonly destroyed: boolean;
}

export interface WorldObjectPresentationPort {
  readonly atlasActive: boolean;
  initialize(): void;
  attach(anchor: Phaser.GameObjects.Shape, family: WorldObjectFamily, id: string): WorldObjectPresentationHandle | null;
  sync(handle: WorldObjectPresentationHandle, input: WorldObjectPresentationSyncInput): void;
  detach(handle: WorldObjectPresentationHandle | null): void;
  clear(): void;
  destroy(): void;
  getDebugState(): WorldObjectPresentationDebugState;
}

interface InternalHandle extends WorldObjectPresentationHandle {
  readonly id: string;
  readonly family: WorldObjectFamily;
  readonly anchor: Phaser.GameObjects.Shape;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly onAnchorDestroyed: () => void;
  state: ProductWorldObjectState;
  frameKey: string;
}

export function preloadWorldObjectPresentationAssets(
  scene: Phaser.Scene,
  requestedSkin: WorldObjectSkinDefinition
): void {
  if (requestedSkin.id !== "product-v1" || requestedSkin.atlas === null) return;
  if (!scene.cache.json.has(WORLD_OBJECT_ATLAS_MANIFEST_CACHE_KEY)) {
    scene.load.json(WORLD_OBJECT_ATLAS_MANIFEST_CACHE_KEY, WORLD_OBJECT_ATLAS_MANIFEST_RUNTIME_PATH);
  }
  if (!scene.textures.exists(requestedSkin.atlas.textureKey)) {
    scene.load.atlas(requestedSkin.atlas.textureKey, requestedSkin.atlas.imagePath, requestedSkin.atlas.jsonPath);
  }
}

export class WorldObjectPresentationComposition implements WorldObjectPresentationPort {
  public readonly atlasActive: boolean;
  public readonly activeSkin: WorldObjectSkinDefinition;
  private scene: Phaser.Scene | null;
  private readonly requestedSkin: WorldObjectSkinDefinition;
  private readonly resolution: WorldObjectSkinRuntimeResolution;
  private readonly handles = new Map<symbol, InternalHandle>();
  private initialized = false;
  private destroyed = false;

  public constructor(scene: Phaser.Scene, requestedSkin: WorldObjectSkinDefinition) {
    this.scene = scene;
    this.requestedSkin = requestedSkin;
    this.resolution = resolveWorldObjectSkinForRuntime(
      requestedSkin,
      scene.cache.json.get(WORLD_OBJECT_ATLAS_MANIFEST_CACHE_KEY),
      collectAtlasAvailability(scene, requestedSkin)
    );
    this.atlasActive = this.resolution.atlasActive;
    this.activeSkin = this.resolution.definition;
  }

  public initialize(): void {
    if (this.destroyed || this.initialized) return;
    this.initialized = true;
  }

  public attach(
    anchor: Phaser.GameObjects.Shape,
    family: WorldObjectFamily,
    id: string
  ): WorldObjectPresentationHandle | null {
    const scene = this.scene;
    const atlas = this.requestedSkin.atlas;
    if (scene === null || atlas === null || this.destroyed || !this.initialized || !this.atlasActive) return null;
    const layout = this.requestedSkin.layouts[family];
    const frameKey = getWorldObjectFrameKey(family, "idle");
    const sprite = scene.add.sprite(anchor.x + layout.offsetX, anchor.y + layout.offsetY, atlas.textureKey, frameKey)
      .setOrigin(layout.originX, layout.originY)
      .setScale(layout.displayScale)
      .setDepth(layout.depth)
      .setRotation(layout.rotationPolicy === "anchor" ? anchor.rotation : 0);
    const token = Symbol(id);
    const handle = {
      token,
      id,
      family,
      anchor,
      sprite,
      state: "idle" as const,
      frameKey,
      onAnchorDestroyed: () => this.detach({ token })
    };
    this.handles.set(token, handle);
    anchor.once(Phaser.GameObjects.Events.DESTROY, handle.onAnchorDestroyed);
    return { token };
  }

  public sync(handle: WorldObjectPresentationHandle, input: WorldObjectPresentationSyncInput): void {
    const target = this.handles.get(handle.token);
    if (target === undefined || this.destroyed) return;
    const layout = this.requestedSkin.layouts[target.family];
    const state = resolveWorldObjectVisualState({ family: target.family, ...input });
    const frameKey = getWorldObjectFrameKey(target.family, state);
    if (frameKey !== target.frameKey) target.sprite.setFrame(frameKey);
    target.state = state;
    target.frameKey = frameKey;
    target.sprite
      .setPosition(target.anchor.x + layout.offsetX, target.anchor.y + layout.offsetY)
      .setRotation(layout.rotationPolicy === "anchor" ? target.anchor.rotation : 0)
      .setVisible(true)
      .setAlpha(input.active ? 1 : 0.26);
  }

  public detach(handle: WorldObjectPresentationHandle | null): void {
    if (handle === null) return;
    const target = this.handles.get(handle.token);
    if (target === undefined) return;
    this.handles.delete(handle.token);
    target.anchor.off(Phaser.GameObjects.Events.DESTROY, target.onAnchorDestroyed);
    target.sprite.destroy();
  }

  public clear(): void {
    for (const handle of [...this.handles.values()]) this.detach(handle);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.initialized = false;
    this.scene = null;
  }

  public getDebugState(): WorldObjectPresentationDebugState {
    return {
      requestedSkinId: this.resolution.requestedSkinId,
      skinId: this.resolution.effectiveSkinId,
      fallbackReason: this.resolution.fallbackReason,
      atlasActive: this.atlasActive,
      textureKey: this.atlasActive ? this.requestedSkin.atlas?.textureKey ?? null : null,
      overlayCount: this.handles.size,
      objects: [...this.handles.values()].map((handle) => ({
        id: handle.id,
        family: handle.family,
        state: handle.state,
        frameKey: handle.frameKey,
        x: handle.sprite.x,
        y: handle.sprite.y,
        rotation: handle.sprite.rotation,
        visible: handle.sprite.visible,
        alpha: handle.sprite.alpha
      })),
      initialized: this.initialized,
      destroyed: this.destroyed
    };
  }
}

function collectAtlasAvailability(
  scene: Phaser.Scene,
  requestedSkin: WorldObjectSkinDefinition
): WorldObjectAtlasAvailability | null {
  if (requestedSkin.id !== "product-v1" || requestedSkin.atlas === null ||
    !scene.textures.exists(requestedSkin.atlas.textureKey)) return null;
  const texture = scene.textures.get(requestedSkin.atlas.textureKey);
  const source = texture.getSourceImage() as { width?: number; height?: number } | undefined;
  return {
    textureKey: requestedSkin.atlas.textureKey,
    width: source?.width ?? 0,
    height: source?.height ?? 0,
    frameKeys: texture.getFrameNames().filter((key) => key !== "__BASE")
  };
}
