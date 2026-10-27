import Phaser from "phaser";
import { createExperienceCoverPoints } from "../domain/visual/ArcadeExperience";
import { DummyAiLogic, type CoverPoint } from "../domain/ai/DummyAiLogic";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { StageContentSpawner, type StageContentSpawnPlan } from "../domain/map/StageContentSpawner";
import type { StageDefinitionWithContent } from "../domain/map/StageContentDefinition";
import { createStageRotationState, selectNextStage, type StageRotationState } from "../domain/map/StageRotationLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import { createSpriteHitFeedbackState, recordHit, shouldShowHitFlash, type SpriteHitFeedbackState } from "../domain/feedback/SpriteHitFeedback";
import { resolveDamageNumber } from "../domain/feedback/DamageNumberLogic";
import { DamageNumberRenderer } from "./damage-number-renderer";
import { createProgressionState, type ProgressionState } from "../domain/progression/ProgressionLogic";
import { createProgressionStorage, type ProgressionStorageAdapter } from "../domain/progression/ProgressionStorage";
import { createRewardStorage, type RewardStorageAdapter } from "../domain/rewards/RewardStorage";
import { createRewardState, getRankForScore, purchaseRewardItem, type PurchaseResult, type RewardState } from "../domain/rewards/VictoryRewardLogic";
import { createLeaderboardStorage, type LeaderboardStorageAdapter } from "../domain/rewards/LeaderboardStorage";
import { createLeaderboardState, getLeaderboardPosition, type LeaderboardState } from "../domain/rewards/LeaderboardLogic";
import { createSettingsStorage, DEFAULT_SETTINGS, type SettingsState, type SettingsStorageAdapter } from "../domain/settings/SettingsStorage";
import { createUnlockState, isWeaponUnlocked, type UnlockState, type WeaponUnlockRule } from "../domain/progression/UnlockLogic";
import { MatchFlowLogic } from "../domain/round/MatchFlowLogic";
import { BattleRosterLogic, createActorId } from "../domain/round/BattleRosterLogic";
import { createBossSpawn, type BossWaveRules, type BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import { RoundLogic } from "../domain/round/RoundLogic";
import { createWeatherState, type WeatherState, type WeatherType } from "../domain/environment/WeatherLogic";
import type { HudSnapshot } from "../ui/hud-events";
import { createPlayerWeaponSlots, createDummyWeaponSlots } from "./weapon-slot-factory";
import { createArenaPropTextures, createTurretAnimations, addArenaBackdrop } from "./arena-textures";
import type {
  ActiveAirStrikeView,
  BulletView,
  CoverPointView,
  DebugTeamSelection,
  GateView,
  GameBalance,
  HazardZoneView,
  MainSceneDebugSnapshot,
  ObstacleView,
  PickupView,
  PlayerWeaponSlot,
  TeamSpawnTable,
} from "./scene-types";
export type { MainSceneHudSnapshot, DebugTeamSelection } from "./scene-types";
import { createSceneRuntimeState, type SceneRuntimeState } from "./scene-runtime-state";
import { LowHpVignette } from "../ui/LowHpVignette";
import { ActorCollisionResolver } from "./actor-collision";
import { VfxController } from "./vfx-controller";
import { StageGeometryManager } from "./stage-geometry";
import { DummyActorController, rotateAngleTowards } from "./dummy-controller";
import { CombatController } from "./combat-controller";
import { HudController } from "./hud-controller";
import { MatchFlowController } from "./match-flow-controller";
import { AudioFeedbackController } from "./audio-feedback-controller";
import { getAmbientCueForStage } from "../domain/audio/AmbientAudioCatalog";
import { VisualController } from "./visual-controller";
import { ActorPresentationComposition, createAdditionalActorPresentation, preloadActorPresentationAssets } from "./actor-presentation-composition";
import { getActorSkinDefinition, type ActorSkinDefinition } from "../domain/visual/ActorSkinCatalog";
import { getCharacterMaxHealth } from "../domain/player/CharacterGameplayProfile";
import { getWorldObjectSkinDefinition, type WorldObjectSkinDefinition } from "../domain/visual/WorldObjectSkinCatalog";
import { WorldObjectPresentationComposition, preloadWorldObjectPresentationAssets } from "./world-object-presentation-composition";
import { IntegratedPresentationComposition } from "./integrated-presentation-composition";
import { DebugController } from "./debug-controller";
import { MapObjectController } from "./map-object-controller";
import { WeatherRenderer } from "./weather-renderer";
import { StageVisualController } from "./stage-visual-controller";
import type { TacticalPositionConfig } from "../domain/ai/TacticalPositionLogic";
import type { MoveKeys } from "./input-bindings";
import { createMainSceneDebugController } from "./main-scene-debug";
import { createMainSceneHudController } from "./main-scene-hud-bind";
import { applyMainSceneInputOverlay, createMainSceneStageFlowInput, initializeMainSceneInput } from "./main-scene-input";
import { createMainSceneMatchFlowController, createMainSceneMatchFlowControllerState } from "./main-scene-match-bind";
import { CpuSquadController } from "./cpu-squad-controller";
import type { SceneCombatActor } from "./combat-actor-port";
import {
  bindMainSceneLifecycle,
  createBootstrapVisualRefs,
  getBrowserStorageBackend,
  preloadMainSceneAssets,
  unbindMainScenePointer
} from "./scene-bootstrap";
import { AMMO_OVERDRIVE_MS, ACTOR_HALF_SIZE, ACTOR_MIN_SEPARATION, MAX_FRAME_DELTA_MS, BODY_TURN_RATE, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y, DEFAULT_BOSS_WAVE_RULES } from "./scene-constants";

export class MainScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveKeys?: MoveKeys;
  private playerSprite!: Phaser.GameObjects.Image;
  private targetDummy!: Phaser.GameObjects.Image;
  private playerWeaponSprite!: Phaser.GameObjects.Sprite;
  private dummyWeaponSprite!: Phaser.GameObjects.Sprite;
  private crosshairHorizontal!: Phaser.GameObjects.Rectangle;
  private crosshairVertical!: Phaser.GameObjects.Rectangle;
  private muzzleFlash!: Phaser.GameObjects.Arc;
  private ammoPickup!: PickupView;
  private healthPickup!: PickupView;
  private readonly playerLogic: PlayerLogic;
  private readonly dummyLogic: PlayerLogic;
  private readonly weaponSlots: PlayerWeaponSlot[];
  private readonly weaponInventory: WeaponInventoryLogic;
  private readonly dummyWeaponSlots: PlayerWeaponSlot[];
  private readonly roundLogic: RoundLogic;
  private readonly dummyAiLogic: DummyAiLogic;
  private readonly gameBalance: GameBalance;
  private readonly bossWaveRules: BossWaveRules;
  private readonly bullets: BulletView[];
  private readonly activeAirStrikes: ActiveAirStrikeView[];
  private readonly obstacles: ObstacleView[];
  private readonly stageObstacleViews: ObstacleView[];
  private readonly matchFlow: MatchFlowLogic;
  private readonly battleRoster: BattleRosterLogic;
  private readonly enemyCount: number;
  private readonly stageDefinitions: readonly StageDefinition[];
  private readonly stageContentSpawner: StageContentSpawner;
  private readonly progressionStorage: ProgressionStorageAdapter;
  private readonly rewardStorage: RewardStorageAdapter;
  private readonly leaderboardStorage: LeaderboardStorageAdapter;
  private readonly settingsStorage: SettingsStorageAdapter;
  private settingsState: SettingsState;
  private readonly unlockRules: readonly WeaponUnlockRule[];
  private readonly defaultWeaponIds: readonly string[];
  private readonly unlockAllWeaponsForDev: boolean;
  private stageRotationState: StageRotationState;
  private progressionState: ProgressionState;
  private rewardState: RewardState;
  private leaderboardState: LeaderboardState;
  private unlockState: UnlockState;
  private newlyUnlockedWeaponIds: readonly string[];
  private unlockNoticeUntilMs: number;
  private currentStage: StageDefinition;
  private bossWavePlan: BossWaveSpawnPlan | null;
  private activeStageContentPlan: StageContentSpawnPlan;
  private spawnTable: TeamSpawnTable;
  private gate!: GateView;
  private hazardZone!: HazardZoneView;
  private lowHpVignette!: LowHpVignette;
  private damageNumberRenderer!: DamageNumberRenderer;
  private readonly dummyCoverPoints: CoverPoint[];
  private readonly coverPointViews: CoverPointView[];
  private readonly runtimeState: SceneRuntimeState;
  private readonly actorCollisionResolver: ActorCollisionResolver;
  private readonly vfxController: VfxController;
  private readonly combatController: CombatController;
  private readonly dummyActorController: DummyActorController;
  private cpuSquadController!: CpuSquadController;
  private playerCombatActor!: SceneCombatActor;
  private primaryCpuCombatActor!: SceneCombatActor;
  private readonly stageGeometry: StageGeometryManager;
  private readonly mapObjectController: MapObjectController;
  private readonly hudController: HudController;
  private readonly matchFlowController: MatchFlowController;
  private readonly audioFeedbackController: AudioFeedbackController;
  private visualController!: VisualController;
  private actorPresentationComposition!: ActorPresentationComposition;
  private worldObjectPresentationComposition!: WorldObjectPresentationComposition;
  private integratedPresentationComposition: IntegratedPresentationComposition | null = null;
  private readonly actorSkinDefinition: ActorSkinDefinition;
  private readonly worldObjectSkinDefinition: WorldObjectSkinDefinition;
  private readonly onActorSkinResolved: (definition: ActorSkinDefinition) => void;
  private readonly onWorldObjectSkinResolved: (definition: WorldObjectSkinDefinition) => void;
  private readonly debugController: DebugController;
  private weatherRenderer!: WeatherRenderer;
  private stageVisualController!: StageVisualController;
  private roundResetAtMs: number | null;
  private roundStartUntilMs: number;
  private respawnFxUntilMs: number;
  private matchConfirmAtMs: number | null;
  private matchConfirmReadyCueSent: boolean;
  private lastSpawnSummary: string;
  private inputOverlayActive: boolean;
  private playerHitFeedback: SpriteHitFeedbackState;
  private dummyHitFeedback: SpriteHitFeedbackState;
  private currentGlobalWeather: WeatherState;
  private currentEffectiveWeather: WeatherState;
  public constructor(
    gameBalance: GameBalance,
    actorSkinDefinition = getActorSkinDefinition(null),
    worldObjectSkinDefinition = getWorldObjectSkinDefinition(null),
    onActorSkinResolved: (definition: ActorSkinDefinition) => void = () => undefined,
    onWorldObjectSkinResolved: (definition: WorldObjectSkinDefinition) => void = () => undefined,
    initialWeather: WeatherType = "clear",
    initialWeaponId?: string,
    enemyCount = 1
  ) {
    super("MainScene");
    this.gameBalance = gameBalance;
    this.actorSkinDefinition = actorSkinDefinition;
    this.worldObjectSkinDefinition = worldObjectSkinDefinition;
    this.enemyCount = Number.isFinite(enemyCount) ? Math.min(4, Math.max(1, Math.floor(enemyCount))) : 1;
    this.onActorSkinResolved = onActorSkinResolved;
    this.onWorldObjectSkinResolved = onWorldObjectSkinResolved;
    this.bossWaveRules = gameBalance.bossWave ?? DEFAULT_BOSS_WAVE_RULES;
    const playerMaxHealth = getCharacterMaxHealth(gameBalance.maxHealth, actorSkinDefinition.gameplayProfile);
    this.playerLogic = new PlayerLogic(playerMaxHealth, {
      movementSpeed: gameBalance.movementSpeed,
      dashMultiplier: gameBalance.dashMultiplier,
      movementSpeedMultiplier: actorSkinDefinition.gameplayProfile.movementSpeedMultiplier
    });
    this.dummyLogic = new PlayerLogic(gameBalance.maxHealth, {
      movementSpeed: gameBalance.dummyMovementSpeed,
      dashMultiplier: 1
    });
    this.weaponSlots = createPlayerWeaponSlots(gameBalance, actorSkinDefinition.gameplayProfile);
    this.weaponInventory = new WeaponInventoryLogic(
      this.weaponSlots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        logic: slot.logic
      }))
    );
    const initialWeaponIndex = this.weaponSlots.findIndex((slot) => slot.id === initialWeaponId);
    if (initialWeaponIndex > 0) {
      this.weaponInventory.selectSlot(initialWeaponIndex);
    }
    this.dummyWeaponSlots = createDummyWeaponSlots(gameBalance);
    this.roundLogic = new RoundLogic(gameBalance.matchScoreToWin);
    this.dummyAiLogic = new DummyAiLogic({
      engageRange: gameBalance.dummyEngageRange,
      retreatRange: gameBalance.dummyRetreatRange,
      shootRange: gameBalance.dummyShootRange,
      lowHealthThreshold: gameBalance.dummyLowHealthThreshold,
      botTactics: gameBalance.botTactics,
      combatTuning: gameBalance.combatTuning
    });
    this.bullets = [];
    this.activeAirStrikes = [];
    this.obstacles = [];
    this.stageObstacleViews = [];
    this.matchFlow = new MatchFlowLogic();
    this.battleRoster = new BattleRosterLogic();
    this.battleRoster.add({ id: createActorId("player"), team: "BLUE", controller: "human" });
    this.battleRoster.add({ id: createActorId("dummy"), team: "RED", controller: "cpu" });
    this.stageDefinitions = gameBalance.stages;
    this.stageContentSpawner = new StageContentSpawner();
    this.stageRotationState = createStageRotationState();
    const initialStage = selectNextStage(this.stageDefinitions, this.stageRotationState);
    this.stageRotationState = initialStage.state;
    this.currentStage = initialStage.stage;
    this.bossWavePlan = createBossSpawn(this.currentStage, this.bossWaveRules);
    this.activeStageContentPlan = this.stageContentSpawner.spawn(this.currentStage as StageDefinitionWithContent);
    this.spawnTable = this.createSpawnTableFromStage(this.currentStage);
    this.progressionStorage = createProgressionStorage(getBrowserStorageBackend());
    this.rewardStorage = createRewardStorage(getBrowserStorageBackend());
    this.leaderboardStorage = createLeaderboardStorage(getBrowserStorageBackend());
    this.settingsStorage = createSettingsStorage(getBrowserStorageBackend(), "2d-fps-game:settings");
    this.settingsState = this.settingsStorage.load() ?? DEFAULT_SETTINGS;
    this.audioFeedbackController = new AudioFeedbackController(
      this,
      this.gameBalance.audio,
      getAmbientCueForStage(this.currentStage.id)
    );
    this.audioFeedbackController.setVolume(this.settingsState.masterVolume * this.settingsState.sfxVolume);
    this.progressionState = this.progressionStorage.load() ?? createProgressionState();
    this.rewardState = this.rewardStorage.load() ?? createRewardState();
    this.applyRankAmmoBonus();
    this.leaderboardState = this.leaderboardStorage.load() ?? createLeaderboardState();
    this.unlockRules = gameBalance.unlocks.weaponRules;
    this.defaultWeaponIds = gameBalance.unlocks.defaultWeaponIds;
    this.unlockAllWeaponsForDev = import.meta.env.DEV;
    this.unlockState = createUnlockState(this.progressionState, this.unlockRules, this.defaultWeaponIds);
    this.newlyUnlockedWeaponIds = [];
    this.unlockNoticeUntilMs = 0;
    this.currentGlobalWeather = createWeatherState(initialWeather, gameBalance.weather);
    this.currentEffectiveWeather = this.currentGlobalWeather;
    this.dummyCoverPoints = createExperienceCoverPoints(this.gameBalance.arcadePresentation === true);
    this.coverPointViews = [];
    this.runtimeState = createSceneRuntimeState({
      playerLogic: this.playerLogic,
      dummyLogic: this.dummyLogic,
      bullets: this.bullets,
      activeAirStrikes: this.activeAirStrikes,
      impactEffects: [],
      shotTrails: [],
      movementEffects: [],
      obstacles: this.obstacles,
      stageObstacleViews: this.stageObstacleViews,
      dummyCoverPoints: this.dummyCoverPoints,
      coverPointViews: this.coverPointViews,
      currentWind: { angleDegrees: 0, strength: 0 },
      currentWeather: this.currentEffectiveWeather,
      pendingBulletClear: false,
      lastCombatEvent: "READY",
      recentImpactEffectUntilMs: 0,
      lastDummyDecision: "chase",
      lastDummyTacticalIntent: "pressure",
      dummyInCover: false,
      dummyCoverBonusUntilMs: 0,
      activeDummyCoverIndex: null,
      targetDummyCoverIndex: null,
      targetDummyCoverEffect: null,
      nextDummyRepairTickAtMs: 0,
      playerUnlimitedAmmoUntilMs: 0,
      lastDummyShouldFire: false,
      lastDummySteerX: 1,
      lastDummySteerY: 0,
      dummySteerLockUntilMs: 0,
      muzzleFlashUntilMs: 0,
      currentPlayerTeam: "BLUE",
      currentDummyTeam: "RED",
      currentDummyWeaponId: "carbine",
      currentDummyWeaponRole: "mid-range",
      playerBodyAngle: 0,
      dummyBodyAngle: 0,
      nextPlayerMoveFxAtMs: 0,
      nextDummyMoveFxAtMs: 0,
      nextGateInteractionAtMs: 0,
      lastDummyIntentKey: "chase:false",
      lastActiveWeaponReloading: false,
      suppressPointerFireUntilMs: 0,
      playerConsecutiveBlockedFrames: 0,
      dummyConsecutiveBlockedFrames: 0
    });
    this.actorCollisionResolver = new ActorCollisionResolver(this.runtimeState);
    this.vfxController = new VfxController(this, this.runtimeState, {
      arcade: this.gameBalance.arcadePresentation === true,
      isPlayerSprintDown: () => this.moveKeys?.sprint.isDown === true
    });
    this.mapObjectController = new MapObjectController(this, {
      arcadePresentation: this.gameBalance.arcadePresentation === true,
      gameBalanceMapObjects: this.gameBalance.mapObjects
    });
    this.combatController = new CombatController(this, this.runtimeState, this.vfxController, this.actorCollisionResolver, {
      weaponSlots: this.weaponSlots,
      weaponInventory: this.weaponInventory,
      dummyWeaponSlots: this.dummyWeaponSlots,
      gameBalance: this.gameBalance,
      moveKeys: () => this.moveKeys,
      activePointer: () => this.input.activePointer,
      getCombatAvailability: (now) => this.getCombatAvailability(now),
      getWeaponTurretTexture: (team, weaponId) => this.visualController.getWeaponTurretTexture(team, weaponId),
      isWeaponAvailable: (weaponId) => this.isWeaponAvailable(weaponId),
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event),
      triggerCameraFeedback: (event) => this.audioFeedbackController.triggerCameraFeedback(event),
      registerPlayerRoundWin: (now) => this.matchFlowController.registerPlayerRoundWin(now),
      registerDummyRoundWin: () => this.matchFlowController.registerDummyRoundWin(),
      scheduleResetAfterRound: (now) => this.matchFlowController.scheduleResetAfterRound(now),
      hasDummyCoverProtection: (now) => this.dummyActorController.hasCoverProtection(now),
      isMatchOver: () => this.roundLogic.state.isMatchOver,
      recordPlayerHit: (now) => {
        this.playerHitFeedback = recordHit(this.playerHitFeedback, now);
      },
      recordDummyHit: (now) => {
        this.dummyHitFeedback = recordHit(this.dummyHitFeedback, now);
      },
      spawnDamageNumber: (x, y, damage, isCritical, isSelfHarm) => {
        if (damage <= 0 || this.damageNumberRenderer === undefined) {
          return;
        }
        this.damageNumberRenderer.spawn(x, y - 12, resolveDamageNumber(Math.round(damage), isCritical, isSelfHarm));
      },
      playPlayerHitFeedback: () => {
        if (!this.playerLogic.isDead()) {
          this.tweens.add({ targets: this.playerSprite, scaleX: 0.92, scaleY: 0.92, duration: 40, yoyo: true, ease: "Quad.easeOut" });
        }
      },
      playDummyHitFeedback: () => {
        if (!this.dummyLogic.isDead()) {
          this.tweens.add({ targets: this.targetDummy, scaleX: 0.92, scaleY: 0.92, duration: 40, yoyo: true, ease: "Quad.easeOut" });
        }
      },
      getMapObjectCollisionRects: () => this.mapObjectController.getActiveCollisionRects(),
      damageMapObject: (id, damage) => this.mapObjectController.damageObject(id, damage),
      destroyMapObject: (id) => this.mapObjectController.destroyObject(id),
      setMapObjectState: (id, state) => this.mapObjectController.setObjectState(id, state),
      getCombatActors: () => [this.playerCombatActor, this.primaryCpuCombatActor, ...this.cpuSquadController.actors],
      battleRoster: this.battleRoster
    });
    this.dummyActorController = new DummyActorController(this, this.runtimeState, this.actorCollisionResolver, {
      dummyAiLogic: this.dummyAiLogic,
      isCombatLive: (now) => this.isCombatLive(now),
      isMatchOver: () => this.roundLogic.state.isMatchOver,
      getPreferredDummyWeaponId: (now) => this.combatController.getPreferredDummyWeaponId(now),
      getActorRotation: (angleRadians) => this.visualController.getActorRotation(angleRadians),
      emitMovementFxForActor: (actor, now, throttleInput) => {
        this.vfxController.emitMovementFxForActor(actor, now, throttleInput);
      },
      coverPointRadius: this.gameBalance.coverPointRadius,
      getTacticalCoverStates: () => this.mapObjectController.getStates(),
      getTacticalPositionConfig: () => this.getTacticalPositionConfig()
    });
    this.stageGeometry = new StageGeometryManager(this, this.runtimeState, this.actorCollisionResolver, this.gameBalance, {
      getCombatAvailability: (now) => this.getCombatAvailability(now),
      moveKeys: () => this.moveKeys,
      activePointer: () => this.input.activePointer,
      restockPlayerAmmo: (now) => this.combatController.restockPlayerAmmo(now),
      isAmmoOverdriveActive: (now) => this.combatController.isAmmoOverdriveActive(now),
      activateAmmoOverdrive: (now) => this.combatController.activateAmmoOverdrive(now, AMMO_OVERDRIVE_MS),
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event),
      spawnPickupFx: (x, y, profile) => this.vfxController.spawnImpactEffect(x, y, profile),
      registerPlayerRoundWin: (now) => this.matchFlowController.registerPlayerRoundWin(now),
      registerDummyRoundWin: () => this.matchFlowController.registerDummyRoundWin(),
      scheduleResetAfterRound: (now) => this.matchFlowController.scheduleResetAfterRound(now),
      getCoverEffectId: (index) => this.dummyActorController.getCoverEffectId(index),
      getCoverLabel: (index) => this.dummyActorController.getCoverLabel(index),
      isCoverActive: (index) => this.dummyActorController.getActiveCoverIndexForActor(this.targetDummy.x, this.targetDummy.y) === index,
      shouldHighlightCover: () => this.dummyActorController.shouldHighlightCover(),
      suppressPointerFireUntil: (untilMs) => { this.runtimeState.suppressPointerFireUntilMs = untilMs; },
      getCombatActors: () => [this.playerCombatActor, this.primaryCpuCombatActor, ...this.cpuSquadController.actors],
      syncActorLife: (actorId, now) => this.combatController.syncActorLife(actorId, now)
    });
    this.hudController = createMainSceneHudController({
      scene: this,
      runtimeState: this.runtimeState,
      gameBalance: this.gameBalance,
      bossWaveRules: this.bossWaveRules,
      matchFlow: this.matchFlow,
      roundLogic: this.roundLogic,
      weaponSlots: this.weaponSlots,
      getActiveWeaponSlot: () => this.combatController.getActiveWeaponSlot(),
      getActiveWeaponIndex: () => this.weaponInventory.getActiveIndex(),
      stageDefinitions: this.stageDefinitions,
      getCurrentStage: () => this.currentStage,
      getStageRotationState: () => this.stageRotationState,
      getBossWavePlan: () => this.bossWavePlan,
      getProgressionState: () => this.progressionState,
      getUnlockState: () => this.unlockState,
      getUnlockRules: () => this.unlockRules,
      getNewlyUnlockedWeaponIds: () => this.newlyUnlockedWeaponIds,
      getUnlockNoticeUntilMs: () => this.unlockNoticeUntilMs,
      getLastSpawnSummary: () => this.lastSpawnSummary,
      getLastSoundCue: () => this.audioFeedbackController.getLastSoundCue(),
      isRoundStarting: (now) => this.matchFlowController.isRoundStarting(now),
      isCombatLive: (now) => this.isCombatLive(now),
      getRoundStartStatus: (now) => this.matchFlowController.getRoundStartStatus(now),
      getPickupStatus: (now) => this.stageGeometry.getPickupStatus(now),
      getHealthPickupStatus: (now) => this.stageGeometry.getHealthPickupStatus(now),
      getMatchConfirmAtMs: () => this.matchConfirmAtMs,
      getMatchConfirmReadyCueSent: () => this.matchConfirmReadyCueSent,
      setMatchConfirmReadyCueSent: (sent) => { this.matchConfirmReadyCueSent = sent; },
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event),
      queueWeatherSoundCue: (item) => this.audioFeedbackController.queueWeatherSoundCue(item),
      getActiveWeatherSoundCue: () => this.audioFeedbackController.getActiveWeatherSoundCue(),
      getRuntimeAudioSnapshot: () => this.audioFeedbackController.getRuntimeAudioSnapshot(),
      getEnemyTeamSnapshot: () => {
        const actors = [this.primaryCpuCombatActor, ...this.cpuSquadController.actors];
        return {
          health: actors.reduce((sum, actor) => sum + actor.logic.state.health, 0),
          maxHealth: actors.reduce((sum, actor) => sum + actor.logic.state.maxHealth, 0),
          living: actors.filter((actor) => !actor.logic.isDead()).length,
          total: actors.length
        };
      },
      enterMatchOver: () => this.matchFlow.enterMatchOver(),
      getCoverEffectId: (index) => this.dummyActorController.getCoverEffectId(index)
    });
    this.matchFlowController = createMainSceneMatchFlowController({
      matchFlow: this.matchFlow,
      roundLogic: this.roundLogic,
      playerLogic: this.playerLogic,
      dummyLogic: this.dummyLogic,
      weaponSlots: this.weaponSlots,
      dummyWeaponSlots: this.dummyWeaponSlots,
      weaponInventory: this.weaponInventory,
      stageDefinitions: this.stageDefinitions,
      stageContentSpawner: this.stageContentSpawner,
      progressionStorage: this.progressionStorage,
      rewardStorage: this.rewardStorage,
      leaderboardStorage: this.leaderboardStorage,
      gameBalance: this.gameBalance,
      bossWaveRules: this.bossWaveRules,
      unlockRules: this.unlockRules,
      defaultWeaponIds: this.defaultWeaponIds,
      getState: () => createMainSceneMatchFlowControllerState(this as unknown as Parameters<typeof createMainSceneMatchFlowControllerState>[0]),
      getStageInput: () => createMainSceneStageFlowInput(this.moveKeys, this.cursors),
      isConfirmDown: () => this.moveKeys !== undefined && (
        Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm) || this.moveKeys.confirm.isDown
      ),
      setLastCombatEvent: (event) => { this.runtimeState.lastCombatEvent = event; },
      setCurrentDummyWeaponId: (weaponId) => { this.runtimeState.currentDummyWeaponId = weaponId; },
      setLastDummyIntentKey: (key) => { this.runtimeState.lastDummyIntentKey = key; },
      setLastActiveWeaponReloading: (value) => { this.runtimeState.lastActiveWeaponReloading = value; },
      setPlayerBodyAngle: (angle) => { this.runtimeState.playerBodyAngle = angle; },
      setDummyBodyAngle: (angle) => { this.runtimeState.dummyBodyAngle = angle; },
      setLastDummyDecision: (decision) => { this.runtimeState.lastDummyDecision = decision; },
      setLastDummyShouldFire: (value) => { this.runtimeState.lastDummyShouldFire = value; },
      setLastDummySteerX: (value) => { this.runtimeState.lastDummySteerX = value; },
      setLastDummySteerY: (value) => { this.runtimeState.lastDummySteerY = value; },
      setDummySteerLockUntilMs: (value) => { this.runtimeState.dummySteerLockUntilMs = value; },
      applyTeamVisuals: (playerTeam, dummyTeam) => {
        this.visualController.applyTeamVisuals(playerTeam, dummyTeam);
        this.playerCombatActor.team = playerTeam;
        this.primaryCpuCombatActor.team = dummyTeam;
        this.battleRoster.setTeam(this.playerCombatActor.id, playerTeam);
        this.battleRoster.setTeam(this.primaryCpuCombatActor.id, dummyTeam);
        this.cpuSquadController.setTeam(dummyTeam);
      },
      getActorRotation: (angleRadians) => this.visualController.getActorRotation(angleRadians),
      setPlayerSpriteDeployment: (x, y, rotation) => {
        this.playerSprite.setPosition(x, y);
        this.playerSprite.setRotation(rotation);
      },
      setDummySpriteDeployment: (x, y, rotation) => {
        this.targetDummy.setPosition(x, y);
        this.targetDummy.setRotation(rotation);
      },
      resetActorVisuals: () => { this.visualController.resetActorVisuals(); },
      resetAdditionalActors: (team) => {
        this.battleRoster.reset();
        this.cpuSquadController.setTeam(team);
        this.cpuSquadController.reset(this.spawnTable[team]);
      },
      applyGateDeployment: (open) => this.stageGeometry.applyGateDeployment(open),
      clearBullets: () => this.combatController.clearBullets(),
      resetPickupState: () => this.stageGeometry.resetPickupState(),
      resetHazardState: () => this.stageGeometry.resetHazardState(),
      applyStageGeometry: () => {
        this.stageVisualController.applyStage(this.currentStage.id);
        this.stageGeometry.applyStageGeometry(this.currentStage);
        this.audioFeedbackController.setAmbientCue(getAmbientCueForStage(this.currentStage.id));
      },
      applyStageContentToRuntime: () => {
        this.stageGeometry.applyStageContent(this.activeStageContentPlan);
        this.mapObjectController.applyMapObjects(this.activeStageContentPlan.mapObjects);
      },
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event),
      getCurrentWind: () => this.runtimeState.currentWind,
      setCurrentWind: (wind) => { this.runtimeState.currentWind = wind; },
      getCurrentGlobalWeather: () => this.currentGlobalWeather,
      setCurrentGlobalWeather: (weather) => { this.setCurrentGlobalWeather(weather); },
      getCurrentEffectiveWeather: () => this.currentEffectiveWeather,
      setCurrentEffectiveWeather: (weather) => { this.setCurrentEffectiveWeather(weather); },
      initialWeather: this.gameBalance.arcadePresentation === true ? initialWeather : undefined,
      getNow: () => this.time.now,
      getRandomValue: () => Math.random()
    });
    this.debugController = createMainSceneDebugController({
      matchFlow: this.matchFlow,
      roundLogic: this.roundLogic,
      runtimeState: this.runtimeState,
      weaponInventory: this.weaponInventory,
      combatController: this.combatController,
      matchFlowController: this.matchFlowController,
      vfxController: this.vfxController,
      getActiveWeaponSlot: () => this.combatController.getActiveWeaponSlot(),
      getCurrentStage: () => this.currentStage,
      getProgressionState: () => this.progressionState,
      getUnlockState: () => this.unlockState,
      getWeatherConfig: () => this.gameBalance.weather,
      getCurrentGlobalWeather: () => this.currentGlobalWeather,
      getCurrentEffectiveWeather: () => this.currentEffectiveWeather,
      getRuntimeAudioSnapshot: () => this.audioFeedbackController.getRuntimeAudioSnapshot(),
      setCurrentWeather: (weather) => { this.applyCurrentWeather(weather); },
      getLastSpawnSummary: () => this.lastSpawnSummary,
      getMapObjectDebugSummary: () => this.mapObjectController.getDebugSummary(),
      getMapObjectStates: () => this.mapObjectController.getStates(),
      getProjectileSnapshot: () => this.runtimeState.bullets.map((bullet) => ({
        x: bullet.sprite.x,
        y: bullet.sprite.y,
        velocityX: bullet.velocityX,
        velocityY: bullet.velocityY,
        owner: bullet.owner,
        trajectory: bullet.projectileConfig.trajectory
      })),
      isRoundStarting: (now) => this.matchFlowController.isRoundStarting(now),
      getActorRotation: (angleRadians) => this.visualController.getActorRotation(angleRadians),
      applyGateToggle: () => this.stageGeometry.toggleGate(),
      registerPlayerRoundWin: (now) => this.matchFlowController.registerPlayerRoundWin(now),
      updateMatchOverlay: (now) => this.hudController.updateMatchOverlay(now),
      publishHudSnapshot: (now, movementBlocked) => this.hudController.publishHudSnapshot(now, movementBlocked)
    });
    this.runtimeState.lastCombatEvent = "READY";
    this.roundResetAtMs = null;
    this.roundStartUntilMs = 0;
    this.respawnFxUntilMs = 0;
    this.matchConfirmAtMs = null;
    this.matchConfirmReadyCueSent = false;
    this.runtimeState.lastDummyDecision = "chase";
    this.runtimeState.lastDummyTacticalIntent = "pressure";
    this.runtimeState.dummyInCover = false;
    this.runtimeState.dummyCoverBonusUntilMs = 0;
    this.runtimeState.activeDummyCoverIndex = null;
    this.runtimeState.targetDummyCoverIndex = null;
    this.runtimeState.targetDummyCoverEffect = null;
    this.runtimeState.nextDummyRepairTickAtMs = 0;
    this.runtimeState.playerUnlimitedAmmoUntilMs = 0;
    this.runtimeState.lastDummyShouldFire = false;
    this.runtimeState.lastDummySteerX = 1;
    this.runtimeState.lastDummySteerY = 0;
    this.runtimeState.dummySteerLockUntilMs = 0;
    this.lastSpawnSummary = "WAITING";
    this.runtimeState.muzzleFlashUntilMs = 0;
    this.runtimeState.currentPlayerTeam = "BLUE";
    this.runtimeState.currentDummyTeam = "RED";
    this.runtimeState.currentDummyWeaponId = "carbine";
    this.runtimeState.currentDummyWeaponRole = "mid-range";
    this.runtimeState.playerBodyAngle = 0;
    this.runtimeState.dummyBodyAngle = 0;
    this.runtimeState.lastDummyIntentKey = "chase:false";
    this.runtimeState.lastActiveWeaponReloading = false;
    this.runtimeState.pendingBulletClear = false;
    this.runtimeState.playerConsecutiveBlockedFrames = 0;
    this.runtimeState.dummyConsecutiveBlockedFrames = 0;
    this.runtimeState.suppressPointerFireUntilMs = 0;
    this.inputOverlayActive = false;
    this.playerHitFeedback = createSpriteHitFeedbackState();
    this.dummyHitFeedback = createSpriteHitFeedbackState();
  }

  private createSpawnTableFromStage(stage: StageDefinition): TeamSpawnTable { return { BLUE: stage.blueSpawns, RED: stage.redSpawns }; }

  public preload(): void {
    preloadMainSceneAssets(this);
    preloadActorPresentationAssets(this, this.actorSkinDefinition);
    preloadWorldObjectPresentationAssets(this, this.worldObjectSkinDefinition);
  }

  public create(): void {
    const visualRefs = createBootstrapVisualRefs(this);
    this.crosshairHorizontal = visualRefs.crosshairHorizontal;
    this.crosshairVertical = visualRefs.crosshairVertical;
    this.muzzleFlash = visualRefs.muzzleFlash;
    this.runtimeState.muzzleFlash = this.muzzleFlash;

    createArenaPropTextures(this, this.gameBalance.arcadePresentation === true);
    createTurretAnimations(this);
    this.worldObjectPresentationComposition = new WorldObjectPresentationComposition(this, this.worldObjectSkinDefinition);
    this.worldObjectPresentationComposition.initialize(); this.stageGeometry.wirePresentation(this.worldObjectPresentationComposition); this.mapObjectController.wirePresentation(this.worldObjectPresentationComposition); this.onWorldObjectSkinResolved(this.worldObjectPresentationComposition.activeSkin);
    this.integratedPresentationComposition = new IntegratedPresentationComposition(this, this.worldObjectPresentationComposition.atlasActive || this.gameBalance.arcadePresentation === true, this.gameBalance.arcadePresentation === true);
    this.mapObjectController.wirePresentationEvents(this.integratedPresentationComposition);
    this.stageVisualController = new StageVisualController(addArenaBackdrop(this));
    this.stageVisualController.applyStage(this.currentStage.id);
    this.stageGeometry.applyStageGeometry(this.currentStage);
    const staticStageObjects = this.stageGeometry.createStaticRuntimeObjects();
    this.gate = staticStageObjects.gate;
    this.hazardZone = staticStageObjects.hazardZone;
    this.ammoPickup = staticStageObjects.ammoPickup;
    this.healthPickup = staticStageObjects.healthPickup;
    this.stageGeometry.applyStageContent(this.activeStageContentPlan);
    this.mapObjectController.applyMapObjects(this.activeStageContentPlan.mapObjects);

    this.actorPresentationComposition = new ActorPresentationComposition({
      scene: this, state: this.runtimeState, requestedSkin: this.actorSkinDefinition,
      playerSpawn: this.spawnTable.BLUE[0], dummySpawn: this.spawnTable.RED[0],
      controllerDeps: {
        getActiveWeaponId: () => this.combatController.getActiveWeaponSlot().id,
        getRespawnFxState: (now) => this.matchFlowController.getRespawnFxState(now),
        isCombatLive: (now) => this.isCombatLive(now),
        isPlayerHit: (now) => shouldShowHitFlash(this.playerHitFeedback, now),
        isDummyHit: (now) => shouldShowHitFlash(this.dummyHitFeedback, now)
      }
    });
    ({ playerSprite: this.playerSprite, targetDummy: this.targetDummy,
      playerWeaponSprite: this.playerWeaponSprite, dummyWeaponSprite: this.dummyWeaponSprite,
      controller: this.visualController } = this.actorPresentationComposition.refs);
    this.onActorSkinResolved(this.actorPresentationComposition.refs.activeSkin);
    this.playerCombatActor = {
      id: createActorId("player"), team: this.runtimeState.currentPlayerTeam, controller: "human",
      logic: this.playerLogic, sprite: this.playerSprite, animatedSprite: this.actorPresentationComposition.refs.playerAnimatedSprite,
      weaponSprite: this.playerWeaponSprite, weaponSlots: this.weaponSlots, activeWeaponIndex: this.weaponInventory.getActiveIndex(),
      shouldFire: false, bodyAngle: 0, isCoverProtected: () => false, onHit: (now) => { this.playerHitFeedback = recordHit(this.playerHitFeedback, now); }, destroy: () => undefined
    };
    this.primaryCpuCombatActor = {
      id: createActorId("dummy"), team: this.runtimeState.currentDummyTeam, controller: "cpu",
      logic: this.dummyLogic, sprite: this.targetDummy, animatedSprite: this.actorPresentationComposition.refs.dummyAnimatedSprite,
      weaponSprite: this.dummyWeaponSprite, weaponSlots: this.dummyWeaponSlots, activeWeaponIndex: 0,
      shouldFire: false, bodyAngle: Math.PI, isCoverProtected: (now) => this.dummyActorController.hasCoverProtection(now),
      onHit: (now) => { this.dummyHitFeedback = recordHit(this.dummyHitFeedback, now); }, destroy: () => undefined
    };
    this.cpuSquadController = new CpuSquadController(this, {
      roster: this.battleRoster, team: this.runtimeState.currentDummyTeam, gameBalance: this.gameBalance,
      actorSkin: this.actorPresentationComposition.refs.activeSkin, collisionResolver: this.actorCollisionResolver,
      createWeaponSlots: () => createDummyWeaponSlots(this.gameBalance),
      createView: (_id, team, spawn) => createAdditionalActorPresentation(this, this.actorPresentationComposition.refs.activeSkin, team, spawn),
      isCombatLive: (now) => this.isCombatLive(now), isMatchOver: () => this.roundLogic.state.isMatchOver,
      getWeatherMovementMultiplier: () => this.currentEffectiveWeather.movementMultiplier,
      getActorRotation: (angle) => this.visualController.getActorRotation(angle),
      getActiveObstacles: () => this.actorCollisionResolver.getActiveObstacles().map((obstacle) => obstacle.bounds),
      getWeaponTexture: (team, weaponId) => this.visualController.getWeaponTurretTexture(team, weaponId)
    });
    this.cpuSquadController.createAdditional(this.enemyCount, this.spawnTable[this.runtimeState.currentDummyTeam]);
    this.mapObjectController.wireSideEffects({
      actors: [
        { id: "player", logic: this.playerLogic, sprite: this.playerSprite },
        { id: "dummy", logic: this.dummyLogic, sprite: this.targetDummy },
        ...this.cpuSquadController.actors.map((actor) => ({ id: actor.id, logic: actor.logic, sprite: actor.sprite }))
      ],
      vfxController: this.vfxController,
      combatController: this.combatController,
      runtimeState: this.runtimeState
    });
    this.playerLogic.reset(this.spawnTable.BLUE[0].x - ACTOR_HALF_SIZE, this.spawnTable.BLUE[0].y - ACTOR_HALF_SIZE);
    this.dummyLogic.reset(this.spawnTable.RED[0].x - ACTOR_HALF_SIZE, this.spawnTable.RED[0].y - ACTOR_HALF_SIZE);
    this.roundStartUntilMs = 0;
    this.respawnFxUntilMs = 0;

    const inputBindings = initializeMainSceneInput(this);
    this.cursors = inputBindings.cursors;
    this.moveKeys = inputBindings.moveKeys;
    this.runtimeState.lastCombatEvent = "PRESS ENTER TO ENTER STAGE";
    this.lowHpVignette = new LowHpVignette(this, this.cameras.main.width, this.cameras.main.height);
    this.damageNumberRenderer = new DamageNumberRenderer(this);
    this.weatherRenderer = new WeatherRenderer(this, this.gameBalance.weather);
    this.weatherRenderer.applyWeather(this.currentEffectiveWeather);
    bindMainSceneLifecycle(this, this.handlePointerDown, this.onSceneShutdown, this);
  }

  private onSceneShutdown(): void {
    unbindMainScenePointer(this, this.handlePointerDown, this);
    this.combatController.clearBullets();
    this.combatController.flushPendingBulletClear();
    this.integratedPresentationComposition?.destroy();
    this.vfxController.destroy();
    this.integratedPresentationComposition = null;
    this.cpuSquadController?.destroy();
    this.actorPresentationComposition?.destroy();
    this.worldObjectPresentationComposition?.destroy();
    this.stageGeometry.releaseSceneObjects();
    this.hudController.publishShutdownSnapshot();
    this.mapObjectController.destroy();
    this.stageVisualController?.destroy();
    this.damageNumberRenderer?.destroy();
    this.weatherRenderer?.destroy();
    this.audioFeedbackController.destroy();
  }

  private handlePointerDown(): void {
    this.stageGeometry.handlePointerGateInteraction(this.time.now);
  }

  public update(_: number, delta: number): void {
    if (this.cursors === undefined || this.moveKeys === undefined) {
      return;
    }

    const now = this.time.now;

    if (this.inputOverlayActive) {
      this.hudController.updateMatchOverlay(now);
      this.hudController.publishHudSnapshot(now, false);
      this.weatherRenderer.update(delta, this.playerSprite?.x ?? 480, this.playerSprite?.y ?? 270);
      return;
    }

    const pausedByHitStop = now < this.audioFeedbackController.getCameraHitPauseUntilMs() && delta < 90;
    const frameDeltaMs = pausedByHitStop ? 0 : delta;
    const deltaSeconds = this.getStableDeltaSeconds(frameDeltaMs);

    // === INPUT === (gather all input state; no mutations)
    this.matchFlowController.handleStageFlow(now);
    const combatLocked = !this.isCombatLive(now);
    const inputLocked = combatLocked || this.playerLogic.isDead() || this.roundLogic.state.isMatchOver || this.playerLogic.isStunned(now);
    const moveInputX = inputLocked
      ? 0
      : Number(this.moveKeys.right.isDown || this.cursors.right.isDown) -
        Number(this.moveKeys.left.isDown || this.cursors.left.isDown);
    const moveInputY = inputLocked
      ? 0
      : Number(this.moveKeys.down.isDown || this.cursors.down.isDown) -
        Number(this.moveKeys.up.isDown || this.cursors.up.isDown);
    const previousX = this.playerLogic.state.positionX;
    const previousY = this.playerLogic.state.positionY;
    const isPlayerMoving = moveInputX !== 0 || moveInputY !== 0;

    // === LOGIC === (game state mutations in dependency order)

    // -- Movement: player body rotation + position --
    if (!inputLocked && isPlayerMoving) {
      const desiredMoveAngle = Math.atan2(moveInputY, moveInputX);
      this.runtimeState.playerBodyAngle = rotateAngleTowards(
        this.runtimeState.playerBodyAngle,
        desiredMoveAngle,
        BODY_TURN_RATE * deltaSeconds
      );
    }

    this.playerLogic.move(
      {
        x: moveInputX,
        y: moveInputY,
        sprint: this.moveKeys.sprint.isDown
      },
      deltaSeconds,
      now,
      this.currentEffectiveWeather.movementMultiplier
    );
    this.matchFlowController.tick(now);

    let playerCenterX = Phaser.Math.Clamp(
      this.playerLogic.state.positionX + ACTOR_HALF_SIZE,
      PLAYFIELD_MIN_X,
      PLAYFIELD_MAX_X
    );
    let playerCenterY = Phaser.Math.Clamp(
      this.playerLogic.state.positionY + ACTOR_HALF_SIZE,
      PLAYFIELD_MIN_Y,
      PLAYFIELD_MAX_Y
    );

    this.dummyActorController.updateMovement(deltaSeconds, now);
    this.cpuSquadController.updateMovement(deltaSeconds, now, this.playerCombatActor);

    if (!this.roundLogic.state.isMatchOver && this.matchFlow.state.phase !== "stage-entry") {
      this.playerLogic.updateAim(this.input.activePointer.worldX - ACTOR_HALF_SIZE, this.input.activePointer.worldY - ACTOR_HALF_SIZE, now);
    }

    // -- Weapon ticks --
    this.combatController.updateWeaponTicks(now);
    this.cpuSquadController.updateWeaponTicks(now);
    this.combatController.handleWeaponSwitch(now);
    this.combatController.handleReloadInterrupt(now);
    this.combatController.handleReload(now);

    // -- Bullets: advance existing bullets BEFORE spawning new ones --
    // This prevents newly fired bullets from getting a double-update on their
    // spawn frame (move on fire + move on updateBullets in the same tick).
    this.combatController.updateProjectiles(deltaSeconds, now);
    this.combatController.updateAirStrikes(frameDeltaMs);
    if (this.isCombatLive(now)) {
      this.mapObjectController.advanceTick(now, frameDeltaMs);
    }

    // -- Fire: spawn new bullets (will be advanced next frame) --
    this.combatController.handlePlayerFire(now);
    this.combatController.handleDummyFire(now);
    for (const actor of this.cpuSquadController.actors) this.combatController.handleCpuFire(actor, now);

    // -- Death-causing operations (hazard, pickups, round logic) --
    // Grouped so all actor-death sources run before death-dependent logic.
    this.stageGeometry.updateHazards(now);
    this.stageGeometry.handleAmmoPickup(now);
    this.stageGeometry.handleHealthPickup(now);
    this.stageGeometry.handleGateInteraction(now);

    // -- Round / match state (depends on deaths above) --
    this.matchFlowController.handleRoundReset(now);
    this.matchFlowController.handleMatchConfirm(now);
    this.combatController.flushPendingBulletClear();
    // === RESOLVE === (collision resolution, actor separation)
    const playerCollision = this.actorCollisionResolver.resolveActorObstacleCollision(
      playerCenterX,
      playerCenterY,
      previousX,
      previousY,
      this.playerLogic
    );
    const playerBlocked = playerCollision.blocked;
    playerCenterX = playerCollision.centerX;
    playerCenterY = playerCollision.centerY;

    this.resolveActorSeparation();
    this.dummyActorController.updateCoverState(now);

    // === VISUAL === (all rendering / HUD updates; no game-state mutations)
    this.playerSprite.setPosition(playerCenterX, playerCenterY);
    this.playerSprite.setRotation(this.visualController.getActorRotation(this.runtimeState.playerBodyAngle));
    this.vfxController.emitMovementFxForActor("player", now, isPlayerMoving ? 1 : 0);
    this.vfxController.update(now);
    this.visualController.updatePlayerVisuals(now);
    this.visualController.updateDummyVisuals(now);
    this.visualController.updateWeaponVisuals();
    this.stageGeometry.updatePickupVisuals(now);
    this.stageGeometry.updateCoverPointVisuals(now);
    this.visualController.updateCrosshair(now, this.crosshairHorizontal, this.crosshairVertical, this.muzzleFlash);
    this.weatherRenderer.update(frameDeltaMs, this.playerSprite.x, this.playerSprite.y);
    this.hudController.updateMatchOverlay(now);
    this.lowHpVignette.update(this.playerLogic.state.health, this.playerLogic.state.maxHealth);

    // Sprite hit-flash: override the team / death tint just applied by
    // updatePlayerVisuals / updateDummyVisuals with a red flash for
    // SPRITE_HIT_FLASH_DURATION_MS after a hit is recorded. setTint is called
    // every active frame because the visual updaters overwrite the tint each
    // tick; once the flash window ends, the next-frame visual update
    // naturally restores the correct team/death tint without an explicit
    // clearTint.
    if (shouldShowHitFlash(this.playerHitFeedback, now)) {
      this.playerSprite.setTint(0xff6a6a);
    }
    if (shouldShowHitFlash(this.dummyHitFeedback, now)) {
      this.targetDummy.setTint(0xff6a6a);
    }

    // === EMIT === (outbound events: HUD snapshot, sound cues)
    this.hudController.publishHudSnapshot(now, playerBlocked);
  }

  private getStableDeltaSeconds(deltaMs: number): number {
    return !Number.isFinite(deltaMs) || deltaMs <= 0 ? 0 : Math.min(deltaMs, MAX_FRAME_DELTA_MS) / 1000;
  }

  public getDebugSnapshot(): MainSceneDebugSnapshot { return this.debugController.getDebugSnapshot(this.time.now); }
  public debugGetRuntimeStats(): { bullets: number; activeAirStrikes: number; impactEffects: number; shotTrails: number; movementEffects: number; } { return this.debugController.getRuntimeStats(this.time.now); }
  public getHudSnapshot(now = this.time.now, movementBlocked = false): HudSnapshot { return this.hudController.getHudSnapshot(now, movementBlocked); }
  public getSettingsState(): SettingsState { return { ...this.settingsState }; }
  public applySettings(settings: SettingsState): SettingsState { this.settingsState = { masterVolume: settings.masterVolume, sfxVolume: settings.sfxVolume, mouseSensitivity: settings.mouseSensitivity, tutorialDismissed: settings.tutorialDismissed }; this.settingsStorage.save(this.settingsState); this.audioFeedbackController.setVolume(this.settingsState.masterVolume * this.settingsState.sfxVolume); this.runtimeState.lastCombatEvent = "SETTINGS UPDATED"; return this.getSettingsState(); }
  public setInputOverlayActive(active: boolean): void { this.inputOverlayActive = applyMainSceneInputOverlay(active, this.time.now, this.runtimeState); }
  public requestWeaponSlot(slot: number): void { if (!this.inputOverlayActive) this.combatController.requestWeaponSlot(slot, this.time.now); }
  public getRewardState(): RewardState { return this.rewardState; }
  public getLeaderboardState(): LeaderboardState { return this.leaderboardState; }
  public getLeaderboardPosition(): number | null { return getLeaderboardPosition(this.leaderboardState, "player"); }

  private applyRankAmmoBonus(): void {
    const rankMultiplier = { bronze: 1, silver: 1.2, gold: 1.4, platinum: 1.6, diamond: 2 }[getRankForScore(this.rewardState.totalScore).id];
    this.weaponSlots.forEach((slot) => slot.logic?.increaseAmmoCapacity(rankMultiplier));
  }
  public purchaseShopItem(itemId: string): PurchaseResult {
    const result = purchaseRewardItem(this.rewardState, itemId);
    if (!result.success || result.item === null) return result;
    this.rewardState = result.state;
    this.rewardStorage.save(this.rewardState);
    if (result.item.effect === "max-health") this.playerLogic.increaseMaxHealth(result.item.amount);
    if (result.item.effect === "movement-speed") this.playerLogic.increaseMovementSpeed(result.item.amount);
    this.runtimeState.lastCombatEvent = `${result.item.label.toUpperCase()} PURCHASED`;
    return result;
  }
  public requestStageEntry(): boolean { return this.matchFlowController.requestStageEntry(); } public debugEnterStage(): void { this.debugController.debugEnterStage(); } public debugSelectTeam(team: DebugTeamSelection): void { this.debugController.debugSelectTeam(team); } public debugConfirmTeamSelection(): void { this.debugController.debugConfirmTeamSelection(this.time.now); } public debugForceCombatLive(): void { this.debugController.debugForceCombatLive(); }
  public debugSwapWeapon(): void { this.debugController.debugSwapWeapon(this.time.now); } public debugSelectWeaponSlot(slotNumber: number): void { this.debugController.debugSelectWeaponSlot(slotNumber, this.time.now); } public debugFire(): void { this.debugController.debugFire(this.time.now); }
  public debugFireAt(targetX: number, targetY: number): void { this.debugController.debugFireAt(targetX, targetY, this.time.now); } public debugGetMapObjectStates() { return this.debugController.getMapObjectStates(); } public debugGetMapObjectCollisionRects() { return this.mapObjectController.getActiveCollisionRects(); } public debugGetWorldObjectPresentation() { return this.worldObjectPresentationComposition.getDebugState(); } public debugDamageMapObject(id: string, damage: number): void { this.mapObjectController.damageObject(id, damage); } public debugRotateStage(): void { this.matchFlowController.rotateStageForNextMatch(); } public debugGetProjectileSnapshot() { return this.debugController.getProjectileSnapshot(); } public debugAdvanceMapObjects(now: number): void { this.mapObjectController.advanceTick(now, 0); } public debugResolveProjectiles(): void { this.combatController.updateProjectiles(0, this.time.now); } public debugGetWeatherSoundQueue() { return this.audioFeedbackController.getWeatherSoundQueue(); } public debugClearWeatherSoundQueue(): void { this.audioFeedbackController.clearWeatherSoundQueue(); }
  public debugMovePlayerTo(x: number, y: number): void { this.debugController.debugMovePlayerTo(x, y); } public debugDamagePlayer(amount: number): void { this.debugController.debugDamagePlayer(amount, this.time.now); } public debugSetPlayerHullAngle(angleRadians: number): void { this.debugController.debugSetPlayerHullAngle(angleRadians); } public debugSetPlayerAimAngle(angleRadians: number): void { this.debugController.debugSetPlayerAimAngle(angleRadians); }
  public debugRecordActorHit(actor: "player" | "dummy"): void { if (actor === "player") this.playerHitFeedback = recordHit(this.playerHitFeedback, this.time.now); else this.dummyHitFeedback = recordHit(this.dummyHitFeedback, this.time.now); }
  public debugClearActorHitFeedback(): void { this.playerHitFeedback = createSpriteHitFeedbackState(); this.dummyHitFeedback = createSpriteHitFeedbackState(); this.visualController.resetActorVisuals(); } public debugHoldPlayerFirePresentation(durationMs = 1_000): void { this.runtimeState.muzzleFlashUntilMs = this.time.now + durationMs; } public debugHoldActorHitPresentation(actor: "player" | "dummy", durationMs = 1_000): void { const at = this.time.now + durationMs; if (actor === "player") this.playerHitFeedback = recordHit(this.playerHitFeedback, at); else this.dummyHitFeedback = recordHit(this.dummyHitFeedback, at); } public debugRestoreActorHealth(): void { this.playerLogic.state.health = this.playerLogic.state.maxHealth; this.dummyLogic.state.health = this.dummyLogic.state.maxHealth; }
  public debugRefreshActorPresentation(): void { this.visualController.updatePlayerVisuals(this.time.now); this.visualController.updateDummyVisuals(this.time.now); this.visualController.updateWeaponVisuals(); }
  public debugGetIntegratedPresentationEffectCount(): number { return this.integratedPresentationComposition?.getActiveEffectCount() ?? 0; }
  public debugGetCombatRoster() {
    const actors = [this.playerCombatActor, this.primaryCpuCombatActor, ...this.cpuSquadController.actors];
    return actors.map((actor) => ({ id: actor.id, team: actor.team, controller: actor.controller, health: actor.logic.state.health, alive: !actor.logic.isDead() }));
  }
  public debugForceCpuFire(actorId: string): boolean {
    const actor = [this.primaryCpuCombatActor, ...this.cpuSquadController.actors].find((candidate) => candidate.id === actorId);
    if (actor === undefined) return false;
    actor.shouldFire = true;
    this.combatController.handleCpuFire(actor, this.time.now);
    actor.shouldFire = false;
    return this.runtimeState.bullets.some((bullet) => bullet.ownerId === actor.id);
  }
  public debugGetProjectileOwners() { return this.runtimeState.bullets.map((bullet) => ({ owner: bullet.owner, ownerId: bullet.ownerId, ownerTeam: bullet.ownerTeam })); }
  public debugDamageCombatActor(actorId: string, damage: number): boolean { return this.combatController.debugDamageActor(createActorId(actorId), damage, this.time.now); }
  public debugResetCombatRound(): void { this.matchFlowController.resetRoundState(this.time.now); }
  public debugMoveDummyTo(x: number, y: number): void { this.debugController.debugMoveDummyTo(x, y); } public debugToggleGate(): void { this.stageGeometry.debugToggleGate(); } public debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void { this.debugController.debugForceMatchOver(winner, this.time.now); }
  public debugForceBossRound(): void { this.debugController.debugForceBossRound(this.time.now); } public debugRegisterPlayerRoundWin(): void { this.debugController.debugRegisterPlayerRoundWin(this.time.now); } public debugGetWeather(): WeatherState { return this.currentEffectiveWeather; }
  public debugSetWeather(type: WeatherState["type"]): void { this.debugController.debugSetWeather(type, this.time.now); } public clearBullets(): void { this.combatController.clearBullets(); } public updateDummyCoverState(now: number): void { this.dummyActorController.updateCoverState(now); }
  private setCurrentGlobalWeather(weather: WeatherState): void { this.currentGlobalWeather = weather; }
  private setCurrentEffectiveWeather(weather: WeatherState): void { this.currentEffectiveWeather = weather; this.runtimeState.currentWeather = weather; this.weatherRenderer.applyWeather(weather); }
  private applyCurrentWeather(weather: WeatherState): void { this.setCurrentGlobalWeather(weather); this.setCurrentEffectiveWeather(weather); }
  private isCombatLive(now: number): boolean { return this.matchFlow.state.phase === "combat-live" && !this.matchFlowController.isRoundStarting(now); }

  private isWeaponAvailable(weaponId: string): boolean {
    return this.unlockAllWeaponsForDev || isWeaponUnlocked(weaponId, this.progressionState, this.unlockRules, this.defaultWeaponIds);
  }

  private getTacticalPositionConfig(): TacticalPositionConfig {
    return {
      coverSearchRadius: this.gameBalance.botTactics?.coverSearchRadius ?? this.gameBalance.dummyEngageRange,
      preferredDistance: this.gameBalance.botTactics?.preferredHoldRange ?? this.gameBalance.dummyShootRange * 0.56,
      retreatDistance: this.gameBalance.botTactics?.retreatRange ?? this.gameBalance.dummyRetreatRange,
      flankDistance: this.gameBalance.botTactics?.flankRange ?? this.gameBalance.dummyShootRange * 0.7,
      anchorPadding: this.gameBalance.coverPointRadius,
      weatherCautionMultiplier: this.gameBalance.botTactics?.weatherCautionVisionMultiplier ?? 1
    };
  }

  private resolveActorSeparation(): void {
    const deltaX = this.targetDummy.x - this.playerSprite.x;
    const deltaY = this.targetDummy.y - this.playerSprite.y;
    const rawDistance = Math.hypot(deltaX, deltaY);

    if (rawDistance >= ACTOR_MIN_SEPARATION) {
      return;
    }

    const distance = rawDistance === 0 ? 1 : rawDistance;
    const fallbackAngle = this.playerLogic.state.aimAngleRadians;
    const normalX = rawDistance === 0 ? Math.cos(fallbackAngle) : deltaX / distance;
    const normalY = rawDistance === 0 ? Math.sin(fallbackAngle) : deltaY / distance;
    const overlap = ACTOR_MIN_SEPARATION - rawDistance;
    const pushX = normalX * overlap * 0.5;
    const pushY = normalY * overlap * 0.5;
    const playerCenter = this.actorCollisionResolver.resolveStaticActorCenter(
      this.playerSprite,
      this.playerLogic,
      this.playerSprite.x - pushX,
      this.playerSprite.y - pushY
    );
    const dummyCenter = this.actorCollisionResolver.resolveStaticActorCenter(
      this.targetDummy,
      this.dummyLogic,
      this.targetDummy.x + pushX,
      this.targetDummy.y + pushY
    );

    this.playerSprite.setPosition(playerCenter.x, playerCenter.y);
    this.targetDummy.setPosition(dummyCenter.x, dummyCenter.y);
  }

  private getCombatAvailability(now: number) { return { isCombatLive: this.isCombatLive(now), isPlayerDead: this.playerLogic.isDead(), isDummyDead: !this.battleRoster.hasLivingTeamMember(this.runtimeState.currentDummyTeam), isMatchOver: this.roundLogic.state.isMatchOver, isPlayerStunned: this.playerLogic.isStunned(now) }; }

}
