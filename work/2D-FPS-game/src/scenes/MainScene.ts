import Phaser from "phaser";
import { DummyAiLogic, type CoverPoint, type DummyAiDecision } from "../domain/ai/DummyAiLogic";
import { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import { StageContentSpawner, type StageContentSpawnPlan } from "../domain/map/StageContentSpawner";
import type { StageDefinitionWithContent } from "../domain/map/StageContentDefinition";
import { createStageRotationState, selectNextStage, type StageRotationState } from "../domain/map/StageRotationLogic";
import { PlayerLogic } from "../domain/player/PlayerLogic";
import { createSpriteHitFeedbackState, recordHit, shouldShowHitFlash, type SpriteHitFeedbackState } from "../domain/feedback/SpriteHitFeedback";
import { resolveDamageNumber } from "../domain/feedback/DamageNumberLogic";
import { DamageNumberRenderer } from "./damage-number-renderer";
import {
  createProgressionState,
  type ProgressionState
} from "../domain/progression/ProgressionLogic";
import { createProgressionStorage, type ProgressionStorageAdapter } from "../domain/progression/ProgressionStorage";
import { createSettingsStorage, DEFAULT_SETTINGS, type SettingsState, type SettingsStorageAdapter } from "../domain/settings/SettingsStorage";
import {
  createUnlockState,
  isWeaponUnlocked,
  type UnlockState,
  type WeaponUnlockRule,
} from "../domain/progression/UnlockLogic";
import {
  MatchFlowLogic
} from "../domain/round/MatchFlowLogic";
import { createBossSpawn, type BossWaveRules, type BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import { RoundLogic } from "../domain/round/RoundLogic";
import type { HudSnapshot } from "../ui/hud-events";
import { createPlayerWeaponSlots, createDummyWeaponSlots } from "./weapon-slot-factory";
import {
  createArenaPropTextures,
  createActorSkins as createActorSkinsTextures,
  createActorImage,
  createTurretAnimations,
  addArenaBackdrop,
} from "./arena-textures";
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
import { MatchFlowController, type MatchFlowControllerState } from "./match-flow-controller";
import { AudioFeedbackController } from "./audio-feedback-controller";
import { VisualController } from "./visual-controller";
import { DebugController } from "./debug-controller";
import { createInputBindings, type MoveKeys } from "./input-bindings";
import {
  bindMainSceneLifecycle,
  createBootstrapVisualRefs,
  getBrowserStorageBackend,
  preloadMainSceneAssets,
  unbindMainScenePointer
} from "./scene-bootstrap";
import {
  AMMO_OVERDRIVE_MS,
  ACTOR_HALF_SIZE, ACTOR_MIN_SEPARATION,
  MAX_FRAME_DELTA_MS,
  PLAYER_WEAPON_SCALE, DUMMY_WEAPON_SCALE,
  BODY_TURN_RATE,
  PLAYFIELD_MIN_X, PLAYFIELD_MAX_X, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y,
  GROUND_TURRET_CARBINE_BLUE_KEY, GROUND_TURRET_CARBINE_RED_KEY,
  DEFAULT_BOSS_WAVE_RULES,
} from "./scene-constants";

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
  private readonly stageDefinitions: readonly StageDefinition[];
  private readonly stageContentSpawner: StageContentSpawner;
  private readonly progressionStorage: ProgressionStorageAdapter;
  private readonly settingsStorage: SettingsStorageAdapter;
  private settingsState: SettingsState;
  private readonly unlockRules: readonly WeaponUnlockRule[];
  private readonly defaultWeaponIds: readonly string[];
  private readonly unlockAllWeaponsForDev: boolean;
  private stageRotationState: StageRotationState;
  private progressionState: ProgressionState;
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
  private readonly stageGeometry: StageGeometryManager;
  private readonly hudController: HudController;
  private readonly matchFlowController: MatchFlowController;
  private readonly audioFeedbackController: AudioFeedbackController;
  private readonly visualController: VisualController;
  private readonly debugController: DebugController;
  private roundResetAtMs: number | null;
  private roundStartUntilMs: number;
  private respawnFxUntilMs: number;
  private matchConfirmAtMs: number | null;
  private matchConfirmReadyCueSent: boolean;
  private lastSpawnSummary: string;
  private inputOverlayActive: boolean;
  private playerHitFeedback: SpriteHitFeedbackState;
  private dummyHitFeedback: SpriteHitFeedbackState;
  public constructor(gameBalance: GameBalance) {
    super("MainScene");
    this.gameBalance = gameBalance;
    this.bossWaveRules = gameBalance.bossWave ?? DEFAULT_BOSS_WAVE_RULES;
    this.playerLogic = new PlayerLogic(gameBalance.maxHealth, {
      movementSpeed: gameBalance.movementSpeed,
      dashMultiplier: gameBalance.dashMultiplier
    });
    this.dummyLogic = new PlayerLogic(gameBalance.maxHealth, {
      movementSpeed: gameBalance.dummyMovementSpeed,
      dashMultiplier: 1
    });
    this.weaponSlots = createPlayerWeaponSlots(gameBalance);
    this.weaponInventory = new WeaponInventoryLogic(
      this.weaponSlots.map((slot) => ({
        id: slot.id,
        label: slot.label
      }))
    );
    this.dummyWeaponSlots = createDummyWeaponSlots(gameBalance);
    this.roundLogic = new RoundLogic(gameBalance.matchScoreToWin);
    this.dummyAiLogic = new DummyAiLogic({
      engageRange: gameBalance.dummyEngageRange,
      retreatRange: gameBalance.dummyRetreatRange,
      shootRange: gameBalance.dummyShootRange,
      lowHealthThreshold: gameBalance.dummyLowHealthThreshold
    });
    this.bullets = [];
    this.activeAirStrikes = [];
    this.obstacles = [];
    this.stageObstacleViews = [];
    this.matchFlow = new MatchFlowLogic();
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
    this.settingsStorage = createSettingsStorage(getBrowserStorageBackend(), "2d-fps-game:settings");
    this.settingsState = this.settingsStorage.load() ?? DEFAULT_SETTINGS;
    this.audioFeedbackController = new AudioFeedbackController(this);
    this.audioFeedbackController.setVolume(this.settingsState.masterVolume * this.settingsState.sfxVolume);
    this.progressionState = this.progressionStorage.load() ?? createProgressionState();
    this.unlockRules = gameBalance.unlocks.weaponRules;
    this.defaultWeaponIds = gameBalance.unlocks.defaultWeaponIds;
    this.unlockAllWeaponsForDev = import.meta.env.DEV;
    this.unlockState = createUnlockState(this.progressionState, this.unlockRules, this.defaultWeaponIds);
    this.newlyUnlockedWeaponIds = [];
    this.unlockNoticeUntilMs = 0;
    this.dummyCoverPoints = [
      { x: 700, y: 160 },
      { x: 690, y: 390 },
      { x: 260, y: 330 }
    ];
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
      lastCombatEvent: "READY",
      recentImpactEffectUntilMs: 0,
      lastDummyDecision: "chase",
      dummyInCover: false,
      dummyCoverBonusUntilMs: 0,
      activeDummyCoverIndex: null,
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
      isPlayerSprintDown: () => this.moveKeys?.sprint.isDown === true
    });
    this.visualController = new VisualController(this, this.runtimeState, {
      getActiveWeaponId: () => this.combatController.getActiveWeaponSlot().id,
      getRespawnFxState: (now) => this.matchFlowController.getRespawnFxState(now),
      isCombatLive: (now) => this.isCombatLive(now)
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
      // TODO: plumb an isCritical signal from weapon/damage resolution when
      // critical-hit logic lands. For now every number renders in the
      // non-critical profile.
      spawnDamageNumber: (x, y, damage, isCritical) => {
        if (damage <= 0 || this.damageNumberRenderer === undefined) {
          return;
        }
        this.damageNumberRenderer.spawn(x, y - 12, resolveDamageNumber(Math.round(damage), isCritical));
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
      }
    });
    this.dummyActorController = new DummyActorController(this, this.runtimeState, this.actorCollisionResolver, {
      dummyAiLogic: this.dummyAiLogic,
      isCombatLive: (now) => this.isCombatLive(now),
      isMatchOver: () => this.roundLogic.state.isMatchOver,
      getPreferredDummyWeaponId: () => this.combatController.getPreferredDummyWeaponId(),
      getActorRotation: (angleRadians) => this.visualController.getActorRotation(angleRadians),
      emitMovementFxForActor: (actor, now, throttleInput) => {
        this.vfxController.emitMovementFxForActor(actor, now, throttleInput);
      },
      coverPointRadius: this.gameBalance.coverPointRadius
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
      suppressPointerFireUntil: (untilMs) => {
        this.runtimeState.suppressPointerFireUntilMs = untilMs;
      }
    });
    this.hudController = new HudController(this, this.runtimeState, {
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
      setMatchConfirmReadyCueSent: (sent) => {
        this.matchConfirmReadyCueSent = sent;
      },
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event),
      enterMatchOver: () => this.matchFlow.enterMatchOver(),
      getCoverEffectId: (index) => this.dummyActorController.getCoverEffectId(index)
    });
    this.matchFlowController = new MatchFlowController({
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
      gameBalance: this.gameBalance,
      bossWaveRules: this.bossWaveRules,
      unlockRules: this.unlockRules,
      defaultWeaponIds: this.defaultWeaponIds,
      getState: () => this.createMatchFlowControllerState(),
      getStageInput: () => this.getStageFlowInput(),
      isConfirmDown: () => this.moveKeys !== undefined && (
        Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm) || this.moveKeys.confirm.isDown
      ),
      setLastCombatEvent: (event) => {
        this.runtimeState.lastCombatEvent = event;
      },
      setCurrentDummyWeaponId: (weaponId) => {
        this.runtimeState.currentDummyWeaponId = weaponId;
      },
      setLastDummyIntentKey: (key) => {
        this.runtimeState.lastDummyIntentKey = key;
      },
      setLastActiveWeaponReloading: (value) => {
        this.runtimeState.lastActiveWeaponReloading = value;
      },
      setPlayerBodyAngle: (angle) => {
        this.runtimeState.playerBodyAngle = angle;
      },
      setDummyBodyAngle: (angle) => {
        this.runtimeState.dummyBodyAngle = angle;
      },
      setLastDummyDecision: (decision) => {
        const normalizedDecision: DummyAiDecision["mode"] = decision === "hold-cover" ? "cover" : decision;
        this.runtimeState.lastDummyDecision = normalizedDecision;
      },
      setLastDummyShouldFire: (value) => {
        this.runtimeState.lastDummyShouldFire = value;
      },
      setLastDummySteerX: (value) => {
        this.runtimeState.lastDummySteerX = value;
      },
      setLastDummySteerY: (value) => {
        this.runtimeState.lastDummySteerY = value;
      },
      setDummySteerLockUntilMs: (value) => {
        this.runtimeState.dummySteerLockUntilMs = value;
      },
      applyTeamVisuals: (playerTeam, dummyTeam) => this.visualController.applyTeamVisuals(playerTeam, dummyTeam),
      getActorRotation: (angleRadians) => this.visualController.getActorRotation(angleRadians),
      setPlayerSpriteDeployment: (x, y, rotation) => {
        this.playerSprite.setPosition(x, y);
        this.playerSprite.setRotation(rotation);
      },
      setDummySpriteDeployment: (x, y, rotation) => {
        this.targetDummy.setPosition(x, y);
        this.targetDummy.setRotation(rotation);
      },
      resetActorVisuals: () => {
        this.visualController.resetActorVisuals();
      },
      applyGateDeployment: (open) => {
        this.gate.open = open;
        this.gate.sprite.setAlpha(1);
        this.gate.sprite.setFillStyle(0xf4a261, 1);
      },
      clearBullets: () => this.combatController.clearBullets(),
      resetPickupState: () => this.stageGeometry.resetPickupState(),
      resetHazardState: () => this.stageGeometry.resetHazardState(),
      applyStageGeometry: () => this.stageGeometry.applyStageGeometry(this.currentStage),
      applyStageContentToRuntime: () => this.stageGeometry.applyStageContent(this.activeStageContentPlan),
      emitSoundCue: (event) => this.audioFeedbackController.emitSoundCue(event)
    });
    this.debugController = new DebugController({
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
      getLastSpawnSummary: () => this.lastSpawnSummary,
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
    this.runtimeState.dummyInCover = false;
    this.runtimeState.dummyCoverBonusUntilMs = 0;
    this.runtimeState.activeDummyCoverIndex = null;
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
    this.runtimeState.playerBodyAngle = 0;
    this.runtimeState.dummyBodyAngle = 0;
    this.runtimeState.lastDummyIntentKey = "chase:false";
    this.runtimeState.lastActiveWeaponReloading = false;
    this.runtimeState.playerConsecutiveBlockedFrames = 0;
    this.runtimeState.dummyConsecutiveBlockedFrames = 0;
    this.runtimeState.suppressPointerFireUntilMs = 0;
    this.inputOverlayActive = false;
    this.playerHitFeedback = createSpriteHitFeedbackState();
    this.dummyHitFeedback = createSpriteHitFeedbackState();
  }

  private createSpawnTableFromStage(stage: StageDefinition): TeamSpawnTable {
    return {
      BLUE: stage.blueSpawns,
      RED: stage.redSpawns
    };
  }

  private createMatchFlowControllerState(): MatchFlowControllerState {
    const state = {} as MatchFlowControllerState;
    Object.defineProperties(state, {
      stageRotationState: { get: () => this.stageRotationState, set: (value: StageRotationState) => { this.stageRotationState = value; } },
      progressionState: { get: () => this.progressionState, set: (value: ProgressionState) => { this.progressionState = value; } },
      unlockState: { get: () => this.unlockState, set: (value: UnlockState) => { this.unlockState = value; } },
      newlyUnlockedWeaponIds: { get: () => this.newlyUnlockedWeaponIds, set: (value: readonly string[]) => { this.newlyUnlockedWeaponIds = value; } },
      unlockNoticeUntilMs: { get: () => this.unlockNoticeUntilMs, set: (value: number) => { this.unlockNoticeUntilMs = value; } },
      currentStage: { get: () => this.currentStage, set: (value: StageDefinition) => { this.currentStage = value; } },
      bossWavePlan: { get: () => this.bossWavePlan, set: (value: BossWaveSpawnPlan | null) => { this.bossWavePlan = value; } },
      activeStageContentPlan: { get: () => this.activeStageContentPlan, set: (value: StageContentSpawnPlan) => { this.activeStageContentPlan = value; } },
      spawnTable: { get: () => this.spawnTable, set: (value: TeamSpawnTable) => { this.spawnTable = value; } },
      roundResetAtMs: { get: () => this.roundResetAtMs, set: (value: number | null) => { this.roundResetAtMs = value; } },
      roundStartUntilMs: { get: () => this.roundStartUntilMs, set: (value: number) => { this.roundStartUntilMs = value; } },
      respawnFxUntilMs: { get: () => this.respawnFxUntilMs, set: (value: number) => { this.respawnFxUntilMs = value; } },
      matchConfirmAtMs: { get: () => this.matchConfirmAtMs, set: (value: number | null) => { this.matchConfirmAtMs = value; } },
      matchConfirmReadyCueSent: { get: () => this.matchConfirmReadyCueSent, set: (value: boolean) => { this.matchConfirmReadyCueSent = value; } },
      lastSpawnSummary: { get: () => this.lastSpawnSummary, set: (value: string) => { this.lastSpawnSummary = value; } }
    });
    return state;
  }

  public preload(): void {
    preloadMainSceneAssets(this, this.gameBalance);
  }

  public create(): void {
    const visualRefs = createBootstrapVisualRefs(this);
    this.crosshairHorizontal = visualRefs.crosshairHorizontal;
    this.crosshairVertical = visualRefs.crosshairVertical;
    this.muzzleFlash = visualRefs.muzzleFlash;
    this.runtimeState.muzzleFlash = this.muzzleFlash;

    createArenaPropTextures(this);
    createActorSkinsTextures(this);
    createTurretAnimations(this);
    addArenaBackdrop(this);
    this.stageGeometry.applyStageGeometry(this.currentStage);
    const staticStageObjects = this.stageGeometry.createStaticRuntimeObjects();
    this.gate = staticStageObjects.gate;
    this.hazardZone = staticStageObjects.hazardZone;
    this.ammoPickup = staticStageObjects.ammoPickup;
    this.healthPickup = staticStageObjects.healthPickup;
    this.stageGeometry.applyStageContent(this.activeStageContentPlan);

    this.playerSprite = createActorImage(this, "player", this.spawnTable.BLUE[0].x, this.spawnTable.BLUE[0].y);
    this.targetDummy = createActorImage(this, "dummy", this.spawnTable.RED[0].x, this.spawnTable.RED[0].y);
    this.playerWeaponSprite = this.add
      .sprite(this.playerSprite.x, this.playerSprite.y, GROUND_TURRET_CARBINE_BLUE_KEY, 0)
      .setDepth(6)
      .setOrigin(0.5, 0.72)
      .setScale(PLAYER_WEAPON_SCALE);
    this.dummyWeaponSprite = this.add
      .sprite(this.targetDummy.x, this.targetDummy.y, GROUND_TURRET_CARBINE_RED_KEY, 0)
      .setDepth(6)
      .setOrigin(0.5, 0.72)
      .setScale(DUMMY_WEAPON_SCALE);
    this.runtimeState.playerSprite = this.playerSprite;
    this.runtimeState.targetDummy = this.targetDummy;
    this.runtimeState.playerWeaponSprite = this.playerWeaponSprite;
    this.runtimeState.dummyWeaponSprite = this.dummyWeaponSprite;
    this.playerLogic.reset(0, 0);
    this.dummyLogic.reset(this.spawnTable.RED[0].x - ACTOR_HALF_SIZE, this.spawnTable.RED[0].y - ACTOR_HALF_SIZE);
    this.roundStartUntilMs = 0;
    this.respawnFxUntilMs = 0;

    const inputBindings = createInputBindings(this);
    this.cursors = inputBindings.cursors;
    this.moveKeys = inputBindings.moveKeys;
    this.runtimeState.lastCombatEvent = "PRESS ENTER TO ENTER STAGE";
    this.lowHpVignette = new LowHpVignette(this, this.cameras.main.width, this.cameras.main.height);
    this.damageNumberRenderer = new DamageNumberRenderer(this);

    bindMainSceneLifecycle(this, this.handlePointerDown, this.onSceneShutdown, this);
  }

  private onSceneShutdown(): void {
    unbindMainScenePointer(this, this.handlePointerDown, this);
    this.hudController.publishShutdownSnapshot();
    this.damageNumberRenderer?.destroy();
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
      now
    );

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

    if (!this.roundLogic.state.isMatchOver && this.matchFlow.state.phase !== "stage-entry") {
      this.playerLogic.updateAim(this.input.activePointer.worldX - ACTOR_HALF_SIZE, this.input.activePointer.worldY - ACTOR_HALF_SIZE, now);
    }

    // -- Weapon ticks --
    this.combatController.updateWeaponTicks(now);
    this.combatController.handleWeaponSwitch(now);
    this.combatController.handleReloadInterrupt(now);
    this.combatController.handleReload(now);

    // -- Bullets: advance existing bullets BEFORE spawning new ones --
    // This prevents newly fired bullets from getting a double-update on their
    // spawn frame (move on fire + move on updateBullets in the same tick).
    this.combatController.updateProjectiles(deltaSeconds, now);
    this.combatController.updateAirStrikes(frameDeltaMs);

    // -- Fire: spawn new bullets (will be advanced next frame) --
    this.combatController.handlePlayerFire(now);
    this.combatController.handleDummyFire(now);

    // -- Death-causing operations (hazard, pickups, round logic) --
    // Grouped so all actor-death sources run before death-dependent logic.
    this.stageGeometry.updateHazards(now);
    this.stageGeometry.handleAmmoPickup(now);
    this.stageGeometry.handleHealthPickup(now);
    this.stageGeometry.handleGateInteraction(now);

    // -- Round / match state (depends on deaths above) --
    this.matchFlowController.handleRoundReset(now);
    this.matchFlowController.handleMatchConfirm(now);

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

  public debugGetRuntimeStats(): {
    bullets: number;
    activeAirStrikes: number;
    impactEffects: number;
    shotTrails: number;
    movementEffects: number;
  } {
    return this.debugController.getRuntimeStats(this.time.now);
  }

  public getHudSnapshot(now = this.time.now, movementBlocked = false): HudSnapshot { return this.hudController.getHudSnapshot(now, movementBlocked); }

  public getSettingsState(): SettingsState { return { ...this.settingsState }; }

  public applySettings(settings: SettingsState): SettingsState {
    this.settingsState = { masterVolume: settings.masterVolume, sfxVolume: settings.sfxVolume, mouseSensitivity: settings.mouseSensitivity, tutorialDismissed: settings.tutorialDismissed };
    this.settingsStorage.save(this.settingsState);
    this.audioFeedbackController.setVolume(this.settingsState.masterVolume * this.settingsState.sfxVolume);
    this.runtimeState.lastCombatEvent = "SETTINGS UPDATED";
    return this.getSettingsState();
  }

  public setInputOverlayActive(active: boolean): void { this.inputOverlayActive = active; this.runtimeState.suppressPointerFireUntilMs = active ? Number.POSITIVE_INFINITY : this.time.now + 200; }

  public debugEnterStage(): void { this.debugController.debugEnterStage(); }

  public debugSelectTeam(team: DebugTeamSelection): void { this.debugController.debugSelectTeam(team); }

  public debugConfirmTeamSelection(): void { this.debugController.debugConfirmTeamSelection(this.time.now); }

  public debugForceCombatLive(): void { this.debugController.debugForceCombatLive(); }

  public debugSwapWeapon(): void { this.debugController.debugSwapWeapon(this.time.now); }

  public debugSelectWeaponSlot(slotNumber: number): void { this.debugController.debugSelectWeaponSlot(slotNumber, this.time.now); }

  public debugFire(): void { this.debugController.debugFire(this.time.now); }

  public debugFireAt(targetX: number, targetY: number): void { this.debugController.debugFireAt(targetX, targetY, this.time.now); }

  public debugMovePlayerTo(x: number, y: number): void { this.debugController.debugMovePlayerTo(x, y); }

  public debugSetPlayerHullAngle(angleRadians: number): void { this.debugController.debugSetPlayerHullAngle(angleRadians); }

  public debugSetPlayerAimAngle(angleRadians: number): void { this.debugController.debugSetPlayerAimAngle(angleRadians); }

  public debugMoveDummyTo(x: number, y: number): void { this.debugController.debugMoveDummyTo(x, y); }

  public debugToggleGate(): void { this.debugController.debugToggleGate(); }

  public debugForceMatchOver(winner: "PLAYER" | "DUMMY"): void { this.debugController.debugForceMatchOver(winner, this.time.now); }

  public debugForceBossRound(): void { this.debugController.debugForceBossRound(this.time.now); }

  public debugRegisterPlayerRoundWin(): void { this.debugController.debugRegisterPlayerRoundWin(this.time.now); }
  public clearBullets(): void { this.combatController.clearBullets(); }
  public updateDummyCoverState(now: number): void { this.dummyActorController.updateCoverState(now); }

  private getStageFlowInput() {
    if (this.moveKeys === undefined || this.cursors === undefined) {
      return null;
    }

    return {
      confirmPressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.confirm),
      selectBluePressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon1) || Phaser.Input.Keyboard.JustDown(this.cursors.left),
      selectRedPressed: Phaser.Input.Keyboard.JustDown(this.moveKeys.weapon2) || Phaser.Input.Keyboard.JustDown(this.cursors.right)
    };
  }

  private isCombatLive(now: number): boolean {
    return this.matchFlow.state.phase === "combat-live" && !this.matchFlowController.isRoundStarting(now);
  }

  private isWeaponAvailable(weaponId: string): boolean {
    return this.unlockAllWeaponsForDev || isWeaponUnlocked(weaponId, this.progressionState, this.unlockRules, this.defaultWeaponIds);
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

  private getCombatAvailability(now: number) {
    return {
      isCombatLive: this.isCombatLive(now),
      isPlayerDead: this.playerLogic.isDead(),
      isDummyDead: this.dummyLogic.isDead(),
      isMatchOver: this.roundLogic.state.isMatchOver,
      isPlayerStunned: this.playerLogic.isStunned(now)
    };
  }

}
