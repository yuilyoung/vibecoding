import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratedAudioCuePlayer } from "../src/domain/audio/GeneratedAudioCuePlayer";
import { AudioFeedbackController } from "../src/scenes/audio-feedback-controller";

const createScene = (now = 1000) => ({
  time: { now },
  cameras: { main: { shake: vi.fn() } }
}) as never;

const rain = {
  action: "play" as const,
  weatherType: "rain" as const,
  cue: "weather.rain.loop" as const,
  volume: 0.6,
  fadeMs: 800,
  priority: 18 as const
};

const storm = {
  action: "play" as const,
  weatherType: "storm" as const,
  cue: "weather.storm.loop" as const,
  volume: 0.65,
  fadeMs: 800,
  priority: 18 as const
};

describe("AudioFeedbackController weather loops", () => {
  afterEach(() => vi.restoreAllMocks());

  it("owns concrete loop playback, switches the active loop, and suppresses duplicate requests", () => {
    const playWeatherLoop = vi.spyOn(GeneratedAudioCuePlayer.prototype, "playWeatherLoop").mockImplementation(() => {});
    const stopWeatherLoop = vi.spyOn(GeneratedAudioCuePlayer.prototype, "stopWeatherLoop").mockImplementation(() => {});
    const controller = new AudioFeedbackController(createScene());

    controller.queueWeatherSoundCue(rain);
    controller.queueWeatherSoundCue(storm);
    controller.queueWeatherSoundCue(storm);

    expect(playWeatherLoop).toHaveBeenNthCalledWith(1, "weather.rain.loop", 0.6, 800);
    expect(stopWeatherLoop).toHaveBeenCalledWith(800);
    expect(playWeatherLoop).toHaveBeenNthCalledWith(2, "weather.storm.loop", 0.65, 800);
    expect(controller.getRuntimeAudioSnapshot()).toMatchObject({
      activeWeatherLoopCue: "weather.storm.loop",
      queuedWeatherSoundCount: 3,
      lastDroppedCue: "weather.storm.loop"
    });
  });

  it("stops playback and clears cooldown state so reset or clear can replay the same loop immediately", () => {
    const scene = createScene();
    const playWeatherLoop = vi.spyOn(GeneratedAudioCuePlayer.prototype, "playWeatherLoop").mockImplementation(() => {});
    const stopWeatherLoop = vi.spyOn(GeneratedAudioCuePlayer.prototype, "stopWeatherLoop").mockImplementation(() => {});
    const controller = new AudioFeedbackController(scene);

    controller.queueWeatherSoundCue(rain);
    controller.queueWeatherSoundCue({
      action: "stop",
      cue: "weather.rain.loop",
      fadeMs: 800,
      priority: 18 as const,
      reason: "MATCH_RESET"
    });
    controller.queueWeatherSoundCue(rain);

    expect(stopWeatherLoop).toHaveBeenCalledTimes(1);
    expect(playWeatherLoop).toHaveBeenCalledTimes(2);
    expect(controller.getRuntimeAudioSnapshot()).toMatchObject({
      activeWeatherLoopCue: "weather.rain.loop",
      lastDroppedCue: null
    });
  });
});