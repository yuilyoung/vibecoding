import type Phaser from "phaser";
import { ARCADE_STAGES } from "../domain/map/ArcadeStageCatalog";

type Context = CanvasRenderingContext2D;
export type ArcadeObstacleMaterial = "hedge" | "water" | "wood" | "biscuit";
export type ArcadeStageProp = "gate" | "fountain" | "ammo" | "health";
const FLOOR_WIDTH = 960;
const FLOOR_HEIGHT = 540;

/** Canvas textures belong to the game's TextureManager and are reused on every round/restart. */
export function getArcadeStageFloorKey(scene: Phaser.Scene, stageId: string): string | null {
  if (!ARCADE_STAGES.some((stage) => stage.id === stageId)) return null;
  const key = `arcade-stage-floor:${stageId}:v1`;
  bake(scene, key, FLOOR_WIDTH, FLOOR_HEIGHT, (ctx) => {
    if (stageId === "garden-maze") drawGarden(ctx);
    else if (stageId === "bubble-bay") drawBay(ctx);
    else drawPicnic(ctx);
  });
  return key;
}

export function getArcadeObstacleMaterial(id: string): ArcadeObstacleMaterial | null {
  if (id.startsWith("garden-")) return "hedge";
  if (id.startsWith("bay-water-")) return "water";
  if (id.startsWith("bay-")) return "wood";
  if (id.startsWith("picnic-")) return "biscuit";
  return null;
}

/** Every opaque block face fits the same width/height used by its collision rectangle. */
export function getArcadeObstacleTexture(scene: Phaser.Scene, material: ArcadeObstacleMaterial, width: number, height: number): string {
  const key = `arcade-stage-block:${material}:${width}x${height}:v1`;
  bake(scene, key, width, height, (ctx) => {
    if (material === "water") drawWater(ctx, width, height);
    else if (material === "hedge") drawHedge(ctx, width, height);
    else if (material === "wood") drawWood(ctx, width, height);
    else drawBiscuit(ctx, width, height);
  });
  return key;
}

