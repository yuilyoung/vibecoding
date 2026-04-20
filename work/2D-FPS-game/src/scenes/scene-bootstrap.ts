import Phaser from "phaser";
import type { GameBalance } from "./scene-types";
import {
  GROUND_BODY_BLUE_KEY,
  GROUND_BODY_RED_KEY,
  GROUND_TERRAIN_KEY,
  GROUND_TURRET_CARBINE_BLUE_KEY,
  GROUND_TURRET_CARBINE_RED_KEY,
  GROUND_TURRET_SCATTER_BLUE_KEY,
  GROUND_TURRET_SCATTER_RED_KEY,
  TURRET_FRAME_HEIGHT,
  TURRET_FRAME_WIDTH,
  WEAPON_GUN_KEY,
  WEAPON_MACHINE_KEY
} from "./scene-constants";

export interface BootstrapVisualRefs {
  crosshairHorizontal: Phaser.GameObjects.Rectangle;
  crosshairVertical: Phaser.GameObjects.Rectangle;
  muzzleFlash: Phaser.GameObjects.Arc;
}

export function getBrowserStorageBackend(): Storage {
  return window.localStorage;
}

export function preloadMainSceneAssets(scene: Phaser.Scene, gameBalance: GameBalance): void {
  scene.load.image(WEAPON_MACHINE_KEY, "/assets/runtime/sprites/weapon-machine.png");
  scene.load.image(WEAPON_GUN_KEY, "/assets/runtime/sprites/weapon-gun.png");
  scene.load.image(GROUND_BODY_BLUE_KEY, "/assets/runtime/sprites/ground-body-blue.png");
  scene.load.image(GROUND_BODY_RED_KEY, "/assets/runtime/sprites/ground-body-red.png");
  scene.load.image(GROUND_TERRAIN_KEY, "/assets/runtime/sprites/ground-terrain.png");
  scene.load.spritesheet(GROUND_TURRET_CARBINE_BLUE_KEY, "/assets/runtime/sprites/ground-turret-carbine-blue.png", {
    frameWidth: TURRET_FRAME_WIDTH,
    frameHeight: TURRET_FRAME_HEIGHT
  });
  scene.load.spritesheet(GROUND_TURRET_CARBINE_RED_KEY, "/assets/runtime/sprites/ground-turret-carbine-red.png", {
    frameWidth: TURRET_FRAME_WIDTH,
    frameHeight: TURRET_FRAME_HEIGHT
  });
  scene.load.spritesheet(GROUND_TURRET_SCATTER_BLUE_KEY, "/assets/runtime/sprites/ground-turret-scatter-blue.png", {
    frameWidth: TURRET_FRAME_WIDTH,
    frameHeight: TURRET_FRAME_HEIGHT
  });
  scene.load.spritesheet(GROUND_TURRET_SCATTER_RED_KEY, "/assets/runtime/sprites/ground-turret-scatter-red.png", {
    frameWidth: TURRET_FRAME_WIDTH,
    frameHeight: TURRET_FRAME_HEIGHT
  });

  if (gameBalance.actorSkinSource === "spritesheet") {
    scene.load.spritesheet("actor-skins", gameBalance.actorSpritesheetPath, {
      frameWidth: gameBalance.actorFrameWidth,
      frameHeight: gameBalance.actorFrameHeight
    });
  }
}

export function createBootstrapVisualRefs(scene: Phaser.Scene): BootstrapVisualRefs {
  return {
    crosshairHorizontal: scene.add.rectangle(0, 0, 20, 3, 0xf8fbff, 0.95).setDepth(20),
    crosshairVertical: scene.add.rectangle(0, 0, 3, 20, 0xf8fbff, 0.95).setDepth(20),
    muzzleFlash: scene.add.circle(0, 0, 8, 0xffd27a, 0.9).setDepth(8).setVisible(false)
  };
}

export function bindMainSceneLifecycle(
  scene: Phaser.Scene,
  pointerDownHandler: () => void,
  shutdownHandler: () => void,
  context: unknown
): void {
  scene.input.on("pointerdown", pointerDownHandler, context);
  scene.events.on("shutdown", shutdownHandler, context);
}

export function unbindMainScenePointer(
  scene: Phaser.Scene,
  pointerDownHandler: () => void,
  context: unknown
): void {
  scene.input.off("pointerdown", pointerDownHandler, context);
}
