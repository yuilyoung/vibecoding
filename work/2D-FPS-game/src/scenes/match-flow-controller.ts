import { awardKillXp, awardRoundClearXp, addXp, type ProgressionState } from "../domain/progression/ProgressionLogic";
import { getNewlyUnlockedWeaponIds, createUnlockState, type UnlockState, type WeaponUnlockRule } from "../domain/progression/UnlockLogic";
import type { ProgressionStorageAdapter } from "../domain/progression/ProgressionStorage";
import type { StageContentSpawnPlan } from "../domain/map/StageContentSpawner";
import type { StageDefinitionWithContent } from "../domain/map/StageContentDefinition";
import { selectNextStage, type StageRotationState } from "../domain/map/StageRotationLogic";
import type { StageDefinition } from "../domain/map/StageDefinition";
import { createDeploymentViewState } from "../domain/round/DeploymentRuntime";
import { MatchFlowLogic, type SpawnAssignment, type TeamId } from "../domain/round/MatchFlowLogic";
import { planRoundReset, resolveBossWaveOverlay, resolveStageFlow } from "../domain/round/MatchFlowOrchestrator";
import type { RoundLogic } from "../domain/round/RoundLogic";
import { createBossSpawn, type BossWaveRules, type BossWaveSpawnPlan } from "../domain/round/BossWaveLogic";
import type { WeaponInventoryLogic } from "../domain/combat/WeaponInventoryLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { GameBalance, PlayerWeaponSlot, TeamSpawnTable } from "./scene-types";
import { ACTOR_HALF_SIZE, RESPAWN_DELAY_MS, RESPAWN_FX_MS, UNLOCK_NOTICE_DURATION_MS } from "./scene-constants";
import { getRespawnFxState } from "../ui/scene-visuals";
import type { SoundCueEvent } from "../domain/audio/SoundCueLogic";

export interface MatchFlowStageInput {
  confirmPressed: boolean;
  selectBluePressed: boolean;
  selectRedPressed: boolean;
}

export interface MatchFlowControllerState {
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

export interface MatchFlowControllerDeps {
  readonly matchFlow: MatchFlowLogic;
  readonly roundLogic: RoundLogic;
  readonly playerLogic: PlayerLogic;
  readonly dummyLogic: PlayerLogic;
  readonly weaponSlots: readonly PlayerWeaponSlot[];
  readonly dummyWeaponSlots: readonly PlayerWeaponSlot[];
  readonly weaponInventory: WeaponInventoryLogic;
  readonly stageDefinitions: readonly StageDefinition[];
  readonly stageContentSpawner: { spawn(stage: StageDefinitionWithContent): StageContentSpawnPlan };
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
  readonly setLastDummyDecision: (decision: "chase" | "strafe" | "retreat" | "hold-cover" | "avoid-hazard") => void;
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
}

export class MatchFlowController {
  public constructor(private readonly deps: MatchFlowControllerDeps) {}

  public rotateStageForNextMatch(): void {
    const state = this.deps.getState();
    const result = selectNextStage(this.deps.stageDefinitions, state.stageRotationState);
    state.stageRotationState = result.state;
    state.currentStage = result.stage;
    state.bossWavePlan = createBossSpawn(state.currentStage, this.deps.bossWaveRules);
    state.activeStageContentPlan = this.deps.stageContentSpawner.spawn(state.currentStage as StageDefinitionWithContent);
    state.spawnTable = this.createSpawnTableFromStage(state.currentStage);
    this.deps.applyStageGeometry();
    this.deps.applyStageContentToRuntime();
  }

