import Phaser from "phaser";
import type { TerrainCrop } from "./scene-types";
import {
  OBSTACLE_CORE_KEY, OBSTACLE_TOWER_KEY, OBSTACLE_BARRIER_KEY,
  GATE_PANEL_KEY, VENT_PANEL_KEY, PICKUP_AMMO_KEY, PICKUP_HEALTH_KEY,
  GROUND_BODY_BLUE_KEY, GROUND_BODY_RED_KEY, GROUND_TERRAIN_KEY,
  GROUND_TURRET_CARBINE_BLUE_KEY, GROUND_TURRET_CARBINE_RED_KEY,
  GROUND_TURRET_SCATTER_BLUE_KEY, GROUND_TURRET_SCATTER_RED_KEY,
  CARBINE_TURRET_FRAMES, SCATTER_TURRET_FRAMES,
  ACTOR_BODY_SCALE, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y,
} from "./scene-constants";

export function createArenaPropTextures(scene: Phaser.Scene): void {
  createObstacleTexture(scene, OBSTACLE_CORE_KEY, 96, 96, 0xe6b35f, 0x8c5a21, 0xfff0ca);
  createObstacleTexture(scene, OBSTACLE_TOWER_KEY, 96, 160, 0x5bb3d8, 0x214f7a, 0xd7f2ff);
  createObstacleTexture(scene, OBSTACLE_BARRIER_KEY, 160, 64, 0x72cb8a, 0x2d6b42, 0xe0ffe8);
  createGateTexture(scene);
  createVentTexture(scene);
  createPickupTexture(scene, PICKUP_AMMO_KEY, 0x6ce5ff, 0xd9f9ff, "A");
  createPickupTexture(scene, PICKUP_HEALTH_KEY, 0x7cff9e, 0xeafff0, "+");
}

export function createActorSkins(scene: Phaser.Scene): void {
  createActorTexture(scene, "skin-player-blue", {
    bodyColor: 0x4ec9ff,
    headColor: 0xffffff,
    accentColor: 0x1d6cb5,
    weaponColor: 0xffcf4c
  });
  createActorTexture(scene, "skin-player-red", {
    bodyColor: 0xff6d7a,
    headColor: 0xfff3f3,
    accentColor: 0xbe3348,
    weaponColor: 0xffbf54
  });
  createActorTexture(scene, "skin-dummy-blue", {
    bodyColor: 0x70d8ff,
    headColor: 0xf8fdff,
    accentColor: 0x1b6eb1,
    weaponColor: 0xffd464
  });
  createActorTexture(scene, "skin-dummy-red", {
    bodyColor: 0xff7a6d,
    headColor: 0xfff2f2,
    accentColor: 0xc14431,
    weaponColor: 0xffd464
  });
}

export function createActorImage(scene: Phaser.Scene, actor: "player" | "dummy", x: number, y: number): Phaser.GameObjects.Image {
  const textureKey = actor === "player" ? GROUND_BODY_BLUE_KEY : GROUND_BODY_RED_KEY;
  return scene.add.image(x, y, textureKey).setDepth(5).setScale(ACTOR_BODY_SCALE);
}

export function createTurretAnimations(scene: Phaser.Scene): void {
  ensureTurretAnimation(scene, GROUND_TURRET_CARBINE_BLUE_KEY, CARBINE_TURRET_FRAMES, 18);
  ensureTurretAnimation(scene, GROUND_TURRET_CARBINE_RED_KEY, CARBINE_TURRET_FRAMES, 18);
  ensureTurretAnimation(scene, GROUND_TURRET_SCATTER_BLUE_KEY, SCATTER_TURRET_FRAMES, 22);
  ensureTurretAnimation(scene, GROUND_TURRET_SCATTER_RED_KEY, SCATTER_TURRET_FRAMES, 22);
}

