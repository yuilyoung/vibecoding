import type { MatchFlowPhase, MatchFlowState, TeamId } from "../domain/round/MatchFlowLogic";
import type { RoundState } from "../domain/round/RoundLogic";
import type { BossWaveOverlayDecision } from "../domain/round/MatchFlowOrchestrator";
import type {
  HudAreaPreviewSnapshot,
  HudBlastPreviewSnapshot,
  HudOverlayState,
  HudProgressionSnapshot,
  HudSnapshot,
  HudWeaponSlotSnapshot,
  HudWeaponUnlockSnapshot
} from "./hud-events";

export interface HudCombatPresenterState {
  readonly selectedTeam: TeamId | null;
  readonly spawnSummary: string;
  readonly activeWeapon: string;
  readonly weaponSlot: number;
  readonly weaponSlots: readonly HudWeaponSlotSnapshot[];
  readonly ammoInMagazine: number;
  readonly reserveAmmo: number;
  readonly isReloading: boolean;
  readonly reloadProgress: number;
  readonly cooldownRemainingMs: number;
  readonly cooldownDurationMs: number;
  readonly playerHealth: number;
  readonly playerMaxHealth: number;
  readonly dummyHealth: number;
  readonly dummyMaxHealth: number;
  readonly gateOpen: boolean;
  readonly lastEvent: string;
  readonly lastSoundCue: string;
  readonly movementMode: string;
  readonly movementBlocked: boolean;
  readonly roundStartLabel: string;
  readonly ammoPickupLabel: string;
  readonly healthPickupLabel: string;
  readonly coverVisionActive: boolean;
  readonly coverVisionX: number;
  readonly coverVisionY: number;
  readonly coverVisionRadius: number;
}

export interface HudPresenterInput {
  readonly now: number;
  readonly matchFlow: MatchFlowState;
  readonly round: RoundState;
  readonly combat: HudCombatPresenterState;
  readonly isRoundStarting: boolean;
  readonly matchConfirmAtMs: number | null;
  readonly matchConfirmReadyCueSent: boolean;
  readonly progression?: HudProgressionSnapshot;
  readonly weaponUnlock?: HudWeaponUnlockSnapshot;
  readonly areaPreview?: HudAreaPreviewSnapshot;
  readonly blastPreview?: HudBlastPreviewSnapshot;
  readonly bossWave?: BossWaveOverlayDecision;
}

export interface MatchOverlayPresenterResult {
  readonly overlay: HudOverlayState;
  readonly shouldEmitMatchConfirmReadyCue: boolean;
  readonly shouldEnterMatchOver: boolean;
}

export function getPhaseLabel(matchPhase: MatchFlowPhase, isMatchOver: boolean, isRoundStarting: boolean): string {
  if (isMatchOver) {
    return "MATCH OVER";
  }

  if (matchPhase === "combat-live" && isRoundStarting) {
    return "ROUND START";
  }

  switch (matchPhase) {
    case "stage-entry":
      return "STAGE ENTRY";
    case "team-select":
      return "TEAM SELECT";
    case "deploying":
      return "DEPLOYING";
    case "combat-live":
      return "COMBAT LIVE";
    case "match-over":
      return "MATCH RESET";
    default:
      return "UNKNOWN";
  }
}

export function getPromptText(input: Pick<HudPresenterInput, "matchFlow" | "round" | "isRoundStarting" | "matchConfirmAtMs" | "now">): string {
  if (input.matchFlow.phase === "stage-entry") {
    return "Press Enter to enter the arena.";
  }

  if (input.matchFlow.phase === "team-select") {
    return "Choose a team with 1 or 2, then press Enter to deploy.";
  }

  if (input.matchFlow.phase === "deploying" || input.isRoundStarting) {
    return "Deployment live. Combat countdown in progress.";
  }

  if (input.round.isMatchOver) {
    return input.matchConfirmAtMs === null || input.now >= input.matchConfirmAtMs
      ? "Press Enter to queue the next match."
      : `Match reset unlock in ${Math.max(0, input.matchConfirmAtMs - input.now).toFixed(0)} ms.`;
  }

  return "WASD move. Mouse or F fire. R reload. E gate. Q or 1-6 swap weapons.";
}

