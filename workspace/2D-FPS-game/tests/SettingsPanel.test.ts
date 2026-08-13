import {
  applySettingsPanelDraft,
  buildSettingsPanelRenderState,
  closeSettingsPanel,
  createSettingsPanelState,
  openSettingsPanel,
  parseMouseSensitivitySliderValue,
  parseSettingsSliderValue,
  parseVolumeSliderValue,
  replaySettingsTutorial,
  saveSettingsPanelDraft,
  setSettingsPanelSliderValue,
  type SettingsPanelCallbacks,
  type SettingsPanelState
} from "../src/ui/SettingsPanel";

describe("SettingsPanel", () => {
  it("opens, closes, and renders a predictable overlay state", () => {
    const closed = createSettingsPanelState();
    const opened = openSettingsPanel(closed, {
      masterVolume: 0.75,
      sfxVolume: 0.25,
      mouseSensitivity: 2.5
    });
    const renderState = buildSettingsPanelRenderState(opened);

    expect(closed.isOpen).toBe(false);
    expect(opened.isOpen).toBe(true);
    expect(closeSettingsPanel(opened).isOpen).toBe(false);
    expect(renderState.ariaHidden).toBe("false");
    expect(renderState.overlayClassName).toBe("settings-panel is-open");
    expect(renderState.masterVolume.value).toBe(0.75);
    expect(renderState.masterVolume.text).toBe("75%");
    expect(renderState.mouseSensitivity.text).toBe("2.50x");
  });

  it("parses slider values with clamping and fallback behavior", () => {
    expect(parseSettingsSliderValue("0.42", 1, 0, 1)).toBe(0.42);
    expect(parseSettingsSliderValue("9", 1, 0, 1)).toBe(1);
    expect(parseSettingsSliderValue("-4", 1, 0, 1)).toBe(0);
    expect(parseSettingsSliderValue("bad", 0.33, 0, 1)).toBe(0.33);

    expect(parseVolumeSliderValue("1.4")).toBe(1);
    expect(parseVolumeSliderValue("not-a-number", 0.2)).toBe(0.2);
    expect(parseMouseSensitivitySliderValue("6.5")).toBe(5);
    expect(parseMouseSensitivitySliderValue("0.02")).toBe(0.1);
  });

  it("updates only the selected slider field and keeps the others intact", () => {
    const initial = createSettingsPanelState({
      masterVolume: 0.5,
      sfxVolume: 0.2,
      mouseSensitivity: 1.5
    });
    const next = setSettingsPanelSliderValue(initial, "sfxVolume", "0.9");

    expect(next.draft).toEqual({
      masterVolume: 0.5,
      sfxVolume: 0.9,
      mouseSensitivity: 1.5,
      tutorialDismissed: false
    });
    expect(setSettingsPanelSliderValue(next, "mouseSensitivity", "99").draft.mouseSensitivity).toBe(5);
  });

  it("invokes save, apply, and tutorial replay callbacks with normalized payloads", () => {
    const saved: SettingsPanelState["draft"][] = [];
    const applied: SettingsPanelState["draft"][] = [];
    let replayCount = 0;
    const callbacks: SettingsPanelCallbacks = {
      onSave(settings) {
        saved.push(settings);
      },
      onApply(settings) {
        applied.push(settings);
      },
      onReplayTutorial() {
        replayCount += 1;
      }
    };
    const state = {
      isOpen: true,
      draft: {
        masterVolume: 9,
        sfxVolume: -1,
        mouseSensitivity: 0.02,
        tutorialDismissed: true
      }
    } as SettingsPanelState;

    expect(saveSettingsPanelDraft(state, callbacks)).toEqual({
      masterVolume: 1,
      sfxVolume: 0,
      mouseSensitivity: 0.1,
      tutorialDismissed: true
    });
    expect(applySettingsPanelDraft(state, callbacks)).toEqual({
      masterVolume: 1,
      sfxVolume: 0,
      mouseSensitivity: 0.1,
      tutorialDismissed: true
    });
    replaySettingsTutorial(callbacks);

    expect(saved).toEqual([
      {
        masterVolume: 1,
        sfxVolume: 0,
        mouseSensitivity: 0.1,
        tutorialDismissed: true
      }
    ]);
    expect(applied).toEqual([
      {
        masterVolume: 1,
        sfxVolume: 0,
        mouseSensitivity: 0.1,
        tutorialDismissed: true
      }
    ]);
    expect(replayCount).toBe(1);
  });
});
