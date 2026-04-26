import { vi } from "vitest";
import gameBalance from "../assets/data/game-balance.json";
import type { StageDefinition } from "../src/domain/map/StageDefinition";
import {
  createWeatherSnapshot,
  createRoundSnapshot,
  planRoundReset,
  resolveEffectiveWeather,
  resolveRoundStartWeather,
  resolveRoundStartWind,
  resolveBossWaveOverlay,
  resolveStageFlow,
  tickRoundWeather
} from "../src/domain/round/MatchFlowOrchestrator";
import { createBossSpawn } from "../src/domain/round/BossWaveLogic";
import { createWeatherState, type WeatherConfig, type WeatherState, type WeatherTimer, type WeatherType } from "../src/domain/environment/WeatherLogic";
import { resolveZoneWeather } from "../src/domain/map/MapZoneLogic";

const bossWaveRules = gameBalance.bossWave;
const bossWavePlan = createBossSpawn(gameBalance.stages[0], bossWaveRules);

describe("MatchFlowOrchestrator", () => {
  it("moves from stage entry into team selection on confirm", () => {
    const decision = resolveStageFlow({
      phase: "stage-entry",
      selectedTeam: null,
      confirmPressed: true,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.enterStage).toBe(true);
    expect(decision.previewTeam).toBe("BLUE");
    expect(decision.combatEvent).toBe("SELECT TEAM: 1 BLUE / 2 RED");
  });

  it("previews the red team during team selection", () => {
    const decision = resolveStageFlow({
      phase: "team-select",
      selectedTeam: "BLUE",
      confirmPressed: false,
      selectBluePressed: false,
      selectRedPressed: true,
      roundStarting: false
    });

    expect(decision.previewTeam).toBe("RED");
    expect(decision.confirmDeployment).toBe(false);
    expect(decision.combatEvent).toBe("TEAM PREVIEW RED");
  });

  it("confirms deployment only when a team is selected", () => {
    const decision = resolveStageFlow({
      phase: "team-select",
      selectedTeam: "RED",
      confirmPressed: true,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.confirmDeployment).toBe(true);
    expect(decision.combatEvent).toBe("DEPLOYING RED");
  });

  it("starts combat after deployment countdown ends", () => {
    const decision = resolveStageFlow({
      phase: "deploying",
      selectedTeam: "BLUE",
      confirmPressed: false,
      selectBluePressed: false,
      selectRedPressed: false,
      roundStarting: false
    });

    expect(decision.startCombat).toBe(true);
    expect(decision.combatEvent).toBe("COMBAT LIVE");
  });

  it("plans match confirmation timing when the match is over", () => {
    const plan = planRoundReset({
      isMatchOver: true,
      matchWinner: "PLAYER",
      now: 1000,
      matchResetDelayMs: 2500,
      respawnDelayMs: 1600
    });

    expect(plan.clearBullets).toBe(true);
    expect(plan.matchConfirmAtMs).toBe(3500);
    expect(plan.roundResetAtMs).toBeNull();
    expect(plan.combatEvent).toBe("PLAYER LOCKED");
  });

  it("plans round redeploy timing when the match is still active", () => {
    const plan = planRoundReset({
      isMatchOver: false,
      matchWinner: null,
      now: 800,
      matchResetDelayMs: 2500,
      respawnDelayMs: 1600
    });

    expect(plan.clearBullets).toBe(true);
    expect(plan.matchConfirmAtMs).toBeNull();
    expect(plan.roundResetAtMs).toBe(2400);
    expect(plan.combatEvent).toBeNull();
  });

  it("resolves boss wave overlay text on configured boss rounds", () => {
    const bossWave = resolveBossWaveOverlay({
      roundNumber: 5,
      stage: gameBalance.stages[0],
      bossWaveRules,
      bossWavePlan
    });

    expect(bossWave).toEqual({
      visible: true,
      title: "BOSS WAVE",
      subtitle: "Forge Titan incoming. HP 240. Reward Titan cache secured.",
      combatEvent: "FORGE TITAN WAVE"
    });
  });

  it("keeps the boss wave overlay hidden on non-boss rounds", () => {
    const bossWave = resolveBossWaveOverlay({
      roundNumber: 4,
      stage: gameBalance.stages[0],
      bossWaveRules,
      bossWavePlan
    });

    expect(bossWave.visible).toBe(false);
    expect(bossWave.combatEvent).toBeNull();
  });

  it("prefers stage wind overrides over rotation", () => {
    const createWindState = vi.fn((wind: { angleDegrees: number; strength: number }) => ({
      ...wind,
      tag: "override"
    }));
    const rotateWind = vi.fn(() => ({
      angleDegrees: 15,
      strength: 1,
      tag: "rotation"
    }));
    const stage = {
      ...gameBalance.stages[0],
      wind: { angleDegrees: 180, strength: 2 }
    } as StageDefinition & {
      readonly wind: { angleDegrees: number; strength: number };
    };

    const decision = resolveRoundStartWind({
      stage,
      previousWind: { angleDegrees: 45, strength: 1 },
      rng: () => 0.9,
      windConfig: {
        enabled: true,
        strengthRange: [0, 3],
        angleStepDegrees: 15,
        rotationMode: "perRound",
        defaultMultiplier: 1,
        forceScale: 240
      },
      createWindState,
      rotateWind
    });

    expect(decision.source).toBe("stage-override");
    expect(decision.wind).toEqual({ angleDegrees: 180, strength: 2, tag: "override" });
    expect(decision.snapshot.wind).toEqual(decision.wind);
    expect(createWindState).toHaveBeenCalledWith({ angleDegrees: 180, strength: 2 });
    expect(rotateWind).not.toHaveBeenCalled();
  });

  it("rotates wind deterministically when no stage override is present", () => {
    const createWindState = vi.fn((wind: { angleDegrees: number; strength: number }) => wind);
    const rotateWind = vi.fn(
      (
        previous: { angleDegrees: number; strength: number } | null,
        rng: () => number,
        config: { angleStepDegrees: number }
      ) => {
        const stepIndex = Math.floor(rng() * 4);
        const strength = previous === null ? 0 : previous.strength + 1;

        return {
          angleDegrees: stepIndex * config.angleStepDegrees,
          strength
        };
      }
    );
    const rngValues = [0.2, 0.8];
    let rngIndex = 0;
    const rng = () => rngValues[rngIndex++] ?? 0;
    const stage = gameBalance.stages[0] as StageDefinition;

    const first = resolveRoundStartWind({
      stage,
      previousWind: null,
      rng,
      windConfig: {
        enabled: true,
        strengthRange: [0, 3],
        angleStepDegrees: 15,
        rotationMode: "perRound",
        defaultMultiplier: 1,
        forceScale: 240
      },
      createWindState,
      rotateWind
    });
    const second = resolveRoundStartWind({
      stage,
      previousWind: first.wind,
      rng,
      windConfig: {
        enabled: true,
        strengthRange: [0, 3],
        angleStepDegrees: 15,
        rotationMode: "perRound",
        defaultMultiplier: 1,
        forceScale: 240
      },
      createWindState,
      rotateWind
    });

    expect(first).toMatchObject({
      source: "rotation",
      wind: { angleDegrees: 0, strength: 0 },
      snapshot: { wind: { angleDegrees: 0, strength: 0 } }
    });
    expect(second).toMatchObject({
      source: "rotation",
      wind: { angleDegrees: 45, strength: 1 },
      snapshot: { wind: { angleDegrees: 45, strength: 1 } }
    });
    expect(createWindState).not.toHaveBeenCalled();
    expect(rotateWind).toHaveBeenNthCalledWith(1, null, rng, expect.objectContaining({ angleStepDegrees: 15 }));
    expect(rotateWind).toHaveBeenNthCalledWith(2, first.wind, rng, expect.objectContaining({ angleStepDegrees: 15 }));
  });

  it("builds round snapshots that carry the selected wind payload", () => {
    const snapshot = createRoundSnapshot({
      wind: { angleDegrees: 300, strength: 3, source: "test" }
    });

    expect(snapshot).toEqual({
      wind: { angleDegrees: 300, strength: 3, source: "test" }
    });
  });

  it("prefers stage weather overrides over rotation", () => {
    const weatherConfig = gameBalance.weather as unknown as WeatherConfig;
    const createWeather = vi.fn((type: WeatherType): WeatherState & { source: string } => ({
      type,
      movementMultiplier: 1,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: false,
      source: "override"
    }));
    const rotateWeather = vi.fn((): WeatherState & { source: string } => ({
      type: "rain" as WeatherType,
      movementMultiplier: 0.85,
      visionRange: 300,
      windStrengthMultiplier: 1,
      minesDisabled: true,
      source: "rotation"
    }));
    const decision = resolveRoundStartWeather({
      stage: {
        ...gameBalance.stages[0],
        weather: { type: "fog" }
      } as StageDefinition,
      previousWeather: null,
      rng: () => 0.9,
      weatherConfig,
      createWeatherState: createWeather,
      rotateWeather
    });

    expect(decision.source).toBe("stage-override");
    expect(decision.weather).toMatchObject({ type: "fog", source: "override" });
    expect(createWeather).toHaveBeenCalledWith("fog", weatherConfig);
    expect(rotateWeather).not.toHaveBeenCalled();
  });

  it("rotates weather deterministically when no stage override is present", () => {
    const weatherConfig = gameBalance.weather as unknown as WeatherConfig;
    const rngValues = [0.2, 0.8];
    let rngIndex = 0;
    const rng = () => rngValues[rngIndex++] ?? 0;
    const first = resolveRoundStartWeather({
      stage: gameBalance.stages[0] as StageDefinition,
      previousWeather: null,
      rng,
      weatherConfig,
      createWeatherState,
      rotateWeather: (previous, nextRng, config) => createWeatherState(
        previous === null
          ? "clear"
          : nextRng() > 0.5
            ? "storm"
            : "rain",
        config
      )
    });

    expect(first.source).toBe("rotation");
    expect(first.weather.type).toBe("clear");
  });

  it("builds round snapshots that can also carry weather payload", () => {
    const weather = createWeatherState("sandstorm", gameBalance.weather as unknown as WeatherConfig);
    const snapshot = createRoundSnapshot({
      wind: { angleDegrees: 45, strength: 2 },
      weather: createWeatherSnapshot({
        global: weather,
        effective: weather
      })
    });

    expect(snapshot).toEqual({
      wind: { angleDegrees: 45, strength: 2 },
      weather: {
        global: weather,
        effective: weather
      }
    });
  });

  it("ticks timed weather and reports when the global weather changed", () => {
    const weatherConfig = gameBalance.weather as unknown as WeatherConfig;
    const timer: WeatherTimer = {
      weather: createWeatherState("clear", weatherConfig),
      durationMs: 1000,
      startedAtMs: 0,
      nextChangeAtMs: 1000
    };
    const tickWeatherTimerMock = vi.fn(() => ({
      ...timer,
      weather: createWeatherState("rain", weatherConfig),
      startedAtMs: 1000,
      nextChangeAtMs: 2000
    }));

    const decision = tickRoundWeather({
      timer,
      nowMs: 1200,
      rng: () => 0,
      weatherConfig,
      tickWeatherTimer: tickWeatherTimerMock
    });

    expect(decision.changed).toBe(true);
    expect(decision.weather.type).toBe("rain");
    expect(tickWeatherTimerMock).toHaveBeenCalledWith(timer, 1200, expect.any(Function), weatherConfig);
  });

  it("resolves effective weather from zone overrides while preserving global weather", () => {
    const weatherConfig = gameBalance.weather as unknown as WeatherConfig;
    const globalWeather = createWeatherState("clear", weatherConfig);
    const effectiveWeather = resolveEffectiveWeather({
      position: [50, 50],
      globalWeather,
      stage: {
        ...gameBalance.stages[0],
        weatherZones: [{
          weather: "fog",
          shape: {
            kind: "circle",
            cx: 50,
            cy: 50,
            radius: 100
          }
        }]
      },
      weatherConfig,
      resolveZoneWeather
    });

    expect(globalWeather.type).toBe("clear");
    expect(effectiveWeather.type).toBe("fog");
  });
});
