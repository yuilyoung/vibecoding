import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    }
  }
}));

import { getActorSkinDefinition } from "../src/domain/visual/ActorSkinCatalog";
import {
  ActorPresentationComposition,
  preloadActorPresentationAssets
} from "../src/scenes/actor-presentation-composition";
import type { SceneRuntimeState } from "../src/scenes/scene-runtime-state";
import type { VisualControllerDeps } from "../src/scenes/visual-controller";

interface FakeAnimationConfig {
  key: string;
  frames: readonly { key: string; frame: string }[];
  frameRate: number;
  repeat: number;
}

class FakeImage {
  public texture: { key: string };
  public frame: { name: string | number };
  public visible = true;
  public alpha = 1;
  public scaleX = 1;
  public scaleY = 1;
  public rotation = 0;
  public tint = 0xffffff;
  public destroyed = false;
  public destroyCalls = 0;

  public constructor(public x: number, public y: number, textureKey: string, frame?: string | number) {
    this.texture = { key: textureKey };
    this.frame = { name: frame ?? 0 };
  }

  public setDepth(): this { return this; }
  public setOrigin(): this { return this; }
  public setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  public setRotation(rotation: number): this { this.rotation = rotation; return this; }
  public setScale(scale: number): this { this.scaleX = scale; this.scaleY = scale; return this; }
  public setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  public setTint(tint: number): this { this.tint = tint; return this; }
  public setVisible(visible: boolean): this { this.visible = visible; return this; }
  public setFrame(frame: string | number): this { this.frame.name = frame; return this; }
  public setTexture(textureKey: string, frame?: string | number): this {
    this.texture.key = textureKey;
    if (frame !== undefined) this.frame.name = frame;
    return this;
  }
  public destroy(): void { this.destroyed = true; this.destroyCalls++; }
}

class FakeSprite extends FakeImage {
  public playedKeys: string[] = [];
  public stopCalls = 0;
  public readonly listeners = new Map<string, Set<(animation: { key: string }) => void>>();
  public readonly anims = {
    isPlaying: false,
    stop: (): void => {
      this.stopCalls++;
      this.anims.isPlaying = false;
    }
  };

  public play(key: string): this {
    this.playedKeys.push(key);
    this.anims.isPlaying = true;
    return this;
  }