export function getArcadeStagePropTexture(scene: Phaser.Scene, prop: ArcadeStageProp): string {
  const key = `arcade-stage-prop:${prop}:v1`;
  const width = prop === "gate" ? 24 : prop === "fountain" ? 64 : 48;
  const height = prop === "gate" ? 56 : prop === "fountain" ? 24 : 48;
  bake(scene, key, width, height, (ctx) => {
    if (prop === "gate") {
      rounded(ctx, 5, 2, 14, 52, 5, "#ba8d7b");
      rounded(ctx, 7, 3, 10, 50, 4, "#ffe3b5");
      rounded(ctx, 8, 9, 8, 38, 3, "#f0a3a5");
      for (const y of [6, 50]) {
        ellipse(ctx, 12, y + 1, 10, 5, "#7eb8a3");
        ellipse(ctx, 12, y - 1, 9, 5, "#cfedc4");
        ellipse(ctx, 9, y - 2, 3, 1.5, "#f4f8d8");
      }
      ellipse(ctx, 7, 26, 6, 5, "#ffe3d0"); ellipse(ctx, 17, 26, 6, 5, "#ffe3d0");
      ellipse(ctx, 12, 28, 4, 4, "#edb272");
    } else if (prop === "fountain") {
      rounded(ctx, 0, 0, 64, 24, 7, "#c08b75");
      rounded(ctx, 2, 1, 60, 21, 6, "#ffd7b0");
      rounded(ctx, 5, 3, 54, 14, 5, "#69c6ca");
      rounded(ctx, 7, 4, 50, 10, 4, "#a9e7db");
      for (const x of [17, 32, 47]) {
        ellipse(ctx, x, 11, 5, 2, "#54b7c4");
        ellipse(ctx, x, 7, 2.5, 4, "#effff0");
      }
      for (const x of [10, 24, 38, 52]) stroke(ctx, [[x, 19], [x + 4, 19]], "#e19379", 2);
    } else {
      ellipse(ctx, 24, 40, 15, 4, "rgba(88,99,93,.18)");
      ellipse(ctx, 24, 24, 20, 20, prop === "ammo" ? "#82bfc1" : "#cd939c");
      ellipse(ctx, 24, 22, 19, 19, prop === "ammo" ? "#b2e8df" : "#ffd9d2");
      ellipse(ctx, 24, 21, 15.5, 15.5, prop === "ammo" ? "#e3f8de" : "#fff0df");
      if (prop === "ammo") {
        ctx.beginPath();
        for (let index = 0; index < 10; index += 1) {
          const angle = index * Math.PI / 5 - Math.PI / 2;
          const radius = index % 2 === 0 ? 12 : 6;
          const x = 24 + Math.cos(angle) * radius; const y = 21 + Math.sin(angle) * radius;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fillStyle = "#edbd67"; ctx.fill();
        ellipse(ctx, 21, 18, 3, 2, "#ffeec0");
      } else {
        ctx.beginPath(); ctx.moveTo(24, 32);
        ctx.bezierCurveTo(2, 17, 20, 6, 24, 16);
        ctx.bezierCurveTo(28, 6, 46, 17, 24, 32);
        ctx.fillStyle = "#ee9a9f"; ctx.fill();
        ellipse(ctx, 18, 17, 3, 2, "#ffd6c9");
      }
      ellipse(ctx, 14, 11, 5, 2, "rgba(255,255,234,.8)");
    }
  });
  return key;
}

function bake(scene: Phaser.Scene, key: string, width: number, height: number, draw: (context: Context) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (texture === null) throw new Error(`Unable to create arcade stage texture: ${key}`);
  draw(texture.context);
  texture.refresh();
}

function rounded(ctx: Context, x: number, y: number, width: number, height: number, radius: number, color: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function gradient(ctx: Context, x: number, y: number, height: number, top: string, bottom: string): CanvasGradient {
  const fill = ctx.createLinearGradient(x, y, x, y + height);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  return fill;
}

function stroke(ctx: Context, points: readonly (readonly [number, number])[], color: string, width = 1): void {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    if (index === 0) ctx.moveTo(point[0], point[1]);
    else ctx.lineTo(point[0], point[1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function flower(ctx: Context, x: number, y: number, size: number, color: string): void {
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = petal * Math.PI * 0.4;
    ellipse(ctx, x + Math.cos(angle) * size * 0.64, y + Math.sin(angle) * size * 0.64, size * 0.48, size * 0.48, color);
  }
  ellipse(ctx, x, y, size * 0.3, size * 0.3, "#f3be60");
}

function frame(ctx: Context, base: string, trim: string, edge: string): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT);
  rounded(ctx, 17, 17, 928, 517, 24, "rgba(36,71,64,0.22)");
  rounded(ctx, 16, 8, 928, 516, 23, edge);
  rounded(ctx, 21, 10, 918, 505, 19, trim);
  rounded(ctx, 27, 20, 906, 497, 15, "#fff9e7");
}

function drawGarden(ctx: Context): void {
  frame(ctx, "#a5d5c0", "#d1eab6", "#578e76");
  ctx.save();
  ctx.beginPath(); ctx.roundRect(28, 24, 904, 492, 12); ctx.clip();
  ctx.fillStyle = gradient(ctx, 0, 24, 492, "#cce9b8", "#a9d6aa");
  ctx.fillRect(28, 24, 904, 492);
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 17; column += 1) {
      const x = 29 + column * 54;
      const y = 24 + row * 55;
      rounded(ctx, x, y, 52, 53, 4, (row + column) % 2 === 0 ? "rgba(242,255,214,.17)" : "rgba(77,141,99,.045)");
      if ((row * 3 + column * 7) % 8 === 0) {
        stroke(ctx, [[x + 12, y + 35], [x + 10, y + 31]], "#8fba8e");
        stroke(ctx, [[x + 12, y + 35], [x + 14, y + 30]], "#8fba8e");
      }
    }
  }
  // The pale paths and grassy squares are both walkable; raised hedges mark the walls.
  rounded(ctx, 80, 64, 800, 414, 40, "#a8c49a");
  rounded(ctx, 83, 62, 794, 410, 38, "#f2e6c3");
  rounded(ctx, 149, 125, 662, 284, 28, "#badaac");
  rounded(ctx, 83, 229, 794, 87, 15, "#e4d4af");
  rounded(ctx, 83, 226, 794, 85, 15, "#f7ebcc");
  rounded(ctx, 446, 65, 68, 406, 10, "#f7ebcc");
  for (let x = 103; x < 860; x += 42) {
    stroke(ctx, [[x, 235], [x + 5, 235]], "rgba(168,142,108,.17)");
    stroke(ctx, [[x + 14, 302], [x + 26, 302]], "rgba(168,142,108,.14)");
  }
  for (const [x, y] of [[58, 53], [902, 53], [58, 487], [902, 487], [182, 134], [779, 410]]) {
    ellipse(ctx, x, y + 5, 18, 9, "#93bf98");
    flower(ctx, x - 7, y, 7, "#fff6de"); flower(ctx, x + 8, y - 5, 6, "#f6b8b9");
    flower(ctx, x + 7, y + 8, 4, "#f8dc89");
  }
  drawSpawnMedallion(ctx, 110, 270, "#6bbcb0", "#def8e0");
  drawSpawnMedallion(ctx, 850, 270, "#dd9aa7", "#ffe3df");
  ctx.restore();
  drawCornerCaps(ctx, "#f7efd0", "#75b798");
}

