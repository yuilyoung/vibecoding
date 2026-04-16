import {
  advanceTutorial,
  createTutorialOverlayState
} from "../src/domain/tutorial/TutorialOverlayLogic";
import {
  buildTutorialOverlayRenderState,
  createTutorialOverlayController
} from "../src/ui/TutorialOverlay";

describe("TutorialOverlay", () => {
  it("builds visible and hidden render states from tutorial logic state", () => {
    const visibleState = buildTutorialOverlayRenderState(createTutorialOverlayState(false));
    const hiddenState = buildTutorialOverlayRenderState(createTutorialOverlayState(true));

    expect(visibleState.visible).toBe(true);
    expect(visibleState.ariaHidden).toBe("false");
    expect(visibleState.overlayClassName).toBe("tutorial-overlay is-open");
    expect(visibleState.panelClassName).toBe("tutorial-overlay-panel is-open");
    expect(visibleState.stepTitleText).toBe("Move");
    expect(visibleState.stepBodyText).toContain("WASD");
    expect(visibleState.stepText).toContain("Move:");
    expect(visibleState.stepCounterText).toBe("Step 1 of 5");

    expect(hiddenState.visible).toBe(false);
    expect(hiddenState.ariaHidden).toBe("true");
    expect(hiddenState.overlayClassName).toBe("tutorial-overlay is-hidden");
    expect(hiddenState.panelClassName).toBe("tutorial-overlay-panel is-hidden");
    expect(hiddenState.stepTitleText).toBe("Tutorial complete");
    expect(hiddenState.stepText).toBe("Tutorial complete.");
  });

  it("updates the current step text as tutorial progress advances", () => {
    const advancedState = advanceTutorial(createTutorialOverlayState(false), "moved").state;
    const renderState = buildTutorialOverlayRenderState(advancedState);

    expect(renderState.visible).toBe(true);
    expect(renderState.stepTitleText).toBe("Aim And Fire");
    expect(renderState.stepText).toContain("Aim with the mouse");
    expect(renderState.stepCounterText).toBe("Step 2 of 5");
  });

  it("wires skip, don't show again, and replay callbacks", () => {
    const onSkip = vi.fn();
    const onDontShowAgain = vi.fn();
    const onReplayTutorial = vi.fn();
    const controller = createTutorialOverlayController({
      onSkip,
      onDontShowAgain,
      onReplayTutorial
    });

    const renderState = controller.render(createTutorialOverlayState(false));

    expect(renderState.visible).toBe(true);

    controller.skip();
    controller.dontShowAgain();
    controller.replay();

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });
});
