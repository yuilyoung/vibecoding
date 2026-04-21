import Phaser from "phaser";
import type { AirStrikeState } from "../domain/combat/AirStrikeLogic";
import type { WeaponConfig } from "../domain/combat/WeaponLogic";
import type { ProjectileConfig } from "../domain/combat/ProjectileRuntime";
import type { Rect } from "../domain/collision/CollisionLogic";
import type { HazardZoneLogic } from "../domain/map/HazardZoneLogic";
import type { WeaponLogic } from "../domain/combat/WeaponLogic";
import type { MapObjectDebugSummary } from "./map-object-controller";
import type { WeaponUnlockRule } from "../domain/progression/UnlockLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import type { BossWaveRules } from "../domain/round/BossWaveLogic";
import type { SpawnPoint, TeamId } from "../domain/round/MatchFlowLogic";

export interface GameBalanceMapObjects {
  readonly barrel: {
    readonly hp: number;
    readonly blastRadius: number;
    readonly blastDamage: number;
    readonly triggerRadius: number;
    readonly chainDelayMs: number;
  };
  readonly mine: {
    readonly armDelayMs: number;
    readonly proximityRadius: number;
    readonly fuseMs: number;
    readonly blastRadius: number;
    readonly blastDamage: number;
  };
  readonly crate: {
    readonly hp: number;
    readonly dropTable: {
      readonly health: number;
      readonly ammo: number;
      readonly boost: number;
    };
  };
}

export interface GameBalance {
  movementSpeed: number;
  dashMultiplier: number;
  maxHealth: number;
  hitStunMs: number;
  bulletSpeed: number;
  fireRateMs: number;
  bulletDamage: number;
  magazineSize: number;
  reloadTimeMs: number;
  reserveAmmo: number;
  matchScoreToWin: number;
  matchResetDelayMs: number;
  roundStartDelayMs: number;
  ammoPickupAmount: number;
  ammoPickupRespawnMs: number;
  healthPickupAmount: number;
  healthPickupRespawnMs: number;
  dummyMovementSpeed: number;
  dummyEngageRange: number;
  dummyRetreatRange: number;
  dummyShootRange: number;
  dummyLowHealthThreshold: number;
  hazardDamage: number;
  hazardTickMs: number;
  coverPointRadius: number;
  actorSkinSource: string;
  actorSpritesheetPath: string;
  actorFrameWidth: number;
  actorFrameHeight: number;
  progression: {
    xpPerKill: number;
    xpPerRoundClear: number;
    levelCurve: readonly number[];
  };
  unlocks: {
    defaultWeaponIds: readonly string[];
    weaponRules: readonly WeaponUnlockRule[];
  };
  stages: readonly StageDefinition[];
  bossWave?: BossWaveRules;
  mapObjects: GameBalanceMapObjects;
  weapons?: Record<string, unknown>;
}

export type BalanceWeaponConfig = Partial<WeaponConfig> & {
  readonly label?: string;
  readonly salvoCount?: number;
};

export interface BulletView {
  sprite: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
  damage: number;
  critChance: number;
  critMultiplier: number;
  owner: "player" | "dummy";
  effectProfile: ImpactProfile;
  projectileConfig: ProjectileConfig;
  bouncesRemaining?: number;
}

export type ImpactProfile = "carbine" | "scatter" | "bazooka" | "grenade" | "sniper" | "airStrike" | "dummy" | "pickup-ammo" | "pickup-health";

export interface ActiveAirStrikeView {
  state: AirStrikeState;
  owner: "player" | "dummy";
  critChance: number;
  critMultiplier: number;
}

export interface ImpactFxView {
  flash: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  rays: Phaser.GameObjects.Line[];
  expiresAtMs: number;
  durationMs: number;
}

export interface ShotTrailView {
  line: Phaser.GameObjects.Line;
  expiresAtMs: number;
  durationMs: number;
}

export interface MovementFxView {
  sprite: Phaser.GameObjects.Arc;
  expiresAtMs: number;
  durationMs: number;
  driftX: number;
  driftY: number;
}

export interface ActorCollisionResolution {
  blocked: boolean;
  centerX: number;
  centerY: number;
}

export interface ObstacleView {
  sprite: Phaser.GameObjects.Rectangle;
  bounds: Rect;
  visuals?: readonly Phaser.GameObjects.GameObject[];
}

export interface PickupView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  available: boolean;
  respawnAtMs: number | null;
  baseX: number;
  baseY: number;
  amount: number;
  respawnMs: number;
}

export interface PlayerWeaponSlot {
  readonly id: string;
  readonly label: string;
  readonly logic: WeaponLogic;
  readonly bulletColor: number;
  readonly bulletWidth: number;
  readonly bulletHeight: number;
  readonly pelletCount: number;
  readonly spreadRadians: number;
  readonly projectileConfig: ProjectileConfig;
  readonly critChance: number;
  readonly critMultiplier: number;
}

export interface GateView extends ObstacleView {
  readonly id: string;
  open: boolean;
}

export interface HazardZoneView {
  sprite: Phaser.GameObjects.Rectangle;
  bounds: Rect;
  logic: HazardZoneLogic;
}

export interface CoverPointView {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

export type CoverEffectId = "vision-jam" | "shield" | "repair";

export interface TerrainCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TeamSpawnTable {
  BLUE: readonly SpawnPoint[];
  RED: readonly SpawnPoint[];
}

export interface MainSceneDebugSnapshot {
  phase: string;
  team: TeamId | "UNSET";
  stage: string;
  stageLabel: string;
  spawn: string;
  activeWeapon: string;
  weaponSlot: number;
  ammoInMagazine: number;
  reserveAmmo: number;
  playerHealth: number;
  dummyHealth: number;
  gateOpen: boolean;
  roundNumber: number;
  playerScore: number;
  dummyScore: number;
  progressionLevel: number;
  progressionXp: number;
  unlockedWeaponIds: readonly string[];
  lastEvent: string;
  playerX: number;
  playerY: number;
  playerHullAngle: number;
  mapObjects: MapObjectDebugSummary;
}

export interface MainSceneHudSnapshot {
  readonly phase: string;
  readonly team: TeamId | "UNSET";
  readonly spawn: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly dummyHealth: number;
  readonly dummyMaxHealth: number;
  readonly weaponName: string;
  readonly weaponSlot: number;
  readonly ammoInMagazine: number;
  readonly magazineSize: number;
  readonly reserveAmmo: number;
  readonly playerScore: number;
  readonly dummyScore: number;
  readonly scoreToWin: number;
  readonly roundNumber: number;
  readonly gateOpen: boolean;
  readonly combatEvent: string;
  readonly roundResult: string;
  readonly matchResult: string;
  readonly prompt: string;
  readonly overlayVisible: boolean;
  readonly overlayTitle: string;
  readonly overlaySubtitle: string;
}

export type DebugTeamSelection = TeamId;
