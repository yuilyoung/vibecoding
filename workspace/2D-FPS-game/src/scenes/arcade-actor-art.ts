import type Phaser from "phaser";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import {
  ACTOR_ANIMATION_STATES, ACTOR_DIRECTIONS,
  ARCADE_ACTOR_ATLAS_COLUMNS, ARCADE_ACTOR_ATLAS_HEIGHT, ARCADE_ACTOR_ATLAS_WIDTH,
  ARCADE_ACTOR_FRAME_SIZE, getActorAnimationFrameKeys, isArcadeActorSkin,
  type ActorAnimationState, type ActorDirection, type ActorSkinDefinition
} from "../domain/visual/ActorSkinCatalog";

interface ArcadePalette {
  readonly ink: string;
  readonly hood: string;
  readonly shade: string;
  readonly light: string;
  readonly accent: string;
  readonly shoes: string;
}

const PALETTES: Readonly<Record<TeamId, ArcadePalette>> = Object.freeze({
  BLUE: { ink: "#344b72", hood: "#84ceef", shade: "#5686bf", light: "#e6faff", accent: "#ffe899", shoes: "#587eb5" },
  RED: { ink: "#764b68", hood: "#ffb9c7", shade: "#dc829e", light: "#fff1e9", accent: "#c9f6db", shoes: "#c37399" }
});

/** Game texture manager owns this bounded cache (two skins × two teams + four blasters).
 * Scene composition owns only the display objects; restarts reuse textures and animations.
 * Generation runs once during scene construction, never in the frame loop.
 */
export function ensureArcadeActorTextures(scene: Phaser.Scene, definition: ActorSkinDefinition): void {
  if (!isArcadeActorSkin(definition)) return;
  for (const team of ["BLUE", "RED"] as const) {
    const key = definition.teamTextures[team].textureKey;
    if (!scene.textures.exists(key)) {
      const atlas = scene.textures.createCanvas(key, ARCADE_ACTOR_ATLAS_WIDTH, ARCADE_ACTOR_ATLAS_HEIGHT);
      if (atlas === null) continue;
      const context = atlas.getContext();
      let index = 0;
      for (const state of ACTOR_ANIMATION_STATES) {
        for (const direction of ACTOR_DIRECTIONS) {
          const frames = getActorAnimationFrameKeys(definition, team, state, direction);
          for (const [frameIndex, frameKey] of frames.entries()) {
            const x = (index % ARCADE_ACTOR_ATLAS_COLUMNS) * ARCADE_ACTOR_FRAME_SIZE;
            const y = Math.floor(index / ARCADE_ACTOR_ATLAS_COLUMNS) * ARCADE_ACTOR_FRAME_SIZE;
            context.save();
            context.translate(x, y);
            context.scale(1.5, 1.5);
            drawArcadeActorFrame(context, definition.id === "arcade-bear", team, state, direction, frameIndex, frames.length);
            context.restore();
            atlas.add(frameKey, 0, x, y, ARCADE_ACTOR_FRAME_SIZE, ARCADE_ACTOR_FRAME_SIZE);
            index++;
          }
        }
      }
      atlas.refresh();
    }
    ensureBlaster(scene, team, false);
    ensureBlaster(scene, team, true);
  }
}

export function getArcadeBlasterTexture(team: TeamId, weaponId: string): string {
  return `arcade-blaster-${team.toLowerCase()}-${weaponId === "scatter" ? "scatter" : "carbine"}`;
}

/** Authored vector forms rasterized to an atlas. Every state has changing poses;
 * eight directions change face projection, hood seams, near ear, hands and feet.
 */
