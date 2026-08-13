import {
  DEFAULT_TUTORIAL_STEPS,
  getCurrentTutorialStep,
  type TutorialOverlayState,
  type TutorialStep
} from "../domain/tutorial/TutorialOverlayLogic";

export const TUTORIAL_OVERLAY_CLASS_NAME = "tutorial-overlay";
export const TUTORIAL_OVERLAY_OPEN_CLASS_NAME = "is-open";
export const TUTORIAL_OVERLAY_HIDDEN_CLASS_NAME = "is-hidden";

export interface TutorialOverlayRenderState {
  readonly visible: boolean;
  readonly ariaHidden: "true" | "false";
  readonly overlayClassName: string;
  readonly panelClassName: string;
  readonly stepTitleText: string;
  readonly stepBodyText: string;
  readonly stepText: string;
  readonly stepCounterText: string;
  readonly actionSummaryText: string;
}

export interface TutorialOverlayCallbacks {
  readonly onSkip: () => void;
  readonly onDontShowAgain: () => void;
  readonly onReplayTutorial: () => void;
}

export interface TutorialOverlayController {
  readonly state: TutorialOverlayRenderState;
  render: (state: TutorialOverlayState, steps?: readonly TutorialStep[]) => TutorialOverlayRenderState;
  skip: () => void;
  dontShowAgain: () => void;
  replay: () => void;
}

const DEFAULT_ACTION_SUMMARY_TEXT = "Skip, hide this tutorial, or replay it from settings.";

export function buildTutorialOverlayRenderState(
  state: TutorialOverlayState,
  steps: readonly TutorialStep[] = DEFAULT_TUTORIAL_STEPS
): TutorialOverlayRenderState {
  const currentStep = getCurrentTutorialStep(state, steps);
  const totalSteps = steps.length;
  const completedSteps = Math.min(state.completedStepIds.length, totalSteps);
  const hasCurrentStep = currentStep !== null;
  const visible = Boolean(state.visible && !state.dismissed && hasCurrentStep);

  return {
    visible,
    ariaHidden: visible ? "false" : "true",
    overlayClassName: composeClassName(
      TUTORIAL_OVERLAY_CLASS_NAME,
      visible ? TUTORIAL_OVERLAY_OPEN_CLASS_NAME : TUTORIAL_OVERLAY_HIDDEN_CLASS_NAME
    ),
    panelClassName: composeClassName(
      "tutorial-overlay-panel",
      visible ? TUTORIAL_OVERLAY_OPEN_CLASS_NAME : TUTORIAL_OVERLAY_HIDDEN_CLASS_NAME
    ),
    stepTitleText: currentStep?.title ?? "Tutorial complete",
    stepBodyText: currentStep?.body ?? "Replay the tutorial from settings to review the controls again.",
    stepText: currentStep ? `${currentStep.title}: ${currentStep.body}` : "Tutorial complete.",
    stepCounterText: totalSteps === 0
      ? "0 / 0"
      : visible
        ? `Step ${Math.min(state.currentIndex + 1, totalSteps)} of ${totalSteps}`
        : `Completed ${completedSteps} of ${totalSteps}`,
    actionSummaryText: DEFAULT_ACTION_SUMMARY_TEXT
  };
}

export function createTutorialOverlayController(
  callbacks: TutorialOverlayCallbacks,
  steps: readonly TutorialStep[] = DEFAULT_TUTORIAL_STEPS
): TutorialOverlayController {
  let renderState = buildTutorialOverlayRenderState(
    {
      visible: false,
      currentIndex: 0,
      completedStepIds: [],
      dismissed: false
    },
    steps
  );

  return {
    get state(): TutorialOverlayRenderState {
      return renderState;
    },
    render(state: TutorialOverlayState, nextSteps: readonly TutorialStep[] = steps): TutorialOverlayRenderState {
      renderState = buildTutorialOverlayRenderState(state, nextSteps);
      return renderState;
    },
    skip(): void {
      callbacks.onSkip();
    },
    dontShowAgain(): void {
      callbacks.onDontShowAgain();
    },
    replay(): void {
      callbacks.onReplayTutorial();
    }
  };
}

function composeClassName(...classNames: readonly string[]): string {
  return classNames.filter((className) => className.length > 0).join(" ");
}
