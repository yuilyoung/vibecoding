import Phaser from "phaser";

export const ARCADE_FLOOR_KEY = "arcade-arena-floor";
const FLOOR_KEY = ARCADE_FLOOR_KEY;

/** One cached texture (960×540, 1.98 MiB RGBA), no per-frame graphics allocation. */
export function createArcadeFloor(scene: Phaser.Scene): Phaser.GameObjects.Image {
  if (!scene.textures.exists(FLOOR_KEY)) {
    const g = scene.add.graphics();
    g.fillStyle(0x244e59).fillRect(0, 0, 960, 540);
    g.fillStyle(0x183c48).fillRoundedRect(22, 22, 920, 504, 18);
    g.fillStyle(0x658f8b).fillRoundedRect(24, 16, 912, 504, 16);
    g.fillStyle(0xc5e3cb).fillRoundedRect(28, 18, 904, 498, 12);
    // The fine grid and walkways are decoration, with no collision semantics.
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 18; column += 1) {
        const x = 31 + column * 50;
        const y = 22 + row * 49;
        const path = (column >= 8 && column <= 9) || row === 4 || row === 5;
        const alternate = (row + column) % 2 === 0;
        g.fillStyle(path ? 0xa9b9a3 : 0x80aaa0).fillRoundedRect(x, y + 3, 48, 46, 5);
        g.fillStyle(path ? (alternate ? 0xe6dfbf : 0xdcd8b9) : (alternate ? 0xb9d8b6 : 0xb0d0ae)).fillRoundedRect(x, y, 48, 44, 5);
        g.lineStyle(1, 0xf8ffdf, 0.52).lineBetween(x + 5, y + 2, x + 42, y + 2);
        g.lineStyle(1, 0x6e9f96, 0.28).lineBetween(x + 47, y + 8, x + 47, y + 39);
        if (!path && (column * 7 + row * 3) % 11 === 0) {
          g.fillStyle(0x85b68e, 0.55).fillEllipse(x + 33, y + 30, 9, 3);
          g.lineStyle(1, 0xeaffca, 0.7).lineBetween(x + 32, y + 30, x + 30, y + 25);
          g.lineBetween(x + 33, y + 30, x + 35, y + 24);
        }
      }
    }
    // Inlaid arena crest stays beneath gameplay and uses no world-space text.
    g.lineStyle(3, 0xfff7da, 0.6).strokeCircle(480, 267, 67);
    g.lineStyle(1, 0x859c8e, 0.45).strokeCircle(480, 267, 59);
    g.fillStyle(0xf4e9bb, 0.75).fillPoints([
      { x: 480, y: 230 }, { x: 494, y: 256 }, { x: 522, y: 267 },
      { x: 494, y: 278 }, { x: 480, y: 304 }, { x: 466, y: 278 },
      { x: 438, y: 267 }, { x: 466, y: 256 }
    ], true);
    // Chunky edge trim and luminous corner caps establish a toy-diorama frame.
    for (let x = 38; x < 925; x += 32) {
      g.fillStyle(0x244957).fillRoundedRect(x, 6, 27, 12, 4);
      g.fillStyle(0x92c2bd).fillRoundedRect(x, 5, 27, 6, 3);
      g.fillStyle(0x244957).fillRoundedRect(x, 517, 27, 15, 4);
      g.fillStyle(0x78aba6).fillRoundedRect(x, 517, 27, 7, 3);
    }
    for (const x of [12, 932]) {
      for (const y of [12, 502]) {
        g.fillStyle(0x153847).fillRoundedRect(x, y + 4, 16, 20, 5);
        g.fillStyle(0xcef7df).fillRoundedRect(x, y, 16, 18, 5);
        g.fillStyle(0x75d9c5).fillRoundedRect(x + 4, y + 3, 8, 8, 3);
      }
    }
    g.generateTexture(FLOOR_KEY, 960, 540);
    g.destroy();
  }
  return scene.add.image(480, 270, FLOOR_KEY).setDepth(-0.5);
}

export function getArcadeFloorTint(stageId: string): number {
  if (stageId === "relay-yard") return 0xd1edff;
  if (stageId === "storm-drain") return 0xdad6ff;
  return 0xfff4dd;
}