export function addArenaBackdrop(scene: Phaser.Scene): void {
  const playfieldWidth = PLAYFIELD_MAX_X - PLAYFIELD_MIN_X;
  const playfieldHeight = PLAYFIELD_MAX_Y - PLAYFIELD_MIN_Y;
  const playfieldCenterX = (PLAYFIELD_MIN_X + PLAYFIELD_MAX_X) * 0.5;
  const playfieldCenterY = (PLAYFIELD_MIN_Y + PLAYFIELD_MAX_Y) * 0.5;

  scene.add.rectangle(480, 270, 960, 540, 0x0a121b, 0.02).setDepth(-2);
  addTerrainSurface(
    scene,
    playfieldCenterX,
    playfieldCenterY,
    playfieldWidth,
    playfieldHeight,
    { x: 0, y: 0, width: 896, height: 640 },
    0.94,
    -1
  );
  scene.add.rectangle(playfieldCenterX, playfieldCenterY, playfieldWidth, playfieldHeight, 0x10273a, 0.035).setDepth(0);
  scene.add.rectangle(playfieldCenterX, playfieldCenterY, playfieldWidth, playfieldHeight, 0x234f85, 0).setStrokeStyle(2, 0xa7ddff, 0.42).setDepth(1);
}

export function addTerrainSurface(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  crop: TerrainCrop,
  alpha: number,
  depth: number
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, GROUND_TERRAIN_KEY)
    .setCrop(crop.x, crop.y, crop.width, crop.height)
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setDepth(depth);
}

function ensureTurretAnimation(scene: Phaser.Scene, textureKey: string, frameCount: number, frameRate: number): void {
  const animationKey = getTurretAnimationKey(textureKey);

  if (scene.anims.exists(animationKey)) {
    return;
  }

  scene.anims.create({
    key: animationKey,
    frames: scene.anims.generateFrameNumbers(textureKey, {
      start: 0,
      end: frameCount - 1
    }),
    frameRate,
    repeat: 0
  });
}

export function getTurretAnimationKey(textureKey: string): string {
  return `${textureKey}-fire`;
}

export function playTurretFireAnimation(sprite: Phaser.GameObjects.Sprite, textureKey: string): void {
  const animationKey = getTurretAnimationKey(textureKey);

  if (sprite.texture.key !== textureKey) {
    sprite.setTexture(textureKey, 0);
  }

  sprite.play(animationKey, true);
}

function createObstacleTexture(
  scene: Phaser.Scene,
  textureKey: string,
  width: number,
  height: number,
  fillColor: number,
  shadowColor: number,
  highlightColor: number
): void {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, width, height);
  graphics.fillStyle(shadowColor, 0.94);
  graphics.fillRoundedRect(4, 6, width - 8, height - 10, 10);
  graphics.fillStyle(fillColor, 0.96);
  graphics.fillRoundedRect(6, 4, width - 12, height - 12, 10);
  graphics.fillStyle(highlightColor, 0.78);
  graphics.fillRoundedRect(12, 10, width - 24, Math.max(8, Math.floor(height * 0.16)), 6);
  graphics.lineStyle(3, 0xffffff, 0.18);
  graphics.strokeRoundedRect(6, 4, width - 12, height - 12, 10);
  graphics.generateTexture(textureKey, width, height);
  graphics.destroy();
}

function createGateTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GATE_PANEL_KEY)) {
    return;
  }

  const width = 128;
  const height = 48;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, width, height);
  graphics.fillStyle(0x65462d, 0.94);
  graphics.fillRoundedRect(4, 6, width - 8, height - 10, 8);
  graphics.fillStyle(0xd59a47, 0.96);
  graphics.fillRoundedRect(6, 4, width - 12, height - 12, 8);
  graphics.fillStyle(0xffe3a0, 0.7);
  graphics.fillRect(14, 12, width - 28, 6);
  graphics.lineStyle(3, 0xffffff, 0.18);
  graphics.strokeRoundedRect(6, 4, width - 12, height - 12, 8);
  graphics.generateTexture(GATE_PANEL_KEY, width, height);
  graphics.destroy();
}

function createVentTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(VENT_PANEL_KEY)) {
    return;
  }

  const width = 192;
  const height = 64;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, width, height);
  graphics.fillStyle(0x6f2f94, 0.92);
  graphics.fillRoundedRect(6, 6, width - 12, height - 12, 10);
  graphics.fillStyle(0xc34cff, 0.28);
  graphics.fillRoundedRect(10, 10, width - 20, height - 20, 8);
  graphics.lineStyle(2, 0xffffff, 0.2);
  for (let x = 18; x < width - 18; x += 18) {
    graphics.lineBetween(x, 16, x, height - 16);
  }
  graphics.generateTexture(VENT_PANEL_KEY, width, height);
  graphics.destroy();
}

function createPickupTexture(scene: Phaser.Scene, textureKey: string, fillColor: number, highlightColor: number, glyph: string): void {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const size = 48;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, size, size);
  graphics.fillStyle(0x12202a, 0.4);
  graphics.fillCircle(size / 2, size / 2 + 3, 17);
  graphics.fillStyle(fillColor, 1);
  graphics.fillCircle(size / 2, size / 2, 16);
  graphics.fillStyle(highlightColor, 0.86);
  graphics.fillCircle(size / 2 - 5, size / 2 - 5, 6);
  graphics.lineStyle(2, 0xffffff, 0.24);
  graphics.strokeCircle(size / 2, size / 2, 16);
  graphics.lineStyle(3, 0x0c1520, 0.72);

  if (glyph === "+") {
    graphics.lineBetween(size / 2, 13, size / 2, size - 13);
    graphics.lineBetween(13, size / 2, size - 13, size / 2);
  } else {
    graphics.lineBetween(size / 2, 13, size / 2, size - 13);
    graphics.lineBetween(size / 2, 13, size - 15, size / 2);
  }

  graphics.generateTexture(textureKey, size, size);
  graphics.destroy();
}

function createActorTexture(
  scene: Phaser.Scene,
  textureKey: string,
  palette: {
    readonly bodyColor: number;
    readonly headColor: number;
    readonly accentColor: number;
    readonly weaponColor: number;
  }
): void {
  if (scene.textures.exists(textureKey)) {
    return;
  }

  const isDummy = textureKey.includes("dummy");
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, 48, 48);
  graphics.fillStyle(0x102030, 0.28);
  graphics.fillEllipse(24, 33, 26, 14);
  graphics.fillStyle(palette.accentColor, 1);
  graphics.fillCircle(24, 24, 17);
  graphics.lineStyle(3, 0xffffff, 0.95);
  graphics.strokeCircle(24, 24, 17);
  graphics.fillStyle(palette.bodyColor, 1);

  if (isDummy) {
    graphics.fillRoundedRect(13, 13, 22, 22, 8);
    graphics.fillStyle(palette.headColor, 1);
    graphics.fillCircle(24, 24, 7);
    graphics.fillStyle(palette.weaponColor, 1);
    graphics.fillRoundedRect(24, 21, 15, 6, 3);
    graphics.lineStyle(2, 0x203040, 0.45);
    graphics.strokeRoundedRect(13, 13, 22, 22, 8);
  } else {
    graphics.fillTriangle(11, 14, 11, 34, 34, 24);
    graphics.fillStyle(palette.headColor, 1);
    graphics.fillCircle(20, 24, 6);
    graphics.fillStyle(palette.weaponColor, 1);
    graphics.fillRoundedRect(29, 21, 12, 6, 3);
    graphics.lineStyle(2, 0x203040, 0.45);
    graphics.strokeTriangle(11, 14, 11, 34, 34, 24);
  }

  graphics.generateTexture(textureKey, 48, 48);
  graphics.destroy();
}
