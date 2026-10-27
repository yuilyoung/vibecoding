import { CONFIGURED_STAGE_IDS, CONFIGURED_WEAPON_IDS, WEATHER_TYPES } from "../visual/VisualAssetCatalog";
import type { WeatherState } from "../environment/WeatherLogic";

export type DeploymentWeaponId = (typeof CONFIGURED_WEAPON_IDS)[number];
export type DeploymentStageId = (typeof CONFIGURED_STAGE_IDS)[number];
export type DeploymentWeatherId = (typeof WEATHER_TYPES)[number];
export type DeploymentActorSkinId = "legacy-vehicle" | "kenney-infantry" | "quaternius-animated";
export type DeploymentWorldSkinId = "legacy" | "product-v1";

export interface DeploymentSelection {
  readonly weapon: DeploymentWeaponId;
  readonly stage: DeploymentStageId;
  readonly enemyCount: number;
  readonly weather: DeploymentWeatherId;
  readonly actorSkin: DeploymentActorSkinId;
  readonly worldSkin: DeploymentWorldSkinId;
}

export const DEFAULT_DEPLOYMENT_SELECTION: DeploymentSelection = Object.freeze({
  weapon: "carbine",
  stage: "foundry",
  enemyCount: 1,
  weather: "clear",
  actorSkin: "quaternius-animated",
  worldSkin: "legacy"
});

const ACTOR_SKIN_IDS = ["legacy-vehicle", "kenney-infantry", "quaternius-animated"] as const satisfies readonly DeploymentActorSkinId[];
const WORLD_SKIN_IDS = ["legacy", "product-v1"] as const satisfies readonly DeploymentWorldSkinId[];

export function resolveDeploymentSelection(search: string): DeploymentSelection {
  const query = new URLSearchParams(search);
  return {
    weapon: readEnum(query.get("weapon"), CONFIGURED_WEAPON_IDS, DEFAULT_DEPLOYMENT_SELECTION.weapon),
    stage: readEnum(query.get("stage"), CONFIGURED_STAGE_IDS, DEFAULT_DEPLOYMENT_SELECTION.stage),
    enemyCount: clampEnemyCount(query.get("enemies")),
    weather: readEnum(query.get("weather"), WEATHER_TYPES, DEFAULT_DEPLOYMENT_SELECTION.weather),
    actorSkin: readEnum(query.get("actorSkin"), ACTOR_SKIN_IDS, DEFAULT_DEPLOYMENT_SELECTION.actorSkin),
    worldSkin: readEnum(query.get("worldSkin"), WORLD_SKIN_IDS, DEFAULT_DEPLOYMENT_SELECTION.worldSkin)
  };
}

export function createDeploymentSearch(selection: DeploymentSelection): string {
  const normalized = resolveDeploymentSelection(new URLSearchParams({
    weapon: selection.weapon,
    stage: selection.stage,
    enemies: String(selection.enemyCount),
    weather: selection.weather,
    actorSkin: selection.actorSkin,
    worldSkin: selection.worldSkin
  }).toString());
  return `?${new URLSearchParams({
    weapon: normalized.weapon,
    stage: normalized.stage,
    enemies: String(normalized.enemyCount),
    weather: normalized.weather,
    actorSkin: normalized.actorSkin,
    worldSkin: normalized.worldSkin
  }).toString()}`;
}

export function isWeatherSelection(value: string): value is WeatherState["type"] {
  return (WEATHER_TYPES as readonly string[]).includes(value);
}

function clampEnemyCount(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(4, Math.max(1, Math.floor(parsed))) : DEFAULT_DEPLOYMENT_SELECTION.enemyCount;
}

function readEnum<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value !== null && options.includes(value as T) ? value as T : fallback;
}
