export const HUD_SNAPSHOT_EVENT = "fps-hud-snapshot";

export interface HudOverlayState {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
}

export interface HudProgressionSnapshot {
  readonly visible: boolean;
  readonly level: number;
  readonly xp: number;
  readonly totalXp: number;
  readonly xpToNextLevel: number | null;
}

export interface HudWeaponUnlockSnapshot {
  readonly visible: boolean;
  readonly unlockedWeaponIds: readonly string[];
  readonly newlyUnlockedWeaponIds: readonly string[];
  readonly nextUnlockWeaponId: string | null;
  readonly nextUnlockLevel: number | null;
  readonly noticeTitle: string;
  readonly noticeSubtitle: string;
}

export interface HudAreaPreviewStageSnapshot {
  readonly id: string;
  readonly label: string;
  readonly details: string;
}

export interface HudAreaPreviewSnapshot {
  readonly visible: boolean;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly stageIndex: number;
  readonly stageCount: number;
  readonly title: string;
  readonly subtitle: string;
  readonly stages: readonly HudAreaPreviewStageSnapshot[];
}

export interface HudBlastPreviewSnapshot {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface HudWeaponSlotSnapshot {
  readonly slot: number;
  readonly id: string;
  readonly label: string;
  readonly ammoInMagazine: number;
  readonly reserveAmmo: number;
  readonly isActive: boolean;
  readonly isReloading: boolean;
}

export interface HudSnapshot {
  readonly phase: string;
  readonly team: string;
  readonly spawn: string;
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
  readonly roundNumber: number;
  readonly playerScore: number;
  readonly dummyScore: number;
  readonly scoreToWin: number;
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
  readonly progression?: HudProgressionSnapshot;
  readonly weaponUnlock?: HudWeaponUnlockSnapshot;
  readonly areaPreview?: HudAreaPreviewSnapshot;
  readonly blastPreview?: HudBlastPreviewSnapshot;
  readonly overlay: HudOverlayState;
}
