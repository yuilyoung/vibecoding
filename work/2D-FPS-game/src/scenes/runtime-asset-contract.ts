import Phaser from "phaser";
import {
  FALLBACK_TURRET_KEY, GROUND_BODY_BLUE_KEY, GROUND_BODY_RED_KEY, GROUND_TERRAIN_KEY,
  GROUND_TURRET_CARBINE_BLUE_KEY, GROUND_TURRET_CARBINE_RED_KEY,
  GROUND_TURRET_SCATTER_BLUE_KEY, GROUND_TURRET_SCATTER_RED_KEY, WEAPON_GUN_KEY, WEAPON_MACHINE_KEY
} from "./scene-constants";

export type RuntimeAssetKind = "image" | "spritesheet";
export interface RuntimeAssetDefinition { readonly key: string; readonly path: string; readonly kind: RuntimeAssetKind; readonly fallbackKey?: string; readonly frameWidth?: number; readonly frameHeight?: number; }

/** Runtime art is local-only; source packs are never loaded directly by the game. */
export const RUNTIME_ASSET_MANIFEST: readonly RuntimeAssetDefinition[] = [
  { key: WEAPON_MACHINE_KEY, path: "/assets/runtime/sprites/weapon-machine.png", kind: "image" },
  { key: WEAPON_GUN_KEY, path: "/assets/runtime/sprites/weapon-gun.png", kind: "image" },
  { key: GROUND_BODY_BLUE_KEY, path: "/assets/runtime/sprites/ground-body-blue.png", kind: "image", fallbackKey: "skin-player-blue" },
  { key: GROUND_BODY_RED_KEY, path: "/assets/runtime/sprites/ground-body-red.png", kind: "image", fallbackKey: "skin-player-red" },
  { key: GROUND_TERRAIN_KEY, path: "/assets/runtime/sprites/ground-terrain.png", kind: "image" },
  { key: GROUND_TURRET_CARBINE_BLUE_KEY, path: "/assets/runtime/sprites/ground-turret-carbine-blue.png", kind: "spritesheet", fallbackKey: FALLBACK_TURRET_KEY, frameWidth: 128, frameHeight: 128 },
  { key: GROUND_TURRET_CARBINE_RED_KEY, path: "/assets/runtime/sprites/ground-turret-carbine-red.png", kind: "spritesheet", fallbackKey: FALLBACK_TURRET_KEY, frameWidth: 128, frameHeight: 128 },
  { key: GROUND_TURRET_SCATTER_BLUE_KEY, path: "/assets/runtime/sprites/ground-turret-scatter-blue.png", kind: "spritesheet", fallbackKey: FALLBACK_TURRET_KEY, frameWidth: 128, frameHeight: 128 },
  { key: GROUND_TURRET_SCATTER_RED_KEY, path: "/assets/runtime/sprites/ground-turret-scatter-red.png", kind: "spritesheet", fallbackKey: FALLBACK_TURRET_KEY, frameWidth: 128, frameHeight: 128 }
];
export function preloadRuntimeAssets(scene: Phaser.Scene): void {
  for (const asset of RUNTIME_ASSET_MANIFEST) {
    if (asset.kind === "image") scene.load.image(asset.key, asset.path);
    else scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth!, frameHeight: asset.frameHeight! });
  }
}
export function resolveRuntimeTextureKey(textures: Pick<Phaser.Textures.TextureManager, "exists">, primaryKey: string, fallbackKey: string): string { return textures.exists(primaryKey) ? primaryKey : fallbackKey; }
export function resolveTeamBodyTexture(scene: Phaser.Scene, team: "BLUE" | "RED"): string { return resolveRuntimeTextureKey(scene.textures, team === "BLUE" ? GROUND_BODY_BLUE_KEY : GROUND_BODY_RED_KEY, team === "BLUE" ? "skin-player-blue" : "skin-player-red"); }
export function resolveTurretTexture(scene: Phaser.Scene, primaryKey: string): string { return resolveRuntimeTextureKey(scene.textures, primaryKey, FALLBACK_TURRET_KEY); }