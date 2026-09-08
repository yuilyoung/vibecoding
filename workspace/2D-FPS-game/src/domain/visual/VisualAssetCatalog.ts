import type { WeatherState } from "../environment/WeatherLogic";
import type { MapObjectKind } from "../map/MapObjectLogic";
import type { TeamId } from "../round/MatchFlowLogic";

export type HudTeam = TeamId | "UNSET";
export type VisualAssetSourceId = "kenney-top-down-shooter" | "ground-shaker" | "pixwep";

export interface VisualAssetSource {
  readonly id: VisualAssetSourceId;
  readonly label: string;
  readonly homepage: string;
  readonly license: "CC0-1.0";
  readonly localLicense: string;
}

export interface OperatorPortraitSet {
  readonly playerPath: string;
  readonly enemyPath: string;
  readonly playerLabel: string;
  readonly enemyLabel: string;
  readonly sourceId: "kenney-top-down-shooter";
}

export interface WeaponHudAsset {
  readonly id: string;
  readonly label: string;
  readonly iconPath: string;
  readonly sourceId: "pixwep";
  readonly fallback: boolean;
}

export interface StageVisualTheme {
  readonly id: string;
  readonly label: string;
  readonly terrainCrop: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly terrainTint: number;
  readonly overlayColor: number;
  readonly overlayAlpha: number;
  readonly borderColor: number;
  readonly accentCss: string;
}

export interface MapObjectVisualTheme {
  readonly kind: MapObjectKind;
  readonly label: string;
  readonly glyph: string;
  readonly fillColor: number;
  readonly accentColor: number;
  readonly shadowColor: number;
  readonly description: string;
}

export interface WeatherVisualTheme {
  readonly type: WeatherState["type"];
  readonly label: string;
  readonly icon: string;
  readonly atmosphereColor: number;
  readonly atmosphereAlpha: number;
  readonly accentCss: string;
}

export const VISUAL_ASSET_SOURCES: Readonly<Record<VisualAssetSourceId, VisualAssetSource>> = Object.freeze({
  "kenney-top-down-shooter": Object.freeze({
    id: "kenney-top-down-shooter",
    label: "Kenney Top-down Shooter",
    homepage: "https://kenney.nl/assets/top-down-shooter",
    license: "CC0-1.0",
    localLicense: "/assets/source/kenney-top-down-shooter/License.txt"
  }),
  "ground-shaker": Object.freeze({
    id: "ground-shaker",
    label: "Ground Shaker",
    homepage: "https://zintoki.itch.io/ground-shaker",
    license: "CC0-1.0",
    localLicense: "/assets/source/ASSET_MANIFEST.md"
  }),
  pixwep: Object.freeze({
    id: "pixwep",
    label: "PIXWEP",
    homepage: "https://zintoki.itch.io/pixwep",
    license: "CC0-1.0",
    localLicense: "/assets/source/ASSET_MANIFEST.md"
  })
});

const OPERATOR_PORTRAITS: Readonly<Record<HudTeam, OperatorPortraitSet>> = Object.freeze({
  BLUE: Object.freeze({
    playerPath: "/assets/runtime/sprites/player-blue.png",
    enemyPath: "/assets/runtime/sprites/enemy-red.png",
    playerLabel: "Blue Vanguard operator",
    enemyLabel: "Red Vanguard operator",
    sourceId: "kenney-top-down-shooter"
  }),
  RED: Object.freeze({
    playerPath: "/assets/runtime/sprites/player-red.png",
    enemyPath: "/assets/runtime/sprites/enemy-blue.png",
    playerLabel: "Red Vanguard operator",
    enemyLabel: "Blue Vanguard operator",
    sourceId: "kenney-top-down-shooter"
  }),
  UNSET: Object.freeze({
    playerPath: "/assets/runtime/sprites/player-blue.png",
    enemyPath: "/assets/runtime/sprites/enemy-red.png",
    playerLabel: "Blue Vanguard operator",
    enemyLabel: "Red Vanguard operator",
    sourceId: "kenney-top-down-shooter"
  })
});

export const CONFIGURED_WEAPON_IDS = Object.freeze(["carbine", "scatter", "bazooka", "grenade", "sniper", "airStrike"] as const);

const WEAPON_HUD_ASSETS: Readonly<Record<(typeof CONFIGURED_WEAPON_IDS)[number], WeaponHudAsset>> = Object.freeze({
  carbine: Object.freeze({ id: "carbine", label: "Carbine", iconPath: "/assets/runtime/sprites/weapon-hud-carbine.png", sourceId: "pixwep", fallback: false }),
  scatter: Object.freeze({ id: "scatter", label: "Scatter", iconPath: "/assets/runtime/sprites/weapon-hud-scatter.png", sourceId: "pixwep", fallback: false }),
  bazooka: Object.freeze({ id: "bazooka", label: "Bazooka", iconPath: "/assets/runtime/sprites/weapon-hud-bazooka.png", sourceId: "pixwep", fallback: false }),
  grenade: Object.freeze({ id: "grenade", label: "Grenade", iconPath: "/assets/runtime/sprites/weapon-hud-grenade.png", sourceId: "pixwep", fallback: false }),
  sniper: Object.freeze({ id: "sniper", label: "Sniper", iconPath: "/assets/runtime/sprites/weapon-hud-sniper.png", sourceId: "pixwep", fallback: false }),
  airStrike: Object.freeze({ id: "airStrike", label: "Air Strike", iconPath: "/assets/runtime/sprites/weapon-hud-air-strike.png", sourceId: "pixwep", fallback: false })
});

const UNKNOWN_WEAPON_HUD_ASSET: WeaponHudAsset = Object.freeze({
  id: "unknown",
  label: "Unknown weapon",
  iconPath: "/assets/runtime/sprites/weapon-hud-carbine.png",
  sourceId: "pixwep",
  fallback: true
});

export const CONFIGURED_STAGE_IDS = Object.freeze(["foundry", "relay-yard", "storm-drain"] as const);

const STAGE_VISUAL_THEMES: Readonly<Record<(typeof CONFIGURED_STAGE_IDS)[number], StageVisualTheme>> = Object.freeze({
  foundry: Object.freeze({ id: "foundry", label: "Foundry", terrainCrop: Object.freeze({ x: 0, y: 0, width: 896, height: 640 }), terrainTint: 0xf2b66d, overlayColor: 0x7a3218, overlayAlpha: 0.09, borderColor: 0xffbd66, accentCss: "#ffbd66" }),
  "relay-yard": Object.freeze({ id: "relay-yard", label: "Relay Yard", terrainCrop: Object.freeze({ x: 96, y: 48, width: 704, height: 512 }), terrainTint: 0x8ad9ff, overlayColor: 0x15445d, overlayAlpha: 0.1, borderColor: 0x78d8ff, accentCss: "#78d8ff" }),
  "storm-drain": Object.freeze({ id: "storm-drain", label: "Storm Drain", terrainCrop: Object.freeze({ x: 224, y: 64, width: 576, height: 512 }), terrainTint: 0x9fc5b6, overlayColor: 0x153f3a, overlayAlpha: 0.13, borderColor: 0x79d8bd, accentCss: "#79d8bd" })
});

export const CONFIGURED_ARCADE_STAGE_IDS = Object.freeze(["garden-maze", "bubble-bay", "picnic-plaza"] as const);

const ARCADE_STAGE_VISUAL_THEMES: Readonly<Record<(typeof CONFIGURED_ARCADE_STAGE_IDS)[number], StageVisualTheme>> = Object.freeze({
  "garden-maze": Object.freeze({ id: "garden-maze", label: "클로버 미로", terrainCrop: Object.freeze({ x: 0, y: 0, width: 896, height: 640 }), terrainTint: 0xffffff, overlayColor: 0xffffff, overlayAlpha: 0, borderColor: 0x72c99b, accentCss: "#72c99b" }),
  "bubble-bay": Object.freeze({ id: "bubble-bay", label: "버블 베이", terrainCrop: Object.freeze({ x: 96, y: 48, width: 704, height: 512 }), terrainTint: 0xffffff, overlayColor: 0xffffff, overlayAlpha: 0, borderColor: 0x63cddd, accentCss: "#63cddd" }),
  "picnic-plaza": Object.freeze({ id: "picnic-plaza", label: "피크닉 광장", terrainCrop: Object.freeze({ x: 224, y: 64, width: 576, height: 512 }), terrainTint: 0xffffff, overlayColor: 0xffffff, overlayAlpha: 0, borderColor: 0xf2a293, accentCss: "#f2a293" })
});

