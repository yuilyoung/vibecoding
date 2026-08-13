import { DEFAULT_SETTINGS, type SettingsState } from "../domain/settings/SettingsStorage";

export const SETTINGS_PANEL_CLASS_NAME = "settings-panel";
export const SETTINGS_PANEL_OPEN_CLASS_NAME = "is-open";
export const SETTINGS_PANEL_HIDDEN_CLASS_NAME = "is-hidden";

export const SETTINGS_PANEL_VOLUME_MIN = 0;
export const SETTINGS_PANEL_VOLUME_MAX = 1;
export const SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN = 0.1;
export const SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX = 5;

export type SettingsPanelField = "masterVolume" | "sfxVolume" | "mouseSensitivity";

export interface SettingsPanelState {
  readonly isOpen: boolean;
  readonly draft: SettingsState;
}

export interface SettingsPanelFieldRenderState {
  readonly value: number;
  readonly text: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SettingsPanelRenderState {
  readonly isOpen: boolean;
  readonly ariaHidden: "true" | "false";
  readonly overlayClassName: string;
  readonly panelClassName: string;
  readonly masterVolume: SettingsPanelFieldRenderState;
  readonly sfxVolume: SettingsPanelFieldRenderState;
  readonly mouseSensitivity: SettingsPanelFieldRenderState;
}

export interface SettingsPanelCallbacks {
  readonly onSave: (settings: SettingsState) => void;
  readonly onApply: (settings: SettingsState) => void;
  readonly onReplayTutorial: () => void;
}

export function createSettingsPanelState(
  draft: Partial<SettingsState> = DEFAULT_SETTINGS,
  isOpen = false
): SettingsPanelState {
  return {
    isOpen,
    draft: normalizeSettingsPanelDraft(draft)
  };
}

export function openSettingsPanel(
  state: SettingsPanelState,
  draft: Partial<SettingsState> = state.draft
): SettingsPanelState {
  return {
    isOpen: true,
    draft: normalizeSettingsPanelDraft(draft)
  };
}

export function closeSettingsPanel(state: SettingsPanelState): SettingsPanelState {
  return {
    ...state,
    isOpen: false
  };
}

export function updateSettingsPanelDraft(
  state: SettingsPanelState,
  patch: Partial<SettingsState>
): SettingsPanelState {
  return {
    ...state,
    draft: normalizeSettingsPanelDraft({
      ...state.draft,
      ...patch
    })
  };
}

export function setSettingsPanelSliderValue(
  state: SettingsPanelState,
  field: SettingsPanelField,
  rawValue: string
): SettingsPanelState {
  const currentValue = state.draft[field];
  const nextValue = parseSettingsSliderValue(rawValue, currentValue, getFieldMin(field), getFieldMax(field));

  return {
    ...state,
    draft: {
      ...state.draft,
      [field]: nextValue
    }
  };
}

export function buildSettingsPanelRenderState(state: SettingsPanelState): SettingsPanelRenderState {
  return {
    isOpen: state.isOpen,
    ariaHidden: state.isOpen ? "false" : "true",
    overlayClassName: composeClassName(
      SETTINGS_PANEL_CLASS_NAME,
      state.isOpen ? SETTINGS_PANEL_OPEN_CLASS_NAME : SETTINGS_PANEL_HIDDEN_CLASS_NAME
    ),
    panelClassName: composeClassName(
      "settings-panel-surface",
      state.isOpen ? SETTINGS_PANEL_OPEN_CLASS_NAME : SETTINGS_PANEL_HIDDEN_CLASS_NAME
    ),
    masterVolume: buildFieldRenderState(state.draft.masterVolume, SETTINGS_PANEL_VOLUME_MIN, SETTINGS_PANEL_VOLUME_MAX, formatVolumeText),
    sfxVolume: buildFieldRenderState(state.draft.sfxVolume, SETTINGS_PANEL_VOLUME_MIN, SETTINGS_PANEL_VOLUME_MAX, formatVolumeText),
    mouseSensitivity: buildFieldRenderState(
      state.draft.mouseSensitivity,
      SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN,
      SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX,
      formatSensitivityText
    )
  };
}

export function parseSettingsSliderValue(
  rawValue: string,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed)) {
    return clamp(fallback, min, max);
  }

  return clamp(parsed, min, max);
}

