import Phaser from "phaser";
import type { SoundCueEvent, SoundCueKey } from "../domain/audio/SoundCueLogic";
import type { BossWaveRules, BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import { getXpRequiredForNextLevel, type ProgressionState } from "../domain/progression/ProgressionLogic";
import type { UnlockState, WeaponUnlockRule } from "../domain/progression/UnlockLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import type { StageRotationState } from "../domain/map/StageRotationLogic";
import type { MatchFlowLogic } from "../domain/round/MatchFlowLogic";
import { resolveBossWaveOverlay } from "../domain/round/MatchFlowOrchestrator";
import type { RoundLogic } from "../domain/round/RoundLogic";
import {
  HUD_SNAPSHOT_EVENT,
  type HudAreaPreviewSnapshot,
  type HudBlastPreviewSnapshot,
  type HudOverlayState,
  type HudProgressionSnapshot,
  type HudSnapshot,
  type HudWindChangedDetail,
  type HudWeaponSlotSnapshot,
  type HudWeaponUnlockSnapshot,
  WIND_CHANGED_EVENT,
  readLatestHudWind
} from "../ui/hud-events";
import { buildHudSnapshot, buildMatchOverlayState, type HudPresenterInput } from "../ui/hud-presenters";
import { COVER_VISION_RADIUS, PLAYFIELD_MAX_X, PLAYFIELD_MAX_Y, PLAYFIELD_MIN_X, PLAYFIELD_MIN_Y } from "./scene-constants";
import type { CoverEffectId, GameBalance, PlayerWeaponSlot } from "./scene-types";
import type { SceneRuntimeState } from "./scene-runtime-state";

export interface HudControllerDeps {
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
  readonly enterMatchOver: () => void;
  readonly getCoverEffectId: (index: number) => CoverEffectId;
}

export class HudController {
  private windState = readLatestHudWind();

  private overlayState: HudOverlayState = {
    visible: false,
    title: "",
    subtitle: ""
  };

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: SceneRuntimeState,
    private readonly deps: HudControllerDeps
  ) {
    window.addEventListener(WIND_CHANGED_EVENT, this.handleWindChanged as EventListener);
  }

  public getHudSnapshot(now = this.scene.time.now, movementBlocked = false): HudSnapshot {
    return buildHudSnapshot(this.createHudPresenterInput(now, movementBlocked), this.overlayState);
  }

  public publishHudSnapshot(now: number, movementBlocked: boolean): void {
    window.dispatchEvent(new CustomEvent<HudSnapshot>(HUD_SNAPSHOT_EVENT, {
      detail: this.getHudSnapshot(now, movementBlocked)
    }));
  }

  public publishShutdownSnapshot(): void {
    const resetSnapshot: HudSnapshot = {
      phase: "STAGE ENTRY",
      team: "UNSET",
      spawn: "Awaiting deployment",
      activeWeapon: "Carbine",
      weaponSlot: 1,
      weaponSlots: this.createWeaponHudSlots(0),
      ammoInMagazine: this.deps.gameBalance.magazineSize,
      reserveAmmo: this.deps.gameBalance.reserveAmmo,
      isReloading: false,
      reloadProgress: 0,
      cooldownRemainingMs: 0,
      cooldownDurationMs: 0,
      playerHealth: this.deps.gameBalance.maxHealth,
      playerMaxHealth: this.deps.gameBalance.maxHealth,
      dummyHealth: this.deps.gameBalance.maxHealth,
      dummyMaxHealth: this.deps.gameBalance.maxHealth,
      gateOpen: false,
      roundNumber: 1,
      playerScore: 0,
      dummyScore: 0,
      scoreToWin: this.deps.gameBalance.matchScoreToWin,
      lastEvent: "Press Enter to enter the arena.",
      lastSoundCue: "NONE",
      movementMode: "Walk",
      movementBlocked: false,
      roundStartLabel: "LIVE",
      ammoPickupLabel: "READY",
      healthPickupLabel: "READY",
      coverVisionActive: false,
      coverVisionX: 480,
      coverVisionY: 270,
      coverVisionRadius: 72,
      wind: {
        visible: true,
        angleDegrees: this.windState.angleDegrees,
        strength: this.windState.strength,
        arrowSizePx: 24,
        pips: [1, 2, 3].map((index) => ({
          index,
          active: this.windState.strength >= index,
          color: this.windState.strength >= 3 ? "#ff5f5f" : this.windState.strength >= 2 ? "#ffd166" : "#5eead4"
        }))
      },
      overlay: { visible: false, title: "", subtitle: "" }
    };

    window.dispatchEvent(new CustomEvent<HudSnapshot>(HUD_SNAPSHOT_EVENT, { detail: resetSnapshot }));
  }

  public updateMatchOverlay(now: number): void {
    const bossWave = this.resolveBossWaveOverlay();
    const overlayResult = buildMatchOverlayState(this.createHudPresenterInput(now, false, bossWave));

    if (overlayResult.shouldEmitMatchConfirmReadyCue) {
      this.deps.emitSoundCue({ kind: "match-confirm", action: "ready" });
      this.deps.setMatchConfirmReadyCueSent(true);
    }

    if (overlayResult.shouldEnterMatchOver) {
      this.deps.enterMatchOver();
    }

    this.overlayState = overlayResult.overlay;
  }

  private createHudPresenterInput(
    now: number,
    movementBlocked: boolean,
    bossWave = this.resolveBossWaveOverlay()
  ): HudPresenterInput {
    const activeWeapon = this.deps.getActiveWeaponSlot();
    const coverVision = this.getHudCoverVisionState();
    const activeWeaponIndex = this.deps.getActiveWeaponIndex();

    return {
      now,
      matchFlow: this.deps.matchFlow.state,
      round: this.deps.roundLogic.state,
      combat: {
        selectedTeam: this.deps.matchFlow.state.selectedTeam,
        spawnSummary: this.deps.getLastSpawnSummary(),
        activeWeapon: activeWeapon.label,
        weaponSlot: activeWeaponIndex + 1,
        weaponSlots: this.createWeaponHudSlots(activeWeaponIndex, now),
        ammoInMagazine: activeWeapon.logic.getAmmoInMagazine(now),
        reserveAmmo: activeWeapon.logic.getReserveAmmo(now),
        isReloading: activeWeapon.logic.isReloading(now),
        reloadProgress: activeWeapon.logic.isReloading(now)
          ? 1 - (activeWeapon.logic.getReloadRemaining(now) / activeWeapon.logic.getReloadDuration())
          : 0,
        cooldownRemainingMs: activeWeapon.logic.getCooldownRemaining(now),
        cooldownDurationMs: activeWeapon.logic.getCooldownDuration(),
        playerHealth: this.state.playerLogic.state.health,
        playerMaxHealth: this.state.playerLogic.state.maxHealth,
        dummyHealth: this.state.dummyLogic.state.health,
        dummyMaxHealth: this.state.dummyLogic.state.maxHealth,
        gateOpen: this.state.gate?.open ?? false,
        lastEvent: this.state.lastCombatEvent,
        lastSoundCue: this.deps.getLastSoundCue(),
        movementMode: this.state.playerLogic.state.isSprinting ? "Sprint" : "Walk",
        movementBlocked,
        roundStartLabel: this.deps.getRoundStartStatus(now),
        ammoPickupLabel: this.deps.getPickupStatus(now),
        healthPickupLabel: this.deps.getHealthPickupStatus(now),
        coverVisionActive: this.state.activeDummyCoverIndex !== null && this.deps.getCoverEffectId(this.state.activeDummyCoverIndex) === "vision-jam",
        coverVisionX: coverVision.x,
        coverVisionY: coverVision.y,
        coverVisionRadius: coverVision.radius
      },
      isRoundStarting: this.deps.isRoundStarting(now),
      matchConfirmAtMs: this.deps.getMatchConfirmAtMs(),
      matchConfirmReadyCueSent: this.deps.getMatchConfirmReadyCueSent(),
      bossWave,
      progression: this.createHudProgressionSnapshot(),
      weaponUnlock: this.createHudWeaponUnlockSnapshot(now),
      areaPreview: this.createHudAreaPreviewSnapshot(),
      blastPreview: this.createHudBlastPreviewSnapshot(activeWeapon),
      wind: this.windState
    };
  }

  private readonly handleWindChanged = (event: CustomEvent<HudWindChangedDetail>): void => {
    this.windState = event.detail;
  };

  private createWeaponHudSlots(activeIndex: number, now = this.scene.time.now): readonly HudWeaponSlotSnapshot[] {
    return this.deps.weaponSlots.map((slot, index) => ({
      slot: index + 1,
      id: slot.id,
      label: slot.label,
      ammoInMagazine: slot.logic.getAmmoInMagazine(now),
      reserveAmmo: slot.logic.getReserveAmmo(now),
      isActive: index === activeIndex,
      isReloading: slot.logic.isReloading(now)
    }));
  }

  private createHudProgressionSnapshot(): HudProgressionSnapshot {
    const progressionState = this.deps.getProgressionState();

    return {
      visible: true,
      level: progressionState.level,
      xp: progressionState.xp,
      totalXp: progressionState.totalXp,
      xpToNextLevel: getXpRequiredForNextLevel(progressionState, this.deps.gameBalance.progression)
    };
  }

  private createHudWeaponUnlockSnapshot(now: number): HudWeaponUnlockSnapshot {
    const unlockState = this.deps.getUnlockState();
    const unlockedIds = new Set(unlockState.unlockedWeaponIds);
    const nextRule = [...this.deps.getUnlockRules()]
      .filter((rule) => !unlockedIds.has(rule.weaponId))
      .sort((left, right) => left.requiredLevel - right.requiredLevel)[0] ?? null;
    const newlyUnlockedWeaponIds = now <= this.deps.getUnlockNoticeUntilMs()
      ? this.deps.getNewlyUnlockedWeaponIds()
      : [];

    return {
      visible: true,
      unlockedWeaponIds: unlockState.unlockedWeaponIds,
      newlyUnlockedWeaponIds,
      nextUnlockWeaponId: nextRule?.weaponId ?? null,
      nextUnlockLevel: nextRule?.requiredLevel ?? null,
      noticeTitle: newlyUnlockedWeaponIds.length > 0 ? "Weapon unlocked" : "",
      noticeSubtitle: newlyUnlockedWeaponIds.length > 0
        ? newlyUnlockedWeaponIds.map((weaponId) => this.getWeaponLabel(weaponId)).join(", ")
        : ""
    };
  }

  private createHudAreaPreviewSnapshot(): HudAreaPreviewSnapshot {
    const currentStage = this.deps.getCurrentStage();

    return {
      visible: true,
      stageId: currentStage.id,
      stageLabel: currentStage.label,
      stageIndex: this.deps.getStageRotationState().currentIndex + 1,
      stageCount: this.deps.stageDefinitions.length,
      title: currentStage.label,
      subtitle: `${currentStage.blueSpawns.length} blue spawns, ${currentStage.redSpawns.length} red spawns, ${currentStage.obstacles.length} cover blocks`,
      stages: this.deps.stageDefinitions.map((stage) => ({
        id: stage.id,
        label: stage.label,
        details: `${stage.blueSpawns.length}/${stage.redSpawns.length} spawns, ${stage.obstacles.length} cover`
      }))
    };
  }

  private getWeaponLabel(weaponId: string): string {
    return this.deps.weaponSlots.find((slot) => slot.id === weaponId)?.label ?? weaponId;
  }

  private createHudBlastPreviewSnapshot(activeWeapon: PlayerWeaponSlot): HudBlastPreviewSnapshot {
    const projectile = activeWeapon.logic.getProjectileConfig();
    const radius = projectile.blastRadius ?? 0;

    return {
      visible: radius > 0 && this.deps.isCombatLive(this.scene.time.now),
      x: Phaser.Math.Clamp(this.scene.input.activePointer.worldX, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X),
      y: Phaser.Math.Clamp(this.scene.input.activePointer.worldY, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y),
      radius
    };
  }

  private getHudCoverVisionState(): { x: number; y: number; radius: number } {
    const designWidth = Number(this.scene.scale.gameSize.width) || 960;
    const designHeight = Number(this.scene.scale.gameSize.height) || 540;
    const displayWidth = this.scene.scale.displaySize.width > 0 ? this.scene.scale.displaySize.width : designWidth;
    const displayHeight = this.scene.scale.displaySize.height > 0 ? this.scene.scale.displaySize.height : designHeight;
    const widthRatio = displayWidth / designWidth;
    const heightRatio = displayHeight / designHeight;
    const radiusRatio = Math.min(widthRatio, heightRatio);

    return {
      x: (this.state.playerSprite?.x ?? 480) * widthRatio,
      y: (this.state.playerSprite?.y ?? 270) * heightRatio,
      radius: Math.max(10, COVER_VISION_RADIUS * radiusRatio)
    };
  }

  private resolveBossWaveOverlay() {
    return resolveBossWaveOverlay({
      roundNumber: this.deps.roundLogic.state.roundNumber,
      stage: this.deps.getCurrentStage(),
      bossWaveRules: this.deps.bossWaveRules,
      bossWavePlan: this.deps.getBossWavePlan()
    });
  }
}
