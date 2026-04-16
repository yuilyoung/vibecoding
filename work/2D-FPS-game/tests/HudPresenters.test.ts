import { buildMatchOverlayState, type HudPresenterInput } from "../src/ui/hud-presenters";

describe("HudPresenters", () => {
  const bossWaveInput: HudPresenterInput = {
    now: 0,
    matchFlow: {
      phase: "combat-live",
      selectedTeam: "BLUE",
      deploymentCount: 0
    },
    round: {
      playerScore: 3,
      dummyScore: 2,
      roundNumber: 5,
      lastResult: "READY",
      matchWinner: null,
      isMatchOver: false,
      scoreToWin: 5
    },
    combat: {
      selectedTeam: "BLUE",
      spawnSummary: "Foundry",
      activeWeapon: "Carbine",
      weaponSlot: 1,
      weaponSlots: [],
      ammoInMagazine: 6,
      reserveAmmo: 24,
      isReloading: false,
      reloadProgress: 0,
      cooldownRemainingMs: 0,
      cooldownDurationMs: 180,
      playerHealth: 100,
      playerMaxHealth: 100,
      dummyHealth: 100,
      dummyMaxHealth: 100,
      gateOpen: false,
      lastEvent: "READY",
      lastSoundCue: "NONE",
      movementMode: "Walk",
      movementBlocked: false,
      roundStartLabel: "900",
      ammoPickupLabel: "READY",
      healthPickupLabel: "READY",
      coverVisionActive: false,
      coverVisionX: 0,
      coverVisionY: 0,
      coverVisionRadius: 0
    },
    isRoundStarting: true,
    matchConfirmAtMs: null,
    matchConfirmReadyCueSent: false,
    bossWave: {
      visible: true,
      title: "BOSS WAVE",
      subtitle: "Forge Titan incoming. HP 240. Reward Titan cache secured.",
      combatEvent: "FORGE TITAN WAVE"
    }
  };

  it("renders boss wave overlay text when the boss wave is active", () => {
    const overlayResult = buildMatchOverlayState(bossWaveInput);

    expect(overlayResult).toEqual({
      overlay: {
        visible: true,
        title: "BOSS WAVE",
        subtitle: "Forge Titan incoming. HP 240. Reward Titan cache secured."
      },
      shouldEmitMatchConfirmReadyCue: false,
      shouldEnterMatchOver: false
    });
  });

  it("keeps match-over overlay ahead of boss wave text", () => {
    const overlayResult = buildMatchOverlayState({
      ...bossWaveInput,
      now: 1000,
      round: {
        ...bossWaveInput.round,
        isMatchOver: true,
        matchWinner: "PLAYER"
      },
      matchConfirmAtMs: 1000
    });

    expect(overlayResult.overlay.title).toBe("PLAYER VICTORY");
    expect(overlayResult.shouldEnterMatchOver).toBe(true);
  });
});