  public registerPlayerRoundWin(now: number): void {
    const state = this.deps.getState();
    const previousPlayerScore = this.deps.roundLogic.state.playerScore;
    const previousUnlockState = state.unlockState;
    const bossWaveReward = resolveBossWaveOverlay({
      roundNumber: this.deps.roundLogic.state.roundNumber,
      stage: state.currentStage,
      bossWaveRules: this.deps.bossWaveRules,
      bossWavePlan: state.bossWavePlan
    }).visible ? state.bossWavePlan?.reward ?? null : null;

    this.deps.roundLogic.registerPlayerWin();

    if (this.deps.roundLogic.state.playerScore === previousPlayerScore) {
      return;
    }

    const killGain = awardKillXp(state.progressionState, this.deps.gameBalance.progression);
    const clearGain = awardRoundClearXp(killGain.state, this.deps.gameBalance.progression);
    const bossGain = bossWaveReward === null
      ? { state: clearGain.state, leveledUp: false }
      : addXp(clearGain.state, bossWaveReward.experience, this.deps.gameBalance.progression);
    state.progressionState = bossGain.state;

    const levelUnlockState = createUnlockState(state.progressionState, this.deps.unlockRules, this.deps.defaultWeaponIds);
    const rewardUnlockWeaponId = bossWaveReward?.unlockWeaponId ?? null;
    const unlockedWeaponIds = rewardUnlockWeaponId === null || levelUnlockState.unlockedWeaponIds.includes(rewardUnlockWeaponId)
      ? levelUnlockState.unlockedWeaponIds
      : [...levelUnlockState.unlockedWeaponIds, rewardUnlockWeaponId];
    state.unlockState = { unlockedWeaponIds };
    state.newlyUnlockedWeaponIds = getNewlyUnlockedWeaponIds(previousUnlockState, state.unlockState);

    if (bossWaveReward !== null) {
      this.deps.setLastCombatEvent(bossWaveReward.label.toUpperCase());
    }

    if (killGain.leveledUp || clearGain.leveledUp || bossGain.leveledUp || state.newlyUnlockedWeaponIds.length > 0) {
      state.unlockNoticeUntilMs = now + UNLOCK_NOTICE_DURATION_MS;
    }

    this.deps.progressionStorage.save(state.progressionState);
  }

  public registerDummyRoundWin(): void {
    this.deps.roundLogic.registerDummyWin();
  }

  public debugEnterStage(): void {
    if (this.deps.matchFlow.state.phase !== "stage-entry") {
      return;
    }

    this.deps.matchFlow.enterStage();
    this.deps.matchFlow.previewTeam("BLUE");
    this.deps.setLastCombatEvent("SELECT TEAM: 1 BLUE / 2 RED");
  }

  public debugSelectTeam(team: TeamId): void {
    if (this.deps.matchFlow.state.phase !== "team-select") {
      return;
    }

    this.deps.matchFlow.previewTeam(team);
    this.deps.setLastCombatEvent(`TEAM PREVIEW ${team}`);
  }

  public debugConfirmTeamSelection(now: number): void {
    if (this.deps.matchFlow.state.phase !== "team-select" || this.deps.matchFlow.state.selectedTeam === null) {
      return;
    }

    const state = this.deps.getState();
    this.applySpawnAssignment(this.deps.matchFlow.confirmTeamSelection(state.spawnTable));
    state.roundStartUntilMs = now + this.deps.gameBalance.roundStartDelayMs;
    state.respawnFxUntilMs = now + RESPAWN_FX_MS;
    this.deps.setLastCombatEvent(`DEPLOYING ${this.deps.matchFlow.state.selectedTeam}`);
  }

  public debugForceCombatLive(): void {
    if (this.deps.matchFlow.state.phase !== "deploying") {
      return;
    }

    this.deps.getState().roundStartUntilMs = 0;
    this.deps.matchFlow.startCombat();
    this.deps.emitSoundCue({ kind: "match-start" });
    this.deps.setLastCombatEvent("COMBAT LIVE");
  }

  public debugForceMatchOver(winner: "PLAYER" | "DUMMY", now: number): void {
    this.deps.roundLogic.state.playerScore = winner === "PLAYER" ? this.deps.roundLogic.state.scoreToWin : Math.max(0, this.deps.roundLogic.state.scoreToWin - 1);
    this.deps.roundLogic.state.dummyScore = winner === "DUMMY" ? this.deps.roundLogic.state.scoreToWin : Math.max(0, this.deps.roundLogic.state.scoreToWin - 1);
    this.deps.roundLogic.state.matchWinner = winner;
    this.deps.roundLogic.state.isMatchOver = true;
    this.deps.roundLogic.state.lastResult = `${winner} WON MATCH`;
    this.deps.matchFlow.enterMatchOver();
    this.deps.getState().matchConfirmAtMs = now;
    this.deps.setLastCombatEvent(`${winner} LOCKED`);
  }