  public on(event: string, listener: (animation: { key: string }) => void): this {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  public off(event: string, listener: (animation: { key: string }) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  public completeAnimation(key: string): void {
    this.anims.isPlaying = false;
    for (const listener of this.listeners.get("animationcomplete") ?? []) listener({ key });
  }
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const createRuntimeState = (): SceneRuntimeState => ({
  playerLogic: {
    state: { isSprinting: false, lastAppliedSpeed: 1, aimAngleRadians: 0 },
    isDead: () => false,
    isStunned: () => false
  },
  dummyLogic: {
    state: { health: 100, maxHealth: 100, lastAppliedSpeed: 1, aimAngleRadians: Math.PI / 2 },
    isDead: () => false
  },
  bullets: [], activeAirStrikes: [], impactEffects: [], shotTrails: [], movementEffects: [],
  obstacles: [], stageObstacleViews: [], dummyCoverPoints: [], coverPointViews: [],
  currentWind: { x: 0, y: 0, strength: 0, angleRadians: 0 },
  pendingBulletClear: false, lastCombatEvent: "", recentImpactEffectUntilMs: 0,
  lastDummyDecision: "hold", lastDummyTacticalIntent: "hold", dummyInCover: false,
  dummyCoverBonusUntilMs: 0, activeDummyCoverIndex: null, targetDummyCoverIndex: null,
  targetDummyCoverEffect: null, nextDummyRepairTickAtMs: 0, playerUnlimitedAmmoUntilMs: 0,
  lastDummyShouldFire: false, lastDummySteerX: 0, lastDummySteerY: 0, dummySteerLockUntilMs: 0,
  muzzleFlashUntilMs: 0, currentPlayerTeam: "BLUE", currentDummyTeam: "RED", currentDummyWeaponId: "carbine",
  currentDummyWeaponRole: null, playerBodyAngle: Math.PI, dummyBodyAngle: Math.PI / 2,
  nextPlayerMoveFxAtMs: 0, nextDummyMoveFxAtMs: 0, nextGateInteractionAtMs: 0,
  lastDummyIntentKey: "", lastActiveWeaponReloading: false, suppressPointerFireUntilMs: 0,
  playerConsecutiveBlockedFrames: 0, dummyConsecutiveBlockedFrames: 0
} as unknown as SceneRuntimeState);

const createScene = (options: { manifest?: unknown; missingTeam?: "BLUE" | "RED"; texturesLoaded?: boolean } = {}) => {
  const animations = new Map<string, FakeAnimationConfig>();
  const images: FakeImage[] = [];
  const sprites: FakeSprite[] = [];
  const loadJson = vi.fn();
  const loadAtlas = vi.fn();
  const manifest = "manifest" in options
    ? options.manifest
    : readJson("public/assets/runtime/actors/manifest.json");
  const atlasFrames = {
    BLUE: Object.keys((readJson("public/assets/runtime/actors/actor-blue.json") as { frames: Record<string, unknown> }).frames),
    RED: Object.keys((readJson("public/assets/runtime/actors/actor-red.json") as { frames: Record<string, unknown> }).frames)
  };

  const scene = {
    cache: {
      json: {
        has: (key: string) => key === "actor-atlas-manifest" && manifest !== undefined,
        get: (key: string) => key === "actor-atlas-manifest" ? manifest : undefined
      }
    },
    load: { json: loadJson, atlas: loadAtlas },
    textures: {
      exists: (key: string) => {
        if (options.texturesLoaded === false) return false;
        if (key === "actor-animated-blue") return options.missingTeam !== "BLUE";
        if (key === "actor-animated-red") return options.missingTeam !== "RED";
        return true;
      },
      get: (key: string) => {
        const team = key.endsWith("blue") ? "BLUE" : "RED";
        return {
          getSourceImage: () => ({ width: 2048, height: 2048 }),
          getFrameNames: () => ["__BASE", ...atlasFrames[team]]
        };
      }
    },
    anims: {
      exists: (key: string) => animations.has(key),
      create: (config: FakeAnimationConfig) => { animations.set(config.key, config); }
    },
    add: {
      image: (x: number, y: number, textureKey: string) => {
        const image = new FakeImage(x, y, textureKey);
        images.push(image);
        return image;
      },
      sprite: (x: number, y: number, textureKey: string, frame?: string | number) => {
        const sprite = new FakeSprite(x, y, textureKey, frame);
        sprites.push(sprite);
        return sprite;
      }
    },
    input: { activePointer: { worldX: 0, worldY: 0 } }
  };

  return { scene, animations, images, sprites, loadJson, loadAtlas };
};

const createComposition = (
  scene: unknown,
  state = createRuntimeState(),
  deps: Partial<VisualControllerDeps> = {}
) => new ActorPresentationComposition({
  scene: scene as never,
  state,
  requestedSkin: getActorSkinDefinition("quaternius-animated"),
  playerSpawn: { x: 100, y: 200 },
  dummySpawn: { x: 300, y: 400 },
  controllerDeps: {
    getActiveWeaponId: () => "carbine",
    getRespawnFxState: () => ({ active: false, alpha: 1, scale: 1 }),
    isCombatLive: () => true,
    isPlayerHit: () => false,
    isDummyHit: () => false,
    ...deps
  }
});

describe("ActorPresentationComposition", () => {
  it("preloads the manifest and both atlases only for the animated opt-in", () => {
    const animatedScene = createScene({ manifest: undefined, texturesLoaded: false });
    preloadActorPresentationAssets(animatedScene.scene as never, getActorSkinDefinition("quaternius-animated"));
    expect(animatedScene.loadJson).toHaveBeenCalledWith("actor-atlas-manifest", "/assets/runtime/actors/manifest.json");
    expect(animatedScene.loadAtlas).toHaveBeenCalledTimes(2);

    const legacyScene = createScene();
    preloadActorPresentationAssets(legacyScene.scene as never, getActorSkinDefinition("legacy-vehicle"));
    expect(legacyScene.loadJson).not.toHaveBeenCalled();
    expect(legacyScene.loadAtlas).not.toHaveBeenCalled();
  });

  it("keeps Image gameplay anchors and synchronizes animated Sprite overlays", () => {
    const { scene, animations, images } = createScene();
    const composition = createComposition(scene);
    const debug = composition.refs.controller.getDebugState();

    expect(composition.refs.activeSkin.bodyScale).toBe(0.42);
    expect(composition.refs.playerSprite).toBe(images[0]);
    expect(composition.refs.targetDummy).toBe(images[1]);
    expect(composition.refs.playerSprite).not.toBeInstanceOf(FakeSprite);
    expect(composition.refs.playerSprite).toMatchObject({ texture: { key: "ground-body-blue" }, alpha: 0, scaleX: 0.42 });
    expect(composition.refs.targetDummy).toMatchObject({ texture: { key: "ground-body-red" }, alpha: 0, scaleX: 0.42 });
    expect(composition.refs.playerAnimatedSprite).toMatchObject({ texture: { key: "actor-animated-blue" }, scaleX: 0.42 });
    expect(composition.refs.dummyAnimatedSprite).toMatchObject({ texture: { key: "actor-animated-red" }, scaleX: 0.42 });
    expect(animations).toHaveLength(2 * 5 * 8);
    expect(debug).toMatchObject({ skinId: "quaternius-animated", atlasActive: true });

    composition.refs.playerSprite.setPosition(125, 225);
    composition.refs.controller.syncActorOverlays();
    expect(composition.refs.playerAnimatedSprite).toMatchObject({ x: 125, y: 225, rotation: 0 });
    expect(composition.refs.controller.getActorRotation(Math.PI)).toBeCloseTo(Math.PI * 1.5);
  });

  it("switches keys once, uses aim for fire, and returns to locomotion after completion", () => {
    const state = createRuntimeState();
    const { scene, animations } = createScene();
    const composition = createComposition(scene, state);
    const controller = composition.refs.controller;
    const playerOverlay = composition.refs.playerAnimatedSprite as unknown as FakeSprite;

    expect(animations.get("quaternius-animated:blue:fire:east")).toMatchObject({ frameRate: 12, repeat: 0 });
    expect(animations.get("quaternius-animated:red:run:south")).toMatchObject({ frameRate: 12, repeat: -1 });

    controller.updatePlayerVisuals(100);
    expect(controller.getDebugState()).toMatchObject({
      playerState: "run",
      playerDirection: "west",
      playerAnimationKey: "quaternius-animated:blue:run:west"
    });
    const runPlayCount = playerOverlay.playedKeys.length;
    controller.updatePlayerVisuals(101);
    expect(playerOverlay.playedKeys).toHaveLength(runPlayCount);

    state.muzzleFlashUntilMs = 200;
    controller.updatePlayerVisuals(150);
    expect(controller.getDebugState()).toMatchObject({
      playerState: "fire",
      playerDirection: "east",
      playerAnimationKey: "quaternius-animated:blue:fire:east"
    });
    const firePlayCount = playerOverlay.playedKeys.length;
    state.playerLogic.state.aimAngleRadians = Math.PI / 2;
    controller.updatePlayerVisuals(160);
    expect(controller.getDebugState()).toMatchObject({
      playerState: "fire",
      playerDirection: "east",
      playerAnimationKey: "quaternius-animated:blue:fire:east"
    });
    expect(playerOverlay.playedKeys).toHaveLength(firePlayCount);
    playerOverlay.completeAnimation("quaternius-animated:blue:fire:east");
    state.muzzleFlashUntilMs = 0;
    controller.updatePlayerVisuals(250);
    expect(controller.getDebugState()).toMatchObject({
      playerState: "run",
      playerDirection: "west",
      playerAnimationKey: "quaternius-animated:blue:run:west"
    });
  });

  it("uses hit callbacks for both actors and preserves priority over fire", () => {
    let playerHit = false;
    let dummyHit = false;
    const state = createRuntimeState();
    state.muzzleFlashUntilMs = 500;
    state.lastDummyShouldFire = true;
    const { scene } = createScene();
    const composition = createComposition(scene, state, {
      isPlayerHit: () => playerHit,
      isDummyHit: () => dummyHit
    });
    const controller = composition.refs.controller;

    controller.updatePlayerVisuals(100);
    controller.updateDummyVisuals(100);
    expect(controller.getDebugState()).toMatchObject({ playerState: "fire", dummyState: "fire" });

    playerHit = true;
    dummyHit = true;
    controller.updatePlayerVisuals(110);
    controller.updateDummyVisuals(110);
    expect(controller.getDebugState()).toMatchObject({ playerState: "hit", dummyState: "hit" });
    expect(composition.refs.playerAnimatedSprite?.tint).toBe(0xff6a6a);
    expect(composition.refs.dummyAnimatedSprite?.tint).toBe(0xff6a6a);
  });

  it("swaps both teams and keeps the external carbine aligned to aim", () => {
    const state = createRuntimeState();
    const { scene } = createScene();
    const composition = createComposition(scene, state);
    const controller = composition.refs.controller;

    controller.applyTeamVisuals("RED", "BLUE");
    controller.updatePlayerVisuals(100);
    controller.updateDummyVisuals(100);
    controller.updateWeaponVisuals();
    expect(controller.getDebugState()).toMatchObject({
      playerTextureKey: "actor-animated-red",
      dummyTextureKey: "actor-animated-blue",
      playerWeaponVisible: true,
      dummyWeaponVisible: true
    });
    expect(composition.refs.playerSprite.texture.key).toBe("ground-body-red");
    expect(composition.refs.targetDummy.texture.key).toBe("ground-body-blue");
    expect(composition.refs.playerWeaponSprite.rotation).toBeCloseTo(Math.PI / 2);
    expect(composition.refs.dummyWeaponSprite.rotation).toBeCloseTo(Math.PI);
  });

  it("falls back as one complete Ground Shaker presentation when either atlas is unavailable", () => {
    const { scene, animations } = createScene({ missingTeam: "RED" });
    const composition = createComposition(scene);
    const debug = composition.refs.controller.getDebugState();

    expect(composition.refs.activeSkin.id).toBe("legacy-vehicle");
    expect(composition.refs.playerAnimatedSprite).toBeNull();
    expect(composition.refs.dummyAnimatedSprite).toBeNull();
    expect(composition.refs.playerSprite.alpha).toBe(1);
    expect(debug).toMatchObject({
      requestedSkinId: "quaternius-animated",
      skinId: "legacy-vehicle",
      atlasActive: false,
      playerTextureKey: "ground-body-blue",
      dummyTextureKey: "ground-body-red",
      playerWeaponVisible: true,
      dummyWeaponVisible: true
    });
    expect(debug.fallbackReason).not.toBeNull();
    expect(animations).toHaveLength(0);
  });

  it("makes duplicate initialize and double destroy harmless", () => {
    const state = createRuntimeState();
    const { scene, images, sprites } = createScene();
    const composition = createComposition(scene, state);
    const playerOverlay = composition.refs.playerAnimatedSprite as unknown as FakeSprite;
    const initialPlayCount = playerOverlay.playedKeys.length;
    const initialListenerCount = playerOverlay.listeners.get("animationcomplete")?.size;

    composition.refs.controller.initializeActorPresentation();
    expect(playerOverlay.playedKeys).toHaveLength(initialPlayCount);
    expect(playerOverlay.listeners.get("animationcomplete")?.size).toBe(initialListenerCount);

    composition.destroy();
    const firstDestroyCounts = [...images, ...sprites].map((object) => object.destroyCalls);
    composition.destroy();

    expect(composition.refs.controller.getDebugState().destroyed).toBe(true);
    expect(playerOverlay.listeners.get("animationcomplete")?.size).toBe(0);
    expect(playerOverlay.visible).toBe(false);
    expect(state.playerSprite).toBeUndefined();
    expect(state.targetDummy).toBeUndefined();
    expect([...images, ...sprites].map((object) => object.destroyCalls)).toEqual(firstDestroyCounts);
    expect(firstDestroyCounts.every((count) => count === 1)).toBe(true);
  });
});