function drawBay(ctx: Context): void {
  frame(ctx, "#8edbd8", "#e3edcb", "#4fa5af");
  ctx.save();
  ctx.beginPath(); ctx.roundRect(28, 24, 904, 492, 12); ctx.clip();
  ctx.fillStyle = gradient(ctx, 0, 24, 492, "#fff0c7", "#efd59e");
  ctx.fillRect(28, 24, 904, 492);
  // Small, sparse shell grains leave projectiles readable across the bright sand.
  for (let i = 0; i < 200; i += 1) {
    const x = 42 + (i * 137) % 870;
    const y = 33 + (i * 71) % 472;
    ellipse(ctx, x, y, 1.1, 0.75, i % 3 === 0 ? "#fff7df" : "rgba(197,154,102,.25)");
  }
  // Central connected boardwalk. Pools are separate, genuinely impassable obstacle rectangles.
  rounded(ctx, 251, 184, 458, 175, 16, "rgba(145,102,75,.19)");
  rounded(ctx, 252, 179, 456, 175, 14, "#b99b79");
  for (let index = 0; index < 19; index += 1) {
    const x = 254 + index * 24;
    rounded(ctx, x, 182, 22, 168, 3, gradient(ctx, x, 182, 168, index % 2 === 0 ? "#f5ddae" : "#eed09f", "#d6af7e"));
    stroke(ctx, [[x + 4, 193], [x + 4, 334]], "rgba(255,249,215,.5)");
    stroke(ctx, [[x + 14, 216], [x + 15, 263], [x + 13, 302]], "rgba(164,116,80,.2)");
    ellipse(ctx, x + 11, 190, 1.4, 1.4, "#bb916a");
    ellipse(ctx, x + 11, 340, 1.4, 1.4, "#bb916a");
  }
  for (const obstacle of ARCADE_STAGES[1]!.obstacles.filter((item) => item.id.startsWith("bay-water-"))) {
    rounded(ctx, obstacle.x - obstacle.width / 2 - 7, obstacle.y - obstacle.height / 2 - 7, obstacle.width + 14, obstacle.height + 14, 15, "#fdf6db");
    ctx.save(); ctx.translate(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2);
    drawWater(ctx, obstacle.width, obstacle.height); ctx.restore();
  }
  for (const [x, y, color] of [[74, 88, "#f1a6a4"], [886, 452, "#eed6b0"], [137, 476, "#f2bda6"], [825, 60, "#b8d6d4"]] as const) {
    drawShell(ctx, x, y, color);
  }
  drawSpawnMedallion(ctx, 104, 270, "#63bfcb", "#e2ffff");
  drawSpawnMedallion(ctx, 856, 270, "#de9b9c", "#ffe7d5");
  ctx.restore();
  drawCornerCaps(ctx, "#fff1cb", "#74c6c9");
}

