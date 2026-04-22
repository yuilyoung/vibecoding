import type Phaser from "phaser";
import type { DummyAiDecision, CoverPoint } from "../domain/ai/DummyAiLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import type {
  ActiveAirStrikeView,
  BulletView,
  CoverPointView,
  GateView,
  HazardZoneView,
  ImpactFxView,
  MovementFxView,
  ObstacleView,
  PickupView,
  ShotTrailView,
} from "./scene-types";

export interface SceneRuntimeState {
  readonly playerLogic: PlayerLogic;
  readonly dummyLogic: PlayerLogic;
  playerSprite?: Phaser.GameObjects.Image;
  targetDummy?: Phaser.GameObjects.Image;
  playerWeaponSprite?: Phaser.GameObjects.Sprite;
  dummyWeaponSprite?: Phaser.GameObjects.Sprite;
  muzzleFlash?: Phaser.GameObjects.Arc;
  readonly bullets: BulletView[];
  readonly activeAirStrikes: ActiveAirStrikeView[];
  readonly impactEffects: ImpactFxView[];
  readonly shotTrails: ShotTrailView[];
  readonly movementEffects: MovementFxView[];
  readonly obstacles: ObstacleView[];
  readonly stageObstacleViews: ObstacleView[];
  gate?: GateView;
  hazardZone?: HazardZoneView;
  ammoPickup?: PickupView;
  healthPickup?: PickupView;
  readonly dummyCoverPoints: CoverPoint[];
  readonly coverPointViews: CoverPointView[];
  pendingBulletClear: boolean;
  lastCombatEvent: string;
  recentImpactEffectUntilMs: number;
  lastDummyDecision: DummyAiDecision["mode"];
  dummyInCover: boolean;
  dummyCoverBonusUntilMs: number;
  activeDummyCoverIndex: number | null;
  nextDummyRepairTickAtMs: number;
  playerUnlimitedAmmoUntilMs: number;
  lastDummyShouldFire: boolean;
  lastDummySteerX: number;
  lastDummySteerY: number;
  dummySteerLockUntilMs: number;
  muzzleFlashUntilMs: number;
  currentPlayerTeam: TeamId;
  currentDummyTeam: TeamId;
  currentDummyWeaponId: string;
  playerBodyAngle: number;
  dummyBodyAngle: number;
  nextPlayerMoveFxAtMs: number;
  nextDummyMoveFxAtMs: number;
  nextGateInteractionAtMs: number;
  lastDummyIntentKey: string;
  lastActiveWeaponReloading: boolean;
  suppressPointerFireUntilMs: number;
  playerConsecutiveBlockedFrames: number;
  dummyConsecutiveBlockedFrames: number;
}

export function createSceneRuntimeState(state: SceneRuntimeState): SceneRuntimeState {
  return state;
}
