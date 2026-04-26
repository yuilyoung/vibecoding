import { vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    }
  }
}));

import { HudController } from "../src/scenes/hud-controller";
import { publishWeatherChanged } from "../src/ui/hud-events";
import type { HudControllerDeps } from "../src/scenes/hud-controller";

describe("HudController", () => {
  beforeEach(() => {
    const eventWindow = new EventTarget();
    Object.assign(globalThis, {
      window: eventWindow
    });

    if (typeof globalThis.CustomEvent === "undefined") {
      class TestCustomEvent<T = unknown> extends Event {
        public readonly detail: T;

        public constructor(type: string, init?: CustomEventInit<T>) {
          super(type, init);
          this.detail = init?.detail as T;
        }
      }

      globalThis.CustomEvent = TestCustomEvent as unknown as typeof CustomEvent;
    }
  });

  function createDeps(overrides: Partial<HudControllerDeps> = {}): HudControllerDeps {
    return {
      gameBalance: {
        movementSpeed: 220,
        dashMultiplier: 1.4,
        maxHealth: 100,
        hitStunMs: 260,
        bulletSpeed: 540,
        fireRateMs: 180,
        bulletDamage: 20,
        magazineSize: 6,
        reloadTimeMs: 1200,
        reserveAmmo: 24,
        matchScoreToWin: 5,
        matchResetDelayMs: 2200,
        roundStartDelayMs: 900,
        ammoPickupAmount: 8,
        ammoPickupRespawnMs: 5000,
        healthPickupAmount: 28,
        healthPickupRespawnMs: 6500,
        dummyMovementSpeed: 140,
        dummyEngageRange: 260,
        dummyRetreatRange: 120,
        dummyShootRange: 320,
        dummyLowHealthThreshold: 0.35,
        hazardDamage: 7,
        hazardTickMs: 900,
        coverPointRadius: 18,
        actorSkinSource: "spritesheet",
        actorSpritesheetPath: "/assets/sprites/actors.png",
        actorFrameWidth: 44,
        actorFrameHeight: 30,
        progression: { xpPerKill: 25, xpPerRoundClear: 80, levelCurve: [100] },
        unlocks: { defaultWeaponIds: ["carbine"], weaponRules: [] },
        stages: [],
        wind: { enabled: true, strengthRange: [0, 3], angleStepDegrees: 15, rotationMode: "perRound", defaultMultiplier: 1, forceScale: 240 },
        weather: {
          enabled: true,
          rotationMode: "perRound",
          durationRangeMs: [60000, 120000],
          particleCountMultiplier: 1,
          soundChannels: {
            rain: { cue: "weather.rain.loop", volume: 0.6, fadeMs: 800 },
            sandstorm: { cue: "weather.sandstorm.loop", volume: 0.7, fadeMs: 800 },
            storm: { cue: "weather.storm.loop", volume: 0.65, fadeMs: 800 }
          },
          types: {
            clear: { weight: 3, movementMultiplier: 1, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
            rain: { weight: 2, movementMultiplier: 0.85, visionRange: 300, windStrengthMultiplier: 1, minesDisabled: true, particleCount: 50 },
            fog: { weight: 2, movementMultiplier: 1, visionRange: 150, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 },
            sandstorm: { weight: 1, movementMultiplier: 0.95, visionRange: 220, windStrengthMultiplier: 2, minesDisabled: false, particleCount: 30 },
            storm: { weight: 1, movementMultiplier: 0.9, visionRange: 260, windStrengthMultiplier: 1, minesDisabled: false, particleCount: 0 }
          }
        },
        mapObjects: {
          barrel: { hp: 40, blastRadius: 80, blastDamage: 40, triggerRadius: 70, chainDelayMs: 150 },
          mine: { armDelayMs: 500, proximityRadius: 40, fuseMs: 1000, blastRadius: 50, blastDamage: 50 },
          crate: { hp: 25, dropTable: { health: 0.4, ammo: 0.4, boost: 0.2 } },
          cover: { hp: 60, width: 48, height: 16, blocksBullets: true },
          bounceWall: { width: 48, height: 8, maxReflections: 3 },
          teleporter: { radius: 24, cooldownMs: 1500 }
        }
      } as HudControllerDeps["gameBalance"],
      bossWaveRules: { intervalRounds: 5, firstBossRound: 5, bossName: "Boss", bossHealth: 100, bossSpeed: 100, rewardExperience: 100, rewardUnlockWeaponId: "airStrike", rewardLabel: "Reward", spawnLabel: "Spawn" },
      matchFlow: { state: { phase: "stage-entry", selectedTeam: null, deploymentCount: 0 } } as HudControllerDeps["matchFlow"],
      roundLogic: { state: { playerScore: 0, dummyScore: 0, roundNumber: 1, lastResult: "READY", matchWinner: null, isMatchOver: false, scoreToWin: 5 } } as HudControllerDeps["roundLogic"],
      weaponSlots: [],
      getActiveWeaponSlot: () => ({ id: "carbine", label: "Carbine", logic: { getAmmoInMagazine: () => 6, getReserveAmmo: () => 24, isReloading: () => false, getReloadRemaining: () => 0, getReloadDuration: () => 1200, getCooldownRemaining: () => 0, getCooldownDuration: () => 180, getProjectileConfig: () => ({ trajectory: "linear", speed: 1 }) } } as never),
      getActiveWeaponIndex: () => 0,
      stageDefinitions: [],
      getCurrentStage: () => ({ id: "foundry", label: "Foundry", weight: 1, blueSpawns: [], redSpawns: [], obstacles: [] }),
      getStageRotationState: () => ({ currentIndex: 0, history: [] }),
      getBossWavePlan: () => null,
      getProgressionState: () => ({ level: 1, xp: 0, totalXp: 0 }),
      getUnlockState: () => ({ unlockedWeaponIds: [] }),
      getUnlockRules: () => [],
      getNewlyUnlockedWeaponIds: () => [],
      getUnlockNoticeUntilMs: () => 0,
      getLastSpawnSummary: () => "WAITING",
      getLastSoundCue: () => "NONE",
      isRoundStarting: () => false,
      isCombatLive: () => false,
      getRoundStartStatus: () => "LIVE",
      getPickupStatus: () => "READY",
      getHealthPickupStatus: () => "READY",
      getMatchConfirmAtMs: () => null,
      getMatchConfirmReadyCueSent: () => false,
      setMatchConfirmReadyCueSent: () => {},
      emitSoundCue: () => {},
      enterMatchOver: () => {},
      getCoverEffectId: () => "shield",
      ...overrides
    };
  }

  function createScene() {
    return {
      time: { now: 0 },
      scale: { gameSize: { width: 960, height: 540 }, displaySize: { width: 960, height: 540 } },
      input: { activePointer: { worldX: 480, worldY: 270 } }
    } as never;
  }

  function createState() {
    return {
      playerLogic: { state: { health: 100, maxHealth: 100, isSprinting: false } },
      dummyLogic: { state: { health: 100, maxHealth: 100 } },
      gate: { open: false },
      lastCombatEvent: "READY",
      activeDummyCoverIndex: null,
      playerSprite: { x: 480, y: 270 }
    } as never;
  }

  afterEach(() => {
    publishWeatherChanged({
      type: "clear",
      movementMultiplier: 1,
      visionRange: 9999,
      windStrengthMultiplier: 1,
      minesDisabled: false,
      soundResetReason: "MATCH_RESET"
    });
  });

  it("queues a weather loop once per unique audible weather type", () => {
    const queueWeatherSoundCue = vi.fn();
    new HudController(createScene(), createState(), createDeps({ queueWeatherSoundCue }));

    publishWeatherChanged({
      type: "rain",
      movementMultiplier: 0.85,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: true
    });
    publishWeatherChanged({
      type: "rain",
      movementMultiplier: 0.85,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: true
    });

    expect(queueWeatherSoundCue).toHaveBeenCalledTimes(1);
    expect(queueWeatherSoundCue).toHaveBeenCalledWith({
      action: "play",
      weatherType: "rain",
      cue: "weather.rain.loop",
      volume: 0.6,
      fadeMs: 800,
      priority: 18
    });
  });

  it("stops the active weather loop on clear weather and on MATCH_RESET, then replays after reset", () => {
    const queueWeatherSoundCue = vi.fn();
    new HudController(createScene(), createState(), createDeps({ queueWeatherSoundCue }));

    publishWeatherChanged({
      type: "storm",
      movementMultiplier: 0.9,
      visionRange: 260,
      windStrengthMultiplier: 1,
      minesDisabled: false
    });
    publishWeatherChanged({
      type: "clear",
      movementMultiplier: 1,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: false
    });
    publishWeatherChanged({
      type: "storm",
      movementMultiplier: 0.9,
      visionRange: 260,
      windStrengthMultiplier: 1,
      minesDisabled: false
    });
    publishWeatherChanged({
      type: "storm",
      movementMultiplier: 0.9,
      visionRange: 260,
      windStrengthMultiplier: 1,
      minesDisabled: false,
      soundResetReason: "MATCH_RESET"
    });
    publishWeatherChanged({
      type: "storm",
      movementMultiplier: 0.9,
      visionRange: 260,
      windStrengthMultiplier: 1,
      minesDisabled: false
    });

    expect(queueWeatherSoundCue.mock.calls).toEqual([
      [{
        action: "play",
        weatherType: "storm",
        cue: "weather.storm.loop",
        volume: 0.65,
        fadeMs: 800,
        priority: 18
      }],
      [{
        action: "stop",
        cue: "weather.storm.loop",
        fadeMs: 800,
        priority: 18,
        reason: "WEATHER_CLEAR"
      }],
      [{
        action: "play",
        weatherType: "storm",
        cue: "weather.storm.loop",
        volume: 0.65,
        fadeMs: 800,
        priority: 18
      }],
      [{
        action: "stop",
        cue: "weather.storm.loop",
        fadeMs: 800,
        priority: 18,
        reason: "MATCH_RESET"
      }],
      [{
        action: "play",
        weatherType: "storm",
        cue: "weather.storm.loop",
        volume: 0.65,
        fadeMs: 800,
        priority: 18
      }]
    ]);
  });
});