export function drawArcadeActorFrame(
  ctx: CanvasRenderingContext2D,
  bear: boolean,
  team: TeamId,
  state: ActorAnimationState,
  direction: ActorDirection,
  frame: number,
  count: number
): void {
  const p = PALETTES[team];
  const octant = ACTOR_DIRECTIONS.indexOf(direction);
  const angle = octant * Math.PI / 4;
  const side = Math.cos(angle);
  const back = Math.sin(angle) < -0.5;
  const profile = Math.abs(side) > 0.9;
  const phase = frame / count * Math.PI * 2;
  const progress = frame / Math.max(1, count - 1);
  const running = state === "run";
  const dead = state === "death";
  const stride = running ? Math.sin(phase) * 3.3 : 0;
  const bob = running ? -Math.abs(Math.sin(phase)) * 2.1 : Math.sin(phase) * 0.65;
  const recoil = state === "fire" ? Math.sin(progress * Math.PI) * 2.3 : 0;
  const hood = bear ? "#edc08c" : p.hood;
  const hoodShade = bear ? "#c88868" : p.shade;
  const hoodLight = bear ? "#fff0c4" : p.light;

  // Contact shadow remains grounded while the silhouette bounces above it.
  ellipse(ctx, 32, 58, 15 - Math.abs(bob), 3.2, "#344b7240");
  ctx.save();
  ctx.translate(32 - side * recoil, 56 + bob + (dead ? progress * 3 : 0));
  if (dead) ctx.scale(1 + progress * 0.18, 1 - progress * 0.34);
  if (state === "hit") ctx.rotate(frame === 0 ? -0.12 : 0.1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Short padded boots and a tiny rounded romper give a classic two-head silhouette.
  ellipse(ctx, -7 - side, -1 + stride, 6.1, 4.1, p.shoes, p.ink, 1.5);
  ellipse(ctx, 7 - side, -1 - stride, 6.1, 4.1, p.shoes, p.ink, 1.5);
  ellipse(ctx, -8 - side, -2 + stride, 3.2, 1.1, "#ffffff99");
  ellipse(ctx, 6 - side, -2 - stride, 3.2, 1.1, "#ffffff99");
  ellipse(ctx, 0, -12, 11.8, 13.4, gradient(ctx, -25, 2, p.light, p.hood, p.shade), p.ink, 1.8);
  ellipse(ctx, side * 2, -12, 7.3, 8.1, "#fff7e8", p.shade, 0.8);
  ellipse(ctx, -12, -13 - stride * 0.4, 4.3, 5.6, hood, p.ink, 1.5);
  ellipse(ctx, 12, -13 + stride * 0.4, 4.3, 5.6, hood, p.ink, 1.5);
  ellipse(ctx, -12, -11 - stride * 0.4, 2.4, 2.8, "#ffe8d5");
  ellipse(ctx, 12, -11 + stride * 0.4, 2.4, 2.8, "#ffe8d5");

  // Ears are part of the costume, with separate highlight and inner fabric layers.
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.translate(sign * (bear ? 12.5 : 9.1), bear ? -43 : -43.5);
    ctx.rotate(sign * (bear ? 0.15 : 0.12) + (running ? stride * 0.025 : bob * 0.05));
    ellipse(ctx, 0, 0, bear ? 7.1 : 4.9, bear ? 7.1 : 9.5,
      gradient(ctx, -13, 9, hoodLight, hood, hoodShade), p.ink, 1.8);
    ellipse(ctx, 0, bear ? 0 : -0.7, bear ? 3.8 : 2.4, bear ? 3.8 : 6.4, bear ? "#d99579" : "#ffaac2");
    ctx.restore();
  }

  ellipse(ctx, 0, -31, 18.2, 16.1, gradient(ctx, -48, -15, hoodLight, hood, hoodShade), p.ink, 1.9);
  ellipse(ctx, -7, -42.6, 7.7, 2.1, "#ffffff8c");
  if (back) {
    // North-facing frames show a stitched hood and pompom, not a front face rotated flat.
    stroke(ctx, [[side * 4, -44], [side * 3, -36], [side * 2, -24]], hoodShade, 1.2);
    ellipse(ctx, side * 7, -29, 5.1, 4.8, hoodLight, hoodShade, 1.1);
    ellipse(ctx, -side * 6, -7, 4.2, 3.6, hoodLight, p.shade, 0.8);
  } else {
    const faceX = side * (profile ? 5 : 2.5);
    const faceW = profile ? 12.2 : 14.9;
    ellipse(ctx, faceX, -29, faceW, 11.7, gradient(ctx, -42, -18, "#fff9e8", "#ffe8d3", "#f6c8bb"), hoodShade, 1.3);
    ellipse(ctx, faceX - 8, -25.2, 3.4, 1.9, "#f39fb3ad");
    ellipse(ctx, faceX + 8, -25.2, 3.4, 1.9, "#f39fb3ad");
    const eyes = profile ? [side * 3.5 - 2.8, side * 3.5 + 4.8] : [-5.8, 5.8];
    for (const eye of eyes) {
      const eyeX = faceX + eye;
      if (state === "hit" || dead) {
        stroke(ctx, [[eyeX - 2.2, -31.3], [eyeX + 1.5, -29.8], [eyeX - 2.2, -28.2]], p.ink, 1.4);
      } else if (state === "idle" && frame === count - 1) {
        stroke(ctx, [[eyeX - 2, -29], [eyeX, -28.3], [eyeX + 2, -29]], p.ink, 1.4);
      } else {
        ellipse(ctx, eyeX, -30.5, profile ? 1.6 : 2.1, 3.1, p.ink);
        ellipse(ctx, eyeX - 0.5, -31.7, 0.7, 0.9, "#ffffff");
      }
    }
    if (state === "fire") ellipse(ctx, faceX + side * 1.4, -23.9, 1.5, 2, "#bb7184");
    else stroke(ctx, [[faceX - 2, -23.9], [faceX, -22.8], [faceX + 2, -23.9]], "#bb7184", 1.1);
    if (bear) ellipse(ctx, faceX, -27, 1.5, 1, "#996c66");
  }

  // Shape-coded team accessories remain distinct even without color perception.
  if (team === "BLUE") {
    star(ctx, -12 + side, -39, 4.2, p.accent, p.ink);
    rounded(ctx, -8, -18, 16, 3.2, 1.5, p.shade);
    rounded(ctx, 3, -18, 3.8, 8, 1.4, p.accent, p.ink, 0.7);
  } else {
    ellipse(ctx, 10 + side, -39, 4.2, 3, p.accent, p.ink, 1);
    ellipse(ctx, 16 + side, -39, 4.2, 3, p.accent, p.ink, 1);
    ellipse(ctx, 13 + side, -39, 1.9, 2.1, "#fff9e8", p.ink, 0.8);
    heart(ctx, side, -12, 3.1, "#e993ae");
  }
  ctx.restore();

  if (dead) {
    for (let i = 0; i < 3; i++) {
      const drift = progress * 7;
      ellipse(ctx, 22 + i * 10 + Math.sin(i + progress * 3) * 2, 25 - drift - i * 4,
        2 + progress, 2 + progress, "#e4faff75", "#ffffffcc", 0.9);
    }
  }
}

