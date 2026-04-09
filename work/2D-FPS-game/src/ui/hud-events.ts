export const HUD_SNAPSHOT_EVENT = "fps-hud-snapshot";

export interface HudOverlayState {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
}

export interface HudSnapshot {
  readonly phase: string;
  readonly team: string;
  readonly spawn: string;
  readonly activeWeapon: string;
  readonly weaponSlot: number;
  readonly ammoInMagazine: number;
  readonly reserveAmmo: number;
  readonly isReloading: boolean;
  readonly reloadProgress: number;
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
  readonly overlay: HudOverlayState;
}