function drawPicnic(ctx: Context): void {
  frame(ctx, "#ebc8ad", "#f8dfb4", "#b88f7c");
  ctx.save();
  ctx.beginPath(); ctx.roundRect(28, 24, 904, 492, 12); ctx.clip();
  ctx.fillStyle = gradient(ctx, 0, 24, 492, "#dde8ba", "#b5d2a1");
  ctx.fillRect(28, 24, 904, 492);
  for (let x = 40; x < 932; x += 36) {
    for (let y = 35; y < 516; y += 36) {
      ellipse(ctx, x + (y % 7), y, 7, 2, "rgba(243,250,205,.19)");
    }
  }
  rounded(ctx, 63, 65, 840, 421, 46, "rgba(98,125,83,.21)");
  rounded(ctx, 61, 59, 838, 418, 45, "#fff2d9");
  rounded(ctx, 68, 66, 824, 402, 39, "#e8b19b");
  ctx.save(); ctx.beginPath(); ctx.roundRect(73, 71, 814, 390, 35); ctx.clip();
  ctx.fillStyle = "#fff1dd"; ctx.fillRect(73, 71, 814, 390);
  ctx.fillStyle = "rgba(234,145,129,.25)";
  for (let x = 73; x < 887; x += 48) ctx.fillRect(x, 71, 24, 390);
  for (let y = 71; y < 461; y += 48) ctx.fillRect(73, y, 814, 24);
  for (let y = 77; y < 461; y += 12) stroke(ctx, [[73, y], [887, y]], "rgba(255,253,241,.19)");
  ctx.restore();
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff8e8";
  ctx.beginPath(); ctx.roundRect(79, 78, 802, 376, 30); ctx.stroke(); ctx.setLineDash([]);
  // An embroidered flower rosette forms an open arena around the center biscuit.
  ellipse(ctx, 480, 270, 110, 105, "rgba(252,242,221,.7)");
  for (let petal = 0; petal < 12; petal += 1) {
    const angle = petal * Math.PI / 6;
    ellipse(ctx, 480 + Math.cos(angle) * 95, 270 + Math.sin(angle) * 89, 4, 4, "#e8b197");
  }
  for (const [x, y] of [[48, 60], [912, 478], [160, 38], [800, 502]]) {
    flower(ctx, x, y, 7, "#fff4d6"); flower(ctx, x + 14, y + 2, 4, "#f8bab4");
  }
  drawSpawnMedallion(ctx, 100, 270, "#82b9a5", "#e7f5d7");
  drawSpawnMedallion(ctx, 860, 270, "#d39999", "#ffe5df");
  ctx.restore();
  drawCornerCaps(ctx, "#fff0ce", "#dcad93");
}

function drawSpawnMedallion(ctx: Context, x: number, y: number, line: string, fill: string): void {
  ellipse(ctx, x, y + 3, 31, 23, "rgba(86,98,77,.13)");
  ellipse(ctx, x, y, 30, 23, fill);
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 26, 19, 0, 0, Math.PI * 2); ctx.stroke();
  flower(ctx, x, y, 9, line);
}

function drawCornerCaps(ctx: Context, top: string, side: string): void {
  for (const [x, y] of [[18, 14], [925, 14], [18, 500], [925, 500]]) {
    rounded(ctx, x, y + 4, 18, 21, 6, side);
    rounded(ctx, x, y, 18, 20, 6, top);
    ellipse(ctx, x + 6, y + 6, 3, 2, "#fffbea");
  }
}

function drawShell(ctx: Context, x: number, y: number, color: string): void {
  ellipse(ctx, x, y + 3, 12, 6, "rgba(151,120,88,.13)");
  ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.arc(x, y, 11, Math.PI, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  for (const dx of [-6, 0, 6]) stroke(ctx, [[x, y + 4], [x + dx, y - 7]], "rgba(255,248,226,.7)", 1.5);
}

function drawWater(ctx: Context, width: number, height: number): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  // Square outer fill matches the complete collision footprint; ripples are inset decoration.
  ctx.fillStyle = "#40949f"; ctx.fillRect(0, 0, width, height);
  rounded(ctx, 2, 2, width - 4, height - 4, 7, gradient(ctx, 0, 0, height, "#74dcd9", "#39b6ca"));
  rounded(ctx, 6, 6, width - 12, height - 12, 5, gradient(ctx, 0, 0, height, "#68d7d7", "#37b9cc"));
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < Math.ceil(width / 55); column += 1) {
      const x = 14 + column * 55 + (row % 2) * 13;
      const y = 20 + row * 28;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 7, y + 5, x + 15, y + 5, x + 24, y);
      ctx.strokeStyle = "rgba(217,255,241,.6)"; ctx.lineWidth = 2; ctx.stroke();
      ellipse(ctx, x + 29, y + 8, 2, 1.4, "rgba(231,255,250,.4)");
    }
  }
  stroke(ctx, [[8, 5], [width - 8, 5]], "#c7fff0", 3);
  stroke(ctx, [[5, 10], [5, height - 9]], "rgba(191,255,244,.8)", 2);
  stroke(ctx, [[9, height - 5], [width - 9, height - 5]], "rgba(31,131,158,.42)", 2);
  ctx.restore();
}

function drawHedge(ctx: Context, width: number, height: number): void {
  rounded(ctx, 0, 0, width, height, 9, "#4a8b67");
  rounded(ctx, 2, 2, width - 4, height - 5, 8, gradient(ctx, 0, 0, height, "#a0d986", "#579d6b"));
  rounded(ctx, 4, 3, width - 8, height - 14, 8, gradient(ctx, 0, 0, height, "#c7e8a1", "#79ba78"));
  ctx.save(); ctx.beginPath(); ctx.roundRect(4, 3, width - 8, height - 14, 8); ctx.clip();
  for (let row = 0; row < Math.ceil(height / 19); row += 1) {
    for (let col = 0; col < Math.ceil(width / 21); col += 1) {
      const x = col * 21 + 9 + (row % 2) * 8;
      const y = row * 19 + 9;
      ellipse(ctx, x, y + 3, 11, 8, "rgba(72,138,87,.18)");
      ellipse(ctx, x - 1, y, 10, 7, (row + col) % 3 === 0 ? "#a7d894" : "#b5df97");
      ellipse(ctx, x - 3, y - 2, 4, 2, "rgba(235,250,188,.48)");
    }
  }
  ctx.restore();
  stroke(ctx, [[10, 5], [width - 10, 5]], "rgba(237,255,192,.8)", 2);
  stroke(ctx, [[8, height - 7], [width - 8, height - 7]], "rgba(44,109,73,.35)", 2);
  if (width > 85) flower(ctx, width * 0.24, height * 0.32, 4, "#fff0bc");
  else flower(ctx, width * 0.5, 21, 4, "#f8e7b4");
}

function drawWood(ctx: Context, width: number, height: number): void {
  rounded(ctx, 0, 0, width, height, 7, "#8e7964");
  rounded(ctx, 2, 2, width - 4, height - 4, 6, gradient(ctx, 0, 0, height, "#f6dca2", "#c7946a"));
  rounded(ctx, 5, 4, width - 10, height - 13, 4, "#eac490");
  const plankWidth = (width - 12) / 3;
  for (let column = 0; column < 3; column += 1) {
    const x = 6 + plankWidth * column;
    rounded(ctx, x, 5, plankWidth - 1, height - 15, 2, gradient(ctx, 0, 5, height - 15, column % 2 === 0 ? "#ffe7b5" : "#f5d7a1", "#d4aa7a"));
    stroke(ctx, [[x + 4, 13], [x + 3, height - 18]], "rgba(163,119,83,.19)");
  }
  rounded(ctx, 3, height * 0.38, width - 6, 11, 3, "#589ba7");
  rounded(ctx, 4, height * 0.38, width - 8, 6, 2, "#9dddd9");
  for (const x of [9, width - 9]) ellipse(ctx, x, height * 0.38 + 4, 2, 2, "#ebf9d9");
  stroke(ctx, [[8, 4], [width - 8, 4]], "#fff3cc", 2);
}

function drawBiscuit(ctx: Context, width: number, height: number): void {
  rounded(ctx, 0, 0, width, height, 10, "#b38262");
  rounded(ctx, 2, 2, width - 4, height - 4, 9, gradient(ctx, 0, 0, height, "#f4d9a5", "#ce9c76"));
  rounded(ctx, 4, 3, width - 8, height - 12, 8, gradient(ctx, 0, 0, height, "#ffe6b3", "#eebd8d"));
  ctx.strokeStyle = "#daab80"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(9, 8, width - 18, height - 23, 5); ctx.stroke();
  for (let x = 17; x < width - 12; x += 16) {
    for (let y = 17; y < height - 15; y += 16) {
      ellipse(ctx, x, y, 1.6, 1.6, "#d4a77b"); ellipse(ctx, x, y + 1, 1, 0.65, "#ffe9be");
    }
  }
  rounded(ctx, 3, height - 10, width - 6, 3, 1, "#ffeed7");
  flower(ctx, width / 2, (height - 8) / 2, 9, "#f7b1a7");
  ellipse(ctx, width / 2 - 2, (height - 8) / 2 - 3, 2.5, 1.4, "#ffd7c7");
  stroke(ctx, [[12, 5], [width - 12, 5]], "#fff4d2", 2);
}
