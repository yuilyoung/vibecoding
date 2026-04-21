import Phaser from "phaser";
import type { ProgressionState } from "../domain/progression/ProgressionLogic";
import type { UnlockState } from "../domain/progression/UnlockLogic";
import type { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import type { MatchFlowLogic } from "../domain/round/MatchFlowLogic";
import type { RoundLogic } from "../domain/round/RoundLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import { getPhaseLabel } from "../ui/hud-presenters";
import type { CombatController } from "./combat-controller";
import type { MatchFlowController } from "./match-flow-controller";
import type { MapObjectDebugSummary } from "./map-object-controller";
import { ACTOR_HALF_SIZE } from "./scene-constants";
import type { SceneRuntimeState } from "./scene-runtime-state";
import type { DebugTeamSelection, MainSceneDebugSnapshot, PlayerWeaponSlot } from "./scene-types";
import type { VfxController } from "./vfx-controller";
import type { MapObjectState } from "../domain/map/MapObjectLogic";

export interface DebugControllerDeps {
  readonly matchFlow: MatchFlowLogic;
  readonly roundLogic: RoundLogic;
  readonly runtimeState: SceneRuntimeState;
  readonly weaponInventory: WeaponInventoryLogic;
  readonly combatController: CombatController;
  readonly matchFlowController: MatchFlowController;
  readonly vfxController: VfxController;
  readonly getActiveWeaponSlot: () => PlayerWeaponSlot;
  readonly getCurrentStage: () => StageDefinition;
  readonly getProgressionState: () => ProgressionState;
  readonly getUnlockState: () => UnlockState;
  readonly getLastSpawnSummary: () => string;
  readonly getMapObjectDebugSummary: () => MapObjectDebugSummary;
  readonly getMapObjectStates: () => readonly MapObjectState[];
  readonly getProjectileSnapshot: () => readonly {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    owner: "player" | "dummy";
    trajectory: string;
  }[];
  readonly isRoundStarting: (now: number) => boolean;
  readonly getActorRotation: (angleRadians: number) => number;
  readonly applyGateToggle: () => void;
  readonly registerPlayerRoundWin: (now: number) => void;
  readonly updateMatchOverlay: (now: number) => void;
  readonly publishHudSnapshot: (now: number, movementBlocked: boolean) => void;
}

export class DebugController {
  public constructor(private readonly deps: DebugControllerDeps) {}

  public getDebugSnapshot(now: number): MainSceneDebugSnapshot {
    const activeWeapon = this.deps.getActiveWeaponSlot();
    const currentStage = this.deps.getCurrentStage();
    const progressionState = this.deps.getProgressionState();
    const unlockState = this.deps.getUnlockState();
    const playerSprite = this.requirePlayerSprite();

    return {
      phase: getPhaseLabel(this.deps.matchFlow.state.phase, this.deps.roundLogic.state.isMatchOver, this.deps.isRoundStarting(now)),
      team: this.deps.matchFlow.state.selectedTeam ?? "UNSET",
      stage: currentStage.id,
      stageLabel: currentStage.label,
      spawn: this.deps.getLastSpawnSummary(),
      activeWeapon: activeWeapon.label,
      weaponSlot: this.deps.weaponInventory.getActiveIndex() + 1,
      ammoInMagazine: activeWeapon.logic.getAmmoInMagazine(now),
      reserveAmmo: activeWeapon.logic.getReserveAmmo(now),
      playerHealth: this.deps.runtimeState.playerLogic.state.health,
      dummyHealth: this.deps.runtimeState.dummyLogic.state.health,
      gateOpen: this.deps.runtimeState.gate?.open ?? false,
      roundNumber: this.deps.roundLogic.state.roundNumber,
      playerScore: this.deps.roundLogic.state.playerScore,
      dummyScore: this.deps.roundLogic.state.dummyScore,
      progressionLevel: progressionState.level,
      progressionXp: progressionState.xp,
      unlockedWeaponIds: unlockState.unlockedWeaponIds,
      lastEvent: this.deps.runtimeState.lastCombatEvent,
      playerX: playerSprite.x,
      playerY: playerSprite.y,
      playerHullAngle: this.deps.runtimeState.playerBodyAngle,
      mapObjects: this.deps.getMapObjectDebugSummary()
    };
  }

  public getRuntimeStats(now: number): {
    bullets: number;
    activeAirStrikes: number;
    impactEffects: number;
    shotTrails: number;
    movementEffects: number;
  } {
    return {
      bullets: this.deps.runtimeState.bullets.length,
      activeAirStrikes: this.deps.runtimeState.activeAirStrikes.length,
      ...this.deps.vfxController.getRuntimeStats(now)
    };
  }

  public getMapObjectStates(): readonly MapObjectState[] {
    return this.deps.getMapObjectStates();
  }

  public getProjectileSnapshot(): readonly {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    owner: "player" | "dummy";
    trajectory: string;
  }[] {
    return this.deps.getProjectileSnapshot();
  }

  public debugEnterStage(): void {
    this.deps.matchFlowController.debugEnterStage();
  }

  public debugSelectTeam(team: DebugTeamSelection): void {
    this.deps.matchFlowController.debugSelectTeam(team);
  }

  public debugConfirmTeamSelection(now: number): void {
    this.deps.matchFlowController.debugConfirmTeamSelection(now);
  }

  public debugForceCombatLive(): void {
    this.deps.matchFlowController.debugForceCombatLive();
  }

  public debugSwapWeapon(now: number): void {
    this.deps.combatController.debugSwapWeapon(now);
  }

  public debugSelectWeaponSlot(slotNumber: number, now: number): void {
    this.deps.combatController.debugSelectWeaponSlot(slotNumber, now);
  }

  public debugFire(now: number): void {
    this.deps.combatController.debugFire(now);
  }

  public debugFireAt(targetX: number, targetY: number, now: number): void {
    this.deps.combatController.debugFireAt(targetX, targetY, now);
  }

  public debugMovePlayerTo(x: number, y: number): void {
    this.deps.runtimeState.playerLogic.state.positionX = x - ACTOR_HALF_SIZE;
    this.deps.runtimeState.playerLogic.state.positionY = y - ACTOR_HALF_SIZE;
    this.requirePlayerSprite().setPosition(x, y);
  }

  public debugSetPlayerHullAngle(angleRadians: number): void {
    this.deps.runtimeState.playerBodyAngle = Phaser.Math.Angle.Wrap(angleRadians);
    this.requirePlayerSprite().setRotation(this.deps.getActorRotation(this.deps.runtimeState.playerBodyAngle));
  }

  public debugSetPlayerAimAngle(angleRadians: number): void {
    this.deps.runtimeState.playerLogic.state.aimAngleRadians = Phaser.Math.Angle.Wrap(angleRadians);
  }

  public debugMoveDummyTo(x: number, y: number): void {
    this.deps.runtimeState.dummyLogic.state.positionX = x - ACTOR_HALF_SIZE;
    this.deps.runtimeState.dummyLogic.state.positionY = y - ACTOR_HALF_SIZE;
    this.requireTargetDummy().setPosition(x, y);
  }

  public debugToggleGate(): void {
    this.deps.applyGateToggle();
  }

  public debugForceMatchOver(winner: "PLAYER" | "DUMMY", now: number): void {
    this.deps.matchFlowController.debugForceMatchOver(winner, now);
  }

  public debugForceBossRound(now: number): void {
    this.deps.matchFlowController.debugForceBossRound();
    this.refreshDebugHud(now);
  }

  public debugRegisterPlayerRoundWin(now: number): void {
    this.deps.registerPlayerRoundWin(now);
    this.refreshDebugHud(now);
  }

  private refreshDebugHud(now: number): void {
    this.deps.updateMatchOverlay(now);
    this.deps.publishHudSnapshot(now, false);
  }

  private requirePlayerSprite(): Phaser.GameObjects.Image {
    if (this.deps.runtimeState.playerSprite === undefined) {
      throw new Error("DebugController requires playerSprite after scene creation.");
    }

    return this.deps.runtimeState.playerSprite;
  }

  private requireTargetDummy(): Phaser.GameObjects.Image {
    if (this.deps.runtimeState.targetDummy === undefined) {
      throw new Error("DebugController requires targetDummy after scene creation.");
    }

    return this.deps.runtimeState.targetDummy;
  }
}
