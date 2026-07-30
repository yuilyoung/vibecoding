import Phaser from "phaser";
import type { GameBalance } from "./scene-types";
import { preloadRuntimeAssets } from "./runtime-asset-contract";

export interface BootstrapVisualRefs {
  crosshairHorizontal: Phaser.GameObjects.Rectangle;
  crosshairVertical: Phaser.GameObjects.Rectangle;
  muzzleFlash: Phaser.GameObjects.Arc;
}

export function getBrowserStorageBackend(): Storage {
  return window.localStorage;
}

export function preloadMainSceneAssets(scene: Phaser.Scene, gameBalance: GameBalance): void {
  preloadRuntimeAssets(scene);

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