  public debugForceBossRound(): void {
    const state = this.deps.getState();
    this.deps.roundLogic.state.roundNumber = state.bossWavePlan?.firstBossRound ?? this.deps.bossWaveRules.firstBossRound ?? this.deps.bossWaveRules.intervalRounds;
    this.deps.setLastCombatEvent("BOSS WAVE DEBUG");
  }

  public handleStageFlow(now: number): void {
    const input = this.deps.getStageInput();
    if (input === null) {
      return;
    }

    const state = this.deps.getState();
    const decision = resolveStageFlow({
      phase: this.deps.matchFlow.state.phase,
      selectedTeam: this.deps.matchFlow.state.selectedTeam,
      confirmPressed: input.confirmPressed,
      selectBluePressed: input.selectBluePressed,
      selectRedPressed: input.selectRedPressed,
      roundStarting: this.isRoundStarting(now)
    });

    if (decision.enterStage) {
      this.deps.matchFlow.enterStage();
    }

    if (decision.previewTeam !== null) {
      this.deps.matchFlow.previewTeam(decision.previewTeam);
    }

    if (decision.confirmDeployment) {
      this.applySpawnAssignment(this.deps.matchFlow.confirmTeamSelection(state.spawnTable));
      state.roundStartUntilMs = now + this.deps.gameBalance.roundStartDelayMs;
      state.respawnFxUntilMs = now + RESPAWN_FX_MS;
    }

    if (decision.startCombat) {
      this.deps.matchFlow.startCombat();
      this.deps.emitSoundCue({ kind: "match-start" });
    }

    if (decision.combatEvent !== null) {
      this.deps.setLastCombatEvent(decision.combatEvent);
    }
  }

  public applySpawnAssignment(assignment: SpawnAssignment): void {
    const deployment = createDeploymentViewState(assignment);
    this.deps.playerLogic.reset(assignment.playerSpawn.x - ACTOR_HALF_SIZE, assignment.playerSpawn.y - ACTOR_HALF_SIZE);
    this.deps.dummyLogic.reset(assignment.dummySpawn.x - ACTOR_HALF_SIZE, assignment.dummySpawn.y - ACTOR_HALF_SIZE);
    this.deps.applyTeamVisuals(assignment.playerTeam, assignment.dummyTeam);
    this.deps.setCurrentDummyWeaponId("carbine");
    this.deps.setLastDummyIntentKey("chase:false");
    this.deps.setLastActiveWeaponReloading(false);
    this.deps.setPlayerBodyAngle(deployment.playerRotation);
    this.deps.setDummyBodyAngle(deployment.dummyRotation);
    this.deps.setPlayerSpriteDeployment(deployment.playerPositionX, deployment.playerPositionY, this.deps.getActorRotation(deployment.playerRotation));
    this.deps.setDummySpriteDeployment(deployment.dummyPositionX, deployment.dummyPositionY, this.deps.getActorRotation(deployment.dummyRotation));
    this.deps.getState().lastSpawnSummary = deployment.spawnSummary;
    this.deps.clearBullets();
    this.deps.resetPickupState();
    this.deps.applyGateDeployment(deployment.gateOpen);
  }

  public handleRoundReset(now: number): void {
    const state = this.deps.getState();
    if (state.roundResetAtMs === null || now < state.roundResetAtMs) {
      return;
    }

    this.resetRoundState(now);
    state.roundResetAtMs = null;
    this.deps.setLastCombatEvent("REDEPLOYED");
  }

