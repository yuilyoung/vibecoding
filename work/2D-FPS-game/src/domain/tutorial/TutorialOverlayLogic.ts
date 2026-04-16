export type TutorialStepId = "movement" | "aim-fire" | "weapon-swap" | "pickup" | "level-up";

export interface TutorialStep {
  readonly id: TutorialStepId;
  readonly title: string;
  readonly body: string;
}

export interface TutorialOverlayState {
  readonly visible: boolean;
  readonly currentIndex: number;
  readonly completedStepIds: readonly TutorialStepId[];
  readonly dismissed: boolean;
}

export type TutorialSignal = "moved" | "fired" | "swapped-weapon" | "collected-pickup" | "leveled-up";

export interface TutorialAdvanceResult {
  readonly state: TutorialOverlayState;
  readonly completedNow: TutorialStepId | null;
}

export const DEFAULT_TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: "movement", title: "Move", body: "Use WASD to move and Space to sprint." },
  { id: "aim-fire", title: "Aim And Fire", body: "Aim with the mouse, then fire with click or F." },
  { id: "weapon-swap", title: "Swap Weapons", body: "Use Q or number keys 1-6 to change weapons." },
  { id: "pickup", title: "Use Pickups", body: "Collect ammo and health pickups when pressure rises." },
  { id: "level-up", title: "Progress", body: "Win rounds to gain XP and unlock more weapons." }
];

const signalByStep: Record<TutorialStepId, TutorialSignal> = {
  movement: "moved",
  "aim-fire": "fired",
  "weapon-swap": "swapped-weapon",
  pickup: "collected-pickup",
  "level-up": "leveled-up"
};

export function createTutorialOverlayState(tutorialDismissed: boolean): TutorialOverlayState {
  return {
    visible: !tutorialDismissed,
    currentIndex: 0,
    completedStepIds: [],
    dismissed: tutorialDismissed
  };
}

export function getCurrentTutorialStep(
  state: TutorialOverlayState,
  steps: readonly TutorialStep[] = DEFAULT_TUTORIAL_STEPS
): TutorialStep | null {
  if (!state.visible || state.dismissed) {
    return null;
  }

  return steps[state.currentIndex] ?? null;
}

export function advanceTutorial(
  state: TutorialOverlayState,
  signal: TutorialSignal,
  steps: readonly TutorialStep[] = DEFAULT_TUTORIAL_STEPS
): TutorialAdvanceResult {
  const currentStep = getCurrentTutorialStep(state, steps);

  if (currentStep === null || signalByStep[currentStep.id] !== signal) {
    return { state, completedNow: null };
  }

  const completedStepIds = [...state.completedStepIds, currentStep.id];
  const nextIndex = state.currentIndex + 1;
  const completedAll = nextIndex >= steps.length;

  return {
    state: {
      visible: !completedAll,
      currentIndex: completedAll ? state.currentIndex : nextIndex,
      completedStepIds,
      dismissed: completedAll
    },
    completedNow: currentStep.id
  };
}

export function dismissTutorial(state: TutorialOverlayState): TutorialOverlayState {
  return {
    ...state,
    visible: false,
    dismissed: true
  };
}

export function resetTutorial(): TutorialOverlayState {
  return createTutorialOverlayState(false);
}