export function parseVolumeSliderValue(rawValue: string, fallback = DEFAULT_SETTINGS.masterVolume): number {
  return parseSettingsSliderValue(rawValue, fallback, SETTINGS_PANEL_VOLUME_MIN, SETTINGS_PANEL_VOLUME_MAX);
}

export function parseMouseSensitivitySliderValue(
  rawValue: string,
  fallback = DEFAULT_SETTINGS.mouseSensitivity
): number {
  return parseSettingsSliderValue(
    rawValue,
    fallback,
    SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN,
    SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX
  );
}

export function saveSettingsPanelDraft(
  state: SettingsPanelState,
  callbacks: SettingsPanelCallbacks
): SettingsState {
  const normalized = normalizeSettingsPanelDraft(state.draft);
  callbacks.onSave(normalized);
  return normalized;
}

export function applySettingsPanelDraft(
  state: SettingsPanelState,
  callbacks: SettingsPanelCallbacks
): SettingsState {
  const normalized = normalizeSettingsPanelDraft(state.draft);
  callbacks.onApply(normalized);
  return normalized;
}

export function replaySettingsTutorial(callbacks: Pick<SettingsPanelCallbacks, "onReplayTutorial">): void {
  callbacks.onReplayTutorial();
}

export function normalizeSettingsPanelDraft(draft: Partial<SettingsState>): SettingsState {
  return {
    masterVolume: parseSettingsSliderValue(
      String(draft.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
      DEFAULT_SETTINGS.masterVolume,
      SETTINGS_PANEL_VOLUME_MIN,
      SETTINGS_PANEL_VOLUME_MAX
    ),
    sfxVolume: parseSettingsSliderValue(
      String(draft.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
      DEFAULT_SETTINGS.sfxVolume,
      SETTINGS_PANEL_VOLUME_MIN,
      SETTINGS_PANEL_VOLUME_MAX
    ),
    mouseSensitivity: parseSettingsSliderValue(
      String(draft.mouseSensitivity ?? DEFAULT_SETTINGS.mouseSensitivity),
      DEFAULT_SETTINGS.mouseSensitivity,
      SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN,
      SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX
    ),
    tutorialDismissed: draft.tutorialDismissed === true
  };
}

function buildFieldRenderState(
  value: number,
  min: number,
  max: number,
  formatter: (value: number) => string
): SettingsPanelFieldRenderState {
  return {
    value: clamp(value, min, max),
    text: formatter(value),
    min,
    max,
    step: inferStep(min, max)
  };
}

function formatVolumeText(value: number): string {
  return `${Math.round(clamp(value, SETTINGS_PANEL_VOLUME_MIN, SETTINGS_PANEL_VOLUME_MAX) * 100)}%`;
}

function formatSensitivityText(value: number): string {
  return `${clamp(value, SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN, SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX).toFixed(2)}x`;
}

function getFieldMin(field: SettingsPanelField): number {
  switch (field) {
    case "masterVolume":
    case "sfxVolume":
      return SETTINGS_PANEL_VOLUME_MIN;
    case "mouseSensitivity":
      return SETTINGS_PANEL_MOUSE_SENSITIVITY_MIN;
    default:
      return SETTINGS_PANEL_VOLUME_MIN;
  }
}

function getFieldMax(field: SettingsPanelField): number {
  switch (field) {
    case "masterVolume":
    case "sfxVolume":
      return SETTINGS_PANEL_VOLUME_MAX;
    case "mouseSensitivity":
      return SETTINGS_PANEL_MOUSE_SENSITIVITY_MAX;
    default:
      return SETTINGS_PANEL_VOLUME_MAX;
  }
}

function inferStep(min: number, max: number): number {
  if (max <= 1) {
    return 0.01;
  }

  if (min >= 1) {
    return 0.1;
  }

  return 0.1;
}

function composeClassName(...classNames: readonly string[]): string {
  return classNames.filter((className) => className.length > 0).join(" ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