export const MAP_OBJECT_KINDS = Object.freeze(["barrel", "mine", "crate", "cover", "bounce-wall", "teleporter"] as const satisfies readonly MapObjectKind[]);

const MAP_OBJECT_VISUALS: Readonly<Record<MapObjectKind, MapObjectVisualTheme>> = Object.freeze({
  barrel: Object.freeze({ kind: "barrel", label: "Blast Barrel", glyph: "!", fillColor: 0xc94343, accentColor: 0xffad66, shadowColor: 0x421b23, description: "Explosive" }),
  mine: Object.freeze({ kind: "mine", label: "Proximity Mine", glyph: "M", fillColor: 0x3b4654, accentColor: 0xffdf5d, shadowColor: 0x111827, description: "Arms and triggers" }),
  crate: Object.freeze({ kind: "crate", label: "Supply Crate", glyph: "+", fillColor: 0x76512c, accentColor: 0xe7bb62, shadowColor: 0x2f2117, description: "Drops supplies" }),
  cover: Object.freeze({ kind: "cover", label: "Breakable Cover", glyph: "C", fillColor: 0x3f4c59, accentColor: 0x9fb7c9, shadowColor: 0x18212a, description: "Blocks fire" }),
  "bounce-wall": Object.freeze({ kind: "bounce-wall", label: "Bounce Wall", glyph: "↗", fillColor: 0x164d71, accentColor: 0x5ee4ff, shadowColor: 0x0d2536, description: "Reflects shots" }),
  teleporter: Object.freeze({ kind: "teleporter", label: "Teleporter", glyph: "T", fillColor: 0x183d56, accentColor: 0x64f0ff, shadowColor: 0x0b1f31, description: "Linked transit" })
});

export const WEATHER_TYPES = Object.freeze(["clear", "rain", "fog", "sandstorm", "storm"] as const satisfies readonly WeatherState["type"][]);

const WEATHER_VISUAL_THEMES: Readonly<Record<WeatherState["type"], WeatherVisualTheme>> = Object.freeze({
  clear: Object.freeze({ type: "clear", label: "Clear", icon: "CLR", atmosphereColor: 0x63b3d1, atmosphereAlpha: 0, accentCss: "#9ee7ff" }),
  rain: Object.freeze({ type: "rain", label: "Rain", icon: "RAIN", atmosphereColor: 0x183f68, atmosphereAlpha: 0.13, accentCss: "#8ecbff" }),
  fog: Object.freeze({ type: "fog", label: "Fog", icon: "FOG", atmosphereColor: 0xc8d7df, atmosphereAlpha: 0.11, accentCss: "#dbe8ef" }),
  sandstorm: Object.freeze({ type: "sandstorm", label: "Sandstorm", icon: "SAND", atmosphereColor: 0xa35f25, atmosphereAlpha: 0.17, accentCss: "#f2b866" }),
  storm: Object.freeze({ type: "storm", label: "Storm", icon: "STORM", atmosphereColor: 0x37275e, atmosphereAlpha: 0.2, accentCss: "#c9b4ff" })
});

export function getOperatorPortraits(team: string): OperatorPortraitSet {
  return OPERATOR_PORTRAITS[team as HudTeam] ?? OPERATOR_PORTRAITS.UNSET;
}

export function getWeaponHudAsset(weaponId: string): WeaponHudAsset {
  return WEAPON_HUD_ASSETS[weaponId as keyof typeof WEAPON_HUD_ASSETS] ?? UNKNOWN_WEAPON_HUD_ASSET;
}

export function getStageVisualTheme(stageId: string): StageVisualTheme {
  return ARCADE_STAGE_VISUAL_THEMES[stageId as keyof typeof ARCADE_STAGE_VISUAL_THEMES]
    ?? STAGE_VISUAL_THEMES[stageId as keyof typeof STAGE_VISUAL_THEMES]
    ?? STAGE_VISUAL_THEMES.foundry;
}

export function getMapObjectVisual(kind: MapObjectKind): MapObjectVisualTheme {
  return MAP_OBJECT_VISUALS[kind];
}

export function getWeatherVisualTheme(type: WeatherState["type"]): WeatherVisualTheme {
  return WEATHER_VISUAL_THEMES[type];
}
