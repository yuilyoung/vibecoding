import { getGeneratedTone } from "../src/domain/audio/GeneratedAudioCuePlayer";
import type { SoundCueKey } from "../src/domain/audio/SoundCueLogic";

describe("GeneratedAudioCuePlayer", () => {
  it("defines playable tone data for every sound cue", () => {
    const cues: SoundCueKey[] = [
      "fire.carbine",
      "fire.scatter",
      "fire.generic",
      "hit.player",
      "hit.dummy",
      "pickup.ammo",
      "pickup.health",
      "gate.open",
      "gate.close",
      "hazard.tick",
      "match.confirm.ready",
      "match.confirm.accept"
    ];

    for (const cue of cues) {
      const tone = getGeneratedTone(cue);

      expect(tone.frequencyHz).toBeGreaterThan(0);
      expect(tone.durationMs).toBeGreaterThan(0);
      expect(tone.gain).toBeGreaterThan(0);
    }
  });

  it("uses distinct firing tones for carbine and scatter", () => {
    expect(getGeneratedTone("fire.carbine").frequencyHz).not.toBe(getGeneratedTone("fire.scatter").frequencyHz);
  });
});