function ensureBlaster(scene: Phaser.Scene, team: TeamId, scatter: boolean): void {
  const key = getArcadeBlasterTexture(team, scatter ? "scatter" : "carbine");
  if (!scene.textures.exists(key)) {
    const sheet = scene.textures.createCanvas(key, 64 * 4, 64);
    if (sheet === null) return;
    const ctx = sheet.getContext();
    const p = PALETTES[team];
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(i * 64, Math.sin(i / 3 * Math.PI) * 2);
      rounded(ctx, 28, 35, 8, 15, 3, p.shade, p.ink, 1.6);
      rounded(ctx, 24, 26, 16, 18, 6, gradient(ctx, 26, 44, "#f3ffff", p.hood, p.shade), p.ink, 1.6);
      ellipse(ctx, 32, 33, 5.2, 5.5, "#8ce5e8", p.ink, 1.2);
      ellipse(ctx, 30.5, 31, 2.1, 2.7, "#ffffffa0");
      rounded(ctx, scatter ? 23 : 27, 20, scatter ? 18 : 10, 9, 3, p.accent, p.ink, 1.6);
      rounded(ctx, scatter ? 24 : 28, 20, scatter ? 16 : 8, 3.1, 1.5, "#5ba7c3", p.ink, 0.8);
      if (i === 1 || i === 2) {
        ellipse(ctx, 32, 15 - i, 3 - i * 0.4, 4, "#b7faff", "#ffffff", 1);
        ellipse(ctx, 25, 17, 1.5, 2, "#c8ffff");
      }
      ctx.restore();
      sheet.add(i, 0, i * 64, 0, 64, 64);
    }
    sheet.refresh();
  }
  if (!scene.anims.exists(`${key}-fire`)) {
    scene.anims.create({ key: `${key}-fire`, frames: [0, 1, 2, 3].map((frame) => ({ key, frame })), frameRate: 18, repeat: 0 });
  }
}

function gradient(ctx: CanvasRenderingContext2D, top: number, bottom: number, light: string, color: string, shade: string): CanvasGradient {
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, light);
  fill.addColorStop(0.4, color);
  fill.addColorStop(1, shade);
  return fill;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  fill: string | CanvasGradient, outline?: string, width = 1): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke(); }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  fill: string | CanvasGradient, outline?: string, width = 1): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke(); }
}

function stroke(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, outline: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius * 0.47;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 2, y, x - r, y - r * 1.6, x, y - r * 0.5);
  ctx.bezierCurveTo(x + r, y - r * 1.6, x + r * 2, y, x, y + r);
  ctx.fillStyle = color;
  ctx.fill();
}
