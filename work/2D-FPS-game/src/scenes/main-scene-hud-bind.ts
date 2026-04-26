import Phaser from "phaser";
import type { BossWaveRules, BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import type { WeaponUnlockRule, UnlockState } from "../domain/progression/UnlockLogic";
import type { ProgressionState } from "../domain/progression/ProgressionLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import type { StageRotationState } from "../domain/map/StageRotationLogic";
import type { MatchFlowLogic } from "../domain/round/MatchFlowLogic";
import type { RoundLogic } from "../domain/round/RoundLogic";
import type { SoundCueEvent, SoundCueKey } from "../domain/audio/SoundCueLogic";
import type { CoverEffectId, GameBalance, PlayerWeaponSlot } from "./scene-types";
import type { SceneRuntimeState } from "./scene-runtime-state";
import { HudController } from "./hud-controller";
import type { WeatherSoundQueueItem } from "../audio/sound-cue-contract";

export interface CreateMainSceneHudControllerOptions {
  readonly scene: Phaser.Scene;
  readonly runtimeState: SceneRuntimeState;
  readonly gameBalance: GameBalance;
  readonly bossWaveRules: BossWaveRules;
  readonly matchFlow: MatchFlowLogic;
  readonly roundLogic: RoundLogic;
  readonly weaponSlots: readonly PlayerWeaponSlot[];
  readonly getActiveWeaponSlot: () => PlayerWeaponSlot;
  readonly getActiveWeaponIndex: () => number;
  readonly stageDefinitions: readonly StageDefinition[];
  readonly getCurrentStage: () => StageDefinition;
  readonly getStageRotationState: () => StageRotationState;
  readonly getBossWavePlan: () => BossWaveSpawnPlan | null;
  readonly getProgressionState: () => ProgressionState;
  readonly getUnlockState: () => UnlockState;
  readonly getUnlockRules: () => readonly WeaponUnlockRule[];
  readonly getNewlyUnlockedWeaponIds: () => readonly string[];
  readonly getUnlockNoticeUntilMs: () => number;
  readonly getLastSpawnSummary: () => string;
  readonly getLastSoundCue: () => SoundCueKey | "NONE";
  readonly isRoundStarting: (now: number) => boolean;
  readonly isCombatLive: (now: number) => boolean;
  readonly getRoundStartStatus: (now: number) => string;
  readonly getPickupStatus: (now: number) => string;
  readonly getHealthPickupStatus: (now: number) => string;
  readonly getMatchConfirmAtMs: () => number | null;
  readonly getMatchConfirmReadyCueSent: () => boolean;
  readonly setMatchConfirmReadyCueSent: (sent: boolean) => void;
  readonly emitSoundCue: (event: SoundCueEvent) => void;
  readonly queueWeatherSoundCue?: (item: WeatherSoundQueueItem) => void;
  readonly enterMatchOver: () => void;
  readonly getCoverEffectId: (index: number) => CoverEffectId;
}

export function createMainSceneHudController(options: CreateMainSceneHudControllerOptions): HudController {
  return new HudController(options.scene, options.runtimeState, {
    gameBalance: options.gameBalance,
    bossWaveRules: options.bossWaveRules,
    matchFlow: options.matchFlow,
    roundLogic: options.roundLogic,
    weaponSlots: options.weaponSlots,
    getActiveWeaponSlot: options.getActiveWeaponSlot,
    getActiveWeaponIndex: options.getActiveWeaponIndex,
    stageDefinitions: options.stageDefinitions,
    getCurrentStage: options.getCurrentStage,
    getStageRotationState: options.getStageRotationState,
    getBossWavePlan: options.getBossWavePlan,
    getProgressionState: options.getProgressionState,
    getUnlockState: options.getUnlockState,
    getUnlockRules: options.getUnlockRules,
    getNewlyUnlockedWeaponIds: options.getNewlyUnlockedWeaponIds,
    getUnlockNoticeUntilMs: options.getUnlockNoticeUntilMs,
    getLastSpawnSummary: options.getLastSpawnSummary,
    getLastSoundCue: options.getLastSoundCue,
    isRoundStarting: options.isRoundStarting,
    isCombatLive: options.isCombatLive,
    getRoundStartStatus: options.getRoundStartStatus,
    getPickupStatus: options.getPickupStatus,
    getHealthPickupStatus: options.getHealthPickupStatus,
    getMatchConfirmAtMs: options.getMatchConfirmAtMs,
    getMatchConfirmReadyCueSent: options.getMatchConfirmReadyCueSent,
    setMatchConfirmReadyCueSent: options.setMatchConfirmReadyCueSent,
    emitSoundCue: options.emitSoundCue,
    queueWeatherSoundCue: options.queueWeatherSoundCue,
    enterMatchOver: options.enterMatchOver,
    getCoverEffectId: options.getCoverEffectId
  });
}
