import type { DummyAiDecision } from "../domain/ai/DummyAiLogic";
import type { SoundCueEvent } from "../domain/audio/SoundCueLogic";
import type { BossWaveRules, BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import type { StageRotationState } from "../domain/map/StageRotationLogic";
import type { StageContentSpawnPlan, StageContentSpawner } from "../domain/map/StageContentSpawner";
import type { ProgressionState } from "../domain/progression/ProgressionLogic";
import type { ProgressionStorageAdapter } from "../domain/progression/ProgressionStorage";
import type { WeaponUnlockRule, UnlockState } from "../domain/progression/UnlockLogic";
import type { MatchFlowLogic, TeamId } from "../domain/round/MatchFlowLogic";
import type { RoundLogic } from "../domain/round/RoundLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import type { WeatherState } from "../domain/environment/WeatherLogic";
import type { WindState } from "../domain/environment/WindLogic";
import type { GameBalance, PlayerWeaponSlot, TeamSpawnTable } from "./scene-types";
import { MatchFlowController, type MatchFlowControllerState, type MatchFlowStageInput } from "./match-flow-controller";

export interface MainSceneMatchStateRefs {
  stageRotationState: StageRotationState;
  progressionState: ProgressionState;
  unlockState: UnlockState;
  newlyUnlockedWeaponIds: readonly string[];
  unlockNoticeUntilMs: number;
  currentStage: StageDefinition;
  bossWavePlan: BossWaveSpawnPlan | null;
  activeStageContentPlan: StageContentSpawnPlan;
  spawnTable: TeamSpawnTable;
  roundResetAtMs: number | null;
  roundStartUntilMs: number;
  respawnFxUntilMs: number;
  matchConfirmAtMs: number | null;
  matchConfirmReadyCueSent: boolean;
  lastSpawnSummary: string;
}

export interface CreateMainSceneMatchFlowControllerOptions {
  readonly matchFlow: MatchFlowLogic;
  readonly roundLogic: RoundLogic;
  readonly playerLogic: PlayerLogic;
  readonly dummyLogic: PlayerLogic;
  readonly weaponSlots: readonly PlayerWeaponSlot[];
  readonly dummyWeaponSlots: readonly PlayerWeaponSlot[];
  readonly weaponInventory: WeaponInventoryLogic;
  readonly stageDefinitions: readonly StageDefinition[];
  readonly stageContentSpawner: StageContentSpawner;
  readonly progressionStorage: ProgressionStorageAdapter;
  readonly gameBalance: GameBalance;
  readonly bossWaveRules: BossWaveRules;
  readonly unlockRules: readonly WeaponUnlockRule[];
  readonly defaultWeaponIds: readonly string[];
  readonly getState: () => MatchFlowControllerState;
  readonly getStageInput: () => MatchFlowStageInput | null;
  readonly isConfirmDown: () => boolean;
  readonly setLastCombatEvent: (event: string) => void;
  readonly setCurrentDummyWeaponId: (weaponId: string) => void;
  readonly setLastDummyIntentKey: (key: string) => void;
  readonly setLastActiveWeaponReloading: (value: boolean) => void;
  readonly setPlayerBodyAngle: (angle: number) => void;
  readonly setDummyBodyAngle: (angle: number) => void;
  readonly setLastDummyDecision: (decision: DummyAiDecision["mode"]) => void;
  readonly setLastDummyShouldFire: (value: boolean) => void;
  readonly setLastDummySteerX: (value: number) => void;
  readonly setLastDummySteerY: (value: number) => void;
  readonly setDummySteerLockUntilMs: (value: number) => void;
  readonly applyTeamVisuals: (playerTeam: TeamId, dummyTeam: TeamId) => void;
  readonly getActorRotation: (angleRadians: number) => number;
  readonly setPlayerSpriteDeployment: (x: number, y: number, rotation: number) => void;
  readonly setDummySpriteDeployment: (x: number, y: number, rotation: number) => void;
  readonly resetActorVisuals: () => void;
  readonly applyGateDeployment: (open: boolean) => void;
  readonly clearBullets: () => void;
  readonly resetPickupState: () => void;
  readonly resetHazardState: () => void;
  readonly applyStageGeometry: () => void;
  readonly applyStageContentToRuntime: () => void;
  readonly emitSoundCue: (event: SoundCueEvent) => void;
  readonly getCurrentWind: () => WindState;
  readonly setCurrentWind: (wind: WindState) => void;
  readonly getCurrentGlobalWeather: () => WeatherState;
  readonly setCurrentGlobalWeather: (weather: WeatherState) => void;
  readonly getCurrentEffectiveWeather: () => WeatherState;
  readonly setCurrentEffectiveWeather: (weather: WeatherState) => void;
  readonly getNow: () => number;
  readonly getRandomValue: () => number;
}

export function createMainSceneMatchFlowControllerState(refs: MainSceneMatchStateRefs): MatchFlowControllerState {
  const state = {} as MatchFlowControllerState;
  Object.defineProperties(state, {
    stageRotationState: { get: () => refs.stageRotationState, set: (value: StageRotationState) => { refs.stageRotationState = value; } },
    progressionState: { get: () => refs.progressionState, set: (value: ProgressionState) => { refs.progressionState = value; } },
    unlockState: { get: () => refs.unlockState, set: (value: UnlockState) => { refs.unlockState = value; } },
    newlyUnlockedWeaponIds: { get: () => refs.newlyUnlockedWeaponIds, set: (value: readonly string[]) => { refs.newlyUnlockedWeaponIds = value; } },
    unlockNoticeUntilMs: { get: () => refs.unlockNoticeUntilMs, set: (value: number) => { refs.unlockNoticeUntilMs = value; } },
    currentStage: { get: () => refs.currentStage, set: (value: StageDefinition) => { refs.currentStage = value; } },
    bossWavePlan: { get: () => refs.bossWavePlan, set: (value: BossWaveSpawnPlan | null) => { refs.bossWavePlan = value; } },
    activeStageContentPlan: { get: () => refs.activeStageContentPlan, set: (value: StageContentSpawnPlan) => { refs.activeStageContentPlan = value; } },
    spawnTable: { get: () => refs.spawnTable, set: (value: TeamSpawnTable) => { refs.spawnTable = value; } },
    roundResetAtMs: { get: () => refs.roundResetAtMs, set: (value: number | null) => { refs.roundResetAtMs = value; } },
    roundStartUntilMs: { get: () => refs.roundStartUntilMs, set: (value: number) => { refs.roundStartUntilMs = value; } },
    respawnFxUntilMs: { get: () => refs.respawnFxUntilMs, set: (value: number) => { refs.respawnFxUntilMs = value; } },
    matchConfirmAtMs: { get: () => refs.matchConfirmAtMs, set: (value: number | null) => { refs.matchConfirmAtMs = value; } },
    matchConfirmReadyCueSent: { get: () => refs.matchConfirmReadyCueSent, set: (value: boolean) => { refs.matchConfirmReadyCueSent = value; } },
    lastSpawnSummary: { get: () => refs.lastSpawnSummary, set: (value: string) => { refs.lastSpawnSummary = value; } }
  });
  return state;
}

export function createMainSceneMatchFlowController(options: CreateMainSceneMatchFlowControllerOptions): MatchFlowController {
  return new MatchFlowController({
    matchFlow: options.matchFlow,
    roundLogic: options.roundLogic,
    playerLogic: options.playerLogic,
    dummyLogic: options.dummyLogic,
    weaponSlots: options.weaponSlots,
    dummyWeaponSlots: options.dummyWeaponSlots,
    weaponInventory: options.weaponInventory,
    stageDefinitions: options.stageDefinitions,
    stageContentSpawner: options.stageContentSpawner,
    progressionStorage: options.progressionStorage,
    gameBalance: options.gameBalance,
    bossWaveRules: options.bossWaveRules,
    unlockRules: options.unlockRules,
    defaultWeaponIds: options.defaultWeaponIds,
    getState: options.getState,
    getStageInput: options.getStageInput,
    isConfirmDown: options.isConfirmDown,
    setLastCombatEvent: options.setLastCombatEvent,
    setCurrentDummyWeaponId: options.setCurrentDummyWeaponId,
    setLastDummyIntentKey: options.setLastDummyIntentKey,
    setLastActiveWeaponReloading: options.setLastActiveWeaponReloading,
    setPlayerBodyAngle: options.setPlayerBodyAngle,
    setDummyBodyAngle: options.setDummyBodyAngle,
    setLastDummyDecision: (decision) => {
      const normalizedDecision: DummyAiDecision["mode"] = decision === "hold-cover" ? "cover" : decision;
      options.setLastDummyDecision(normalizedDecision);
    },
    setLastDummyShouldFire: options.setLastDummyShouldFire,
    setLastDummySteerX: options.setLastDummySteerX,
    setLastDummySteerY: options.setLastDummySteerY,
    setDummySteerLockUntilMs: options.setDummySteerLockUntilMs,
    applyTeamVisuals: options.applyTeamVisuals,
    getActorRotation: options.getActorRotation,
    setPlayerSpriteDeployment: options.setPlayerSpriteDeployment,
    setDummySpriteDeployment: options.setDummySpriteDeployment,
    resetActorVisuals: options.resetActorVisuals,
    applyGateDeployment: options.applyGateDeployment,
    clearBullets: options.clearBullets,
    resetPickupState: options.resetPickupState,
    resetHazardState: options.resetHazardState,
    applyStageGeometry: options.applyStageGeometry,
    applyStageContentToRuntime: options.applyStageContentToRuntime,
    emitSoundCue: options.emitSoundCue,
    getCurrentWind: options.getCurrentWind,
    setCurrentWind: options.setCurrentWind,
    getCurrentGlobalWeather: options.getCurrentGlobalWeather,
    setCurrentGlobalWeather: options.setCurrentGlobalWeather,
    getCurrentEffectiveWeather: options.getCurrentEffectiveWeather,
    setCurrentEffectiveWeather: options.setCurrentEffectiveWeather,
    getNow: options.getNow,
    getRandomValue: options.getRandomValue
  });
}
