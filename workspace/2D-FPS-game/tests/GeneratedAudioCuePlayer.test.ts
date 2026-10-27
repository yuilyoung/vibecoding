import { afterEach, beforeEach, vi } from "vitest";
import { GeneratedAudioCuePlayer, getGeneratedAmbientTone, getGeneratedTone } from "../src/domain/audio/GeneratedAudioCuePlayer";

class FakeAudioParam {
  public value = 0;
  public readonly setValueAtTime = vi.fn((value: number) => { this.value = value; });
  public readonly linearRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  public readonly exponentialRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  public readonly cancelScheduledValues = vi.fn();
}

class FakeOscillator {
  public type: OscillatorType = "sine";
  public readonly frequency = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
}

class FakeGain {
  public readonly gain = new FakeAudioParam();
  public readonly connect = vi.fn();
}

class FakeAudioContext {
  public readonly currentTime = 10;
  public readonly destination = {};
  public state: AudioContextState = "running";
  public readonly oscillators: FakeOscillator[] = [];
  public readonly gains: FakeGain[] = [];
  public readonly resume = vi.fn(async () => undefined);
  public readonly close = vi.fn(async () => { this.state = "closed"; });

  public createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  public createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
}

let audioContexts: FakeAudioContext[] = [];

describe("GeneratedAudioCuePlayer", () => {
  beforeEach(() => {
    audioContexts = [];
    vi.stubGlobal("AudioContext", class extends FakeAudioContext {
      public constructor() {
        super();
        audioContexts.push(this);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the default generated tone when no override exists", () => {
    expect(getGeneratedTone("fire.carbine")).toMatchObject({
      frequencyHz: 304,
      durationMs: 58,
      gain: 0.028,
      type: "square"
    });
  });

  it("merges valid per-cue overrides without changing untouched fields", () => {
    expect(getGeneratedTone("fire.carbine", {
      "fire.carbine": {
        gain: 0.05,
        durationMs: 80
      }
    })).toMatchObject({
      frequencyHz: 304,
      durationMs: 80,
      gain: 0.05,
      type: "square"
    });
  });

  it("clamps invalid override values back into safe generated-tone ranges", () => {
    expect(getGeneratedTone("match.start", {
      "match.start": {
        frequencyHz: -30,
        durationMs: 0,
        gain: -1,
        attackMs: -3,
        releaseMs: -12
      }
    })).toMatchObject({
      frequencyHz: 1,
      durationMs: 1,
      gain: 0,
      attackMs: 0,
      releaseMs: 0,
      type: "triangle"
    });
  });

  it("provides a restrained casual ambient tone", () => {
    expect(getGeneratedAmbientTone("ambient.casual")).toMatchObject({
      frequencyHz: 196,
      durationMs: 2400,
      gain: 0.008,
      type: "triangle"
    });
  });

  it("provides map motifs with repeatable note patterns", () => {
    expect(getGeneratedAmbientTone("ambient.neon-city")).toMatchObject({
      frequencyHz: 330,
      melodyHz: [330, 392, 494, 392]
    });
  });

  it("updates the gains of already-running ambient and weather loops when muted", () => {
    const player = new GeneratedAudioCuePlayer();

    expect(player.playAmbientLoop("ambient.neon-city", 0.55, 0)).toBe(true);
    expect(player.playWeatherLoop("weather.storm.loop", 0.65, 0)).toBe(true);
    player.setVolume(0);

    const context = audioContexts[0]!;
    expect(context.gains).toHaveLength(2);
    expect(context.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 10.05);
    expect(context.gains[1]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 10.05);
  });

  it("keeps scheduling the ambient motif beyond the former 256-note limit and stops its scheduler", () => {
    vi.useFakeTimers();
    const player = new GeneratedAudioCuePlayer();

    player.playAmbientLoop("ambient.neon-city", 0.55, 0);
    const frequency = audioContexts[0]!.oscillators[0]!.frequency;
    vi.advanceTimersByTime(257 * 420);

    expect(frequency.setValueAtTime.mock.calls.length).toBeGreaterThan(256);
    const scheduledCount = frequency.setValueAtTime.mock.calls.length;
    player.stopAmbientLoop(0);
    vi.advanceTimersByTime(5 * 420);
    expect(frequency.setValueAtTime).toHaveBeenCalledTimes(scheduledCount);
  });

  it("tears down both loops and closes the shared context exactly once", () => {
    vi.useFakeTimers();
    const player = new GeneratedAudioCuePlayer();

    player.playAmbientLoop("ambient.casual", 0.55, 0);
    player.playWeatherLoop("weather.rain.loop", 0.6, 0);
    player.destroy();
    player.destroy();

    const context = audioContexts[0]!;
    expect(context.oscillators[0]!.stop).toHaveBeenCalledTimes(1);
    expect(context.oscillators[1]!.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(player.getPlaybackSnapshot()).toMatchObject({
      contextState: "closed",
      ambientLoopScheduled: false,
      weatherLoopScheduled: false
    });
  });
});