  public handleMatchConfirm(now: number): void {
    const state = this.deps.getState();
    if (state.matchConfirmAtMs === null) {
      return;
    }

    if (now < state.matchConfirmAtMs) {
      return;
    }

    if (!this.deps.isConfirmDown()) {
      return;
    }

    this.deps.emitSoundCue({ kind: "match-confirm", action: "accept" });
    this.deps.roundLogic.resetMatch();
    this.deps.matchFlow.prepareNextMatch();
    this.rotateStageForNextMatch();
    state.lastSpawnSummary = "WAITING";
    state.roundStartUntilMs = 0;
    this.deps.clearBullets();
    this.deps.resetPickupState();
    state.matchConfirmAtMs = null;
    state.roundResetAtMs = null;
    this.deps.setLastCombatEvent("SELECT TEAM FOR NEXT MATCH");
  }

  public scheduleResetAfterRound(now: number): void {
    const state = this.deps.getState();
    const plan = planRoundReset({
      isMatchOver: this.deps.roundLogic.state.isMatchOver,
      matchWinner: this.deps.roundLogic.state.matchWinner,
      now,
      matchResetDelayMs: this.deps.gameBalance.matchResetDelayMs,
      respawnDelayMs: RESPAWN_DELAY_MS
    });

    if (plan.clearBullets) {
      this.deps.clearBullets();
    }

    state.matchConfirmReadyCueSent = plan.matchConfirmReadyCueSent;
    state.matchConfirmAtMs = plan.matchConfirmAtMs;

    if (plan.roundResetAtMs !== null && state.roundResetAtMs === null) {
      state.roundResetAtMs = plan.roundResetAtMs;
    } else if (plan.roundResetAtMs === null) {
      state.roundResetAtMs = null;
    }

    if (plan.combatEvent !== null) {
      this.deps.setLastCombatEvent(plan.combatEvent);
    }
  }

  public resetRoundState(now: number): void {
    const state = this.deps.getState();
    for (const slot of this.deps.weaponSlots) {
      slot.logic.reset();
    }
    this.deps.weaponInventory.reset();
    for (const slot of this.deps.dummyWeaponSlots) {
      slot.logic.reset();
    }
    this.deps.setCurrentDummyWeaponId("carbine");
    this.deps.resetHazardState();
    this.applySpawnAssignment(this.deps.matchFlow.redeploy(state.spawnTable));
    state.roundStartUntilMs = now + this.deps.gameBalance.roundStartDelayMs;
    state.respawnFxUntilMs = now + RESPAWN_FX_MS;
    state.matchConfirmReadyCueSent = false;
    this.deps.resetActorVisuals();
    this.deps.setLastDummyDecision("chase");
    this.deps.setLastDummyShouldFire(false);
    this.deps.setLastDummyIntentKey("chase:false");
    this.deps.setLastActiveWeaponReloading(false);
    this.deps.setLastDummySteerX(1);
    this.deps.setLastDummySteerY(0);
    this.deps.setDummySteerLockUntilMs(0);
  }

  public getMatchConfirmStatus(now: number): string {
    const matchConfirmAtMs = this.deps.getState().matchConfirmAtMs;
    if (matchConfirmAtMs === null) {
      return "READY";
    }

    if (now >= matchConfirmAtMs) {
      return "ENTER";
    }

    return Math.max(0, matchConfirmAtMs - now).toFixed(0);
  }

  public getRoundStartStatus(now: number): string {
    if (!this.isRoundStarting(now)) {
      return "LIVE";
    }

    return Math.max(0, this.deps.getState().roundStartUntilMs - now).toFixed(0);
  }

  public isRoundStarting(now: number): boolean {
    return !this.deps.roundLogic.state.isMatchOver && now < this.deps.getState().roundStartUntilMs;
  }

  public getRespawnFxStatus(now: number): string {
    const respawnFxUntilMs = this.deps.getState().respawnFxUntilMs;
    if (now >= respawnFxUntilMs) {
      return "READY";
    }

    return Math.max(0, respawnFxUntilMs - now).toFixed(0);
  }

  public getRespawnFxState(now: number) {
    return getRespawnFxState(now, this.deps.getState().respawnFxUntilMs, RESPAWN_FX_MS);
  }

  private createSpawnTableFromStage(stage: StageDefinition): TeamSpawnTable {
    return {
      BLUE: stage.blueSpawns,
      RED: stage.redSpawns
    };
  }
}
