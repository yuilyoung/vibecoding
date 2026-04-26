export const HUD_SNAPSHOT_EVENT = "fps-hud-snapshot";
export const WIND_CHANGED_EVENT = "fps-hud-wind-changed";
export const WEATHER_CHANGED_EVENT = "fps-hud-weather-changed";

export interface HudWindChangedDetail {
  readonly angleDegrees: number;
  readonly strength: number;
}

export interface HudWindPipSnapshot {
  readonly index: number;
  readonly active: boolean;
  readonly color: string;
}

export interface HudWindSnapshot extends HudWindChangedDetail {
  readonly visible: boolean;
  readonly arrowSizePx: number;
  readonly pips: readonly HudWindPipSnapshot[];
}

export interface HudWeatherChangedDetail {
  readonly type: "clear" | "rain" | "fog" | "sandstorm" | "storm";
  readonly movementMultiplier: number;
  readonly visionRange: number;
  readonly windStrengthMultiplier: number;
  readonly minesDisabled: boolean;
  readonly soundResetReason?: "MATCH_RESET";
}

export interface HudWeatherSnapshot extends HudWeatherChangedDetail {
  readonly visible: boolean;
  readonly label: string;
  readonly icon: string;
}

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
  readonly wind?: HudWindSnapshot;
  readonly weather?: HudWeatherSnapshot;
  readonly overlay: HudOverlayState;
}

let latestHudWind: HudWindChangedDetail = {
  angleDegrees: 0,
  strength: 0
};

let latestHudWeather: HudWeatherChangedDetail = {
  type: "clear",
  movementMultiplier: 1,
  visionRange: 9999,
  windStrengthMultiplier: 1,
  minesDisabled: false
};

export function publishWindChanged(detail: HudWindChangedDetail): void {
  latestHudWind = sanitizeHudWindChangedDetail(detail);
  window.dispatchEvent(new CustomEvent< HudWindChangedDetail>(WIND_CHANGED_EVENT, {
    detail: latestHudWind
  }));
}

export function readLatestHudWind(): HudWindChangedDetail {
  return latestHudWind;
}

export function publishWeatherChanged(detail: HudWeatherChangedDetail): void {
  latestHudWeather = sanitizeHudWeatherChangedDetail(detail);
  window.dispatchEvent(new CustomEvent<HudWeatherChangedDetail>(WEATHER_CHANGED_EVENT, {
    detail: latestHudWeather
  }));
}

export function readLatestHudWeather(): HudWeatherChangedDetail {
  return latestHudWeather;
}

function sanitizeHudWindChangedDetail(detail: HudWindChangedDetail): HudWindChangedDetail {
  const angleDegrees = Number.isFinite(detail.angleDegrees) ? detail.angleDegrees : 0;
  const strength = Number.isFinite(detail.strength) ? Math.max(0, Math.min(3, detail.strength)) : 0;

  return {
    angleDegrees,
    strength
  };
}

function sanitizeHudWeatherChangedDetail(detail: HudWeatherChangedDetail): HudWeatherChangedDetail {
  return {
    type: isHudWeatherType(detail.type) ? detail.type : "clear",
    movementMultiplier: Number.isFinite(detail.movementMultiplier) ? Math.max(0, detail.movementMultiplier) : 1,
    visionRange: Number.isFinite(detail.visionRange) ? Math.max(0, detail.visionRange) : 9999,
    windStrengthMultiplier: Number.isFinite(detail.windStrengthMultiplier) ? Math.max(0, detail.windStrengthMultiplier) : 1,
    minesDisabled: Boolean(detail.minesDisabled),
    soundResetReason: detail.soundResetReason === "MATCH_RESET" ? "MATCH_RESET" : undefined
  };
}

function isHudWeatherType(value: string): value is HudWeatherChangedDetail["type"] {
  return value === "clear" || value === "rain" || value === "fog" || value === "sandstorm" || value === "storm";
}