export function buildMatchOverlayState(input: HudPresenterInput): MatchOverlayPresenterResult {
  if (!input.round.isMatchOver && input.bossWave?.visible === true) {
    return {
      overlay: {
        visible: true,
        title: input.bossWave.title,
        subtitle: input.bossWave.subtitle
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    };
  }

  if (input.matchFlow.phase === "stage-entry") {
    return {
      overlay: {
        visible: true,
        title: "ENTER STAGE",
        subtitle: "Press ENTER to open team selection."
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    };
  }

  if (input.matchFlow.phase === "team-select") {
    const selectedTeam = input.matchFlow.selectedTeam ?? "BLUE";
    return {
      overlay: {
        visible: true,
        title: `TEAM ${selectedTeam}`,
        subtitle: "Press 1 for BLUE or 2 for RED, then ENTER to deploy."
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    };
  }

  if (!input.round.isMatchOver && input.isRoundStarting) {
    return {
      overlay: {
        visible: true,
        title: `ROUND ${input.round.roundNumber}`,
        subtitle: `Deploy complete. Combat starts in ${input.combat.roundStartLabel} ms.`
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    };
  }

  if (!input.round.isMatchOver || input.matchConfirmAtMs === null) {
    return {
      overlay: {
        visible: false,
        title: "",
        subtitle: ""
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    };
  }

  const confirmReady = input.now >= input.matchConfirmAtMs && !input.matchConfirmReadyCueSent;
  const remainingMs = Math.max(0, input.matchConfirmAtMs - input.now).toFixed(0);
  const confirmText = input.now >= input.matchConfirmAtMs
    ? "Press ENTER to start the next match."
    : `Confirm unlock in ${remainingMs} ms`;

  return {
    overlay: {
      visible: true,
      title: `${input.round.matchWinner ?? "MATCH"} VICTORY`,
      subtitle: `${confirmText} Team selection will reopen for the next match.`
    },
    shouldEmitMatchConfirmReadyCue: confirmReady,
    shouldEnterMatchOver: confirmReady
  };
}

export function buildHudSnapshot(input: HudPresenterInput, overlay: HudOverlayState): HudSnapshot {
  return {
    phase: getPhaseLabel(input.matchFlow.phase, input.round.isMatchOver, input.isRoundStarting),
    team: input.matchFlow.selectedTeam ?? "UNSET",
    spawn: input.combat.spawnSummary,
    activeWeapon: input.combat.activeWeapon,
    weaponSlot: input.combat.weaponSlot,
    weaponSlots: input.combat.weaponSlots,
    ammoInMagazine: input.combat.ammoInMagazine,
    reserveAmmo: input.combat.reserveAmmo,
    isReloading: input.combat.isReloading,
    reloadProgress: input.combat.reloadProgress,
    cooldownRemainingMs: input.combat.cooldownRemainingMs,
    cooldownDurationMs: input.combat.cooldownDurationMs,
    playerHealth: input.combat.playerHealth,
    playerMaxHealth: input.combat.playerMaxHealth,
    dummyHealth: input.combat.dummyHealth,
    dummyMaxHealth: input.combat.dummyMaxHealth,
    gateOpen: input.combat.gateOpen,
    roundNumber: input.round.roundNumber,
    playerScore: input.round.playerScore,
    dummyScore: input.round.dummyScore,
    scoreToWin: input.round.scoreToWin,
    lastEvent: input.combat.lastEvent,
    lastSoundCue: input.combat.lastSoundCue,
    movementMode: input.combat.movementMode,
    movementBlocked: input.combat.movementBlocked,
    roundStartLabel: input.combat.roundStartLabel,
    ammoPickupLabel: input.combat.ammoPickupLabel,
    healthPickupLabel: input.combat.healthPickupLabel,
    coverVisionActive: input.combat.coverVisionActive,
    coverVisionX: input.combat.coverVisionX,
    coverVisionY: input.combat.coverVisionY,
    coverVisionRadius: input.combat.coverVisionRadius,
    progression: input.progression,
    weaponUnlock: input.weaponUnlock,
    areaPreview: input.areaPreview,
    blastPreview: input.blastPreview,
    overlay: {
      ...overlay,
      subtitle: overlay.subtitle || getPromptText(input)
    }
  };
}
