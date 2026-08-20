import {
  advanceTutorial,
  createDeferredTutorialOverlayState,
  createTutorialOverlayState,
  dismissTutorial,
  getCurrentTutorialStep,
  revealTutorial,
  resetTutorial
} from "../src/domain/tutorial/TutorialOverlayLogic";

describe("TutorialOverlayLogic", () => {
  it("starts visible unless settings already dismissed the tutorial", () => {
    expect(createTutorialOverlayState(false).visible).toBe(true);
    expect(createTutorialOverlayState(true)).toEqual({
      visible: false,
      currentIndex: 0,
      completedStepIds: [],
      dismissed: true
    });
  });

  it("defers the first-run tutorial until product entry and never revives a dismissed tutorial", () => {
    const deferred = createDeferredTutorialOverlayState(false);
    expect(deferred).toMatchObject({ visible: false, dismissed: false });
    expect(revealTutorial(deferred)).toMatchObject({ visible: true, dismissed: false });

    const dismissed = createDeferredTutorialOverlayState(true);
    expect(revealTutorial(dismissed)).toBe(dismissed);
  });

  it("advances only when the expected signal arrives", () => {
    let state = createTutorialOverlayState(false);

    const ignored = advanceTutorial(state, "fired");
    expect(ignored.completedNow).toBeNull();
    expect(ignored.state.currentIndex).toBe(0);

    const advanced = advanceTutorial(state, "moved");
    state = advanced.state;

    expect(advanced.completedNow).toBe("movement");
    expect(getCurrentTutorialStep(state)?.id).toBe("aim-fire");
  });

  it("dismisses after the final tutorial step", () => {
    let state = createTutorialOverlayState(false);

    for (const signal of ["moved", "fired", "swapped-weapon", "collected-pickup", "leveled-up"] as const) {
      state = advanceTutorial(state, signal).state;
    }

    expect(state.visible).toBe(false);
    expect(state.dismissed).toBe(true);
    expect(state.completedStepIds).toEqual(["movement", "aim-fire", "weapon-swap", "pickup", "level-up"]);
  });

  it("supports explicit dismiss and reset", () => {
    expect(dismissTutorial(createTutorialOverlayState(false)).dismissed).toBe(true);
    expect(resetTutorial()).toEqual(createTutorialOverlayState(false));
  });
});
