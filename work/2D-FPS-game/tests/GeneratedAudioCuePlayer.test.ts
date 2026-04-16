import { generatedToneKeys, getGeneratedTone } from "../src/domain/audio/GeneratedAudioCuePlayer";
import type { SoundCueKey } from "../src/domain/audio/SoundCueLogic";

describe("GeneratedAudioCuePlayer", () => {
  it("defines playable tone data for every sound cue", () => {
    const cues: SoundCueKey[] = [
      "fire.carbine",
      "fire.scatter",
      "fire.generic",
      "hit.player",
      "hit.dummy",
      "deflect.ricochet",
      "deflect.shield",
      "pickup.ammo",
      "pickup.health",
      "gate.open",
      "gate.close",
      "hazard.tick",
      "reload.start",
      "reload.complete",
      "reload.empty",
      "weapon.swap",
      "match.confirm.ready",
      "match.confirm.accept",
      "match.start"
    ];

    expect(generatedToneKeys).toEqual(cues);

    for (const cue of cues) {
      const tone = getGeneratedTone(cue);

      expect(tone.frequencyHz).toBeGreaterThan(0);
      expect(tone.durationMs).toBeGreaterThan(0);
      expect(tone.gain).toBeGreaterThan(0);
      expect(tone.attackMs).toBeGreaterThanOrEqual(0);
      expect(tone.releaseMs).toBeGreaterThanOrEqual(0);
      expect(tone.attackMs + tone.releaseMs).toBeLessThan(tone.durationMs);
    }
  });

  it("uses distinct firing tones for carbine and scatter", () => {
    expect(getGeneratedTone("fire.carbine").frequencyHz).not.toBe(getGeneratedTone("fire.scatter").frequencyHz);
    expect(getGeneratedTone("fire.carbine").type).not.toBe(getGeneratedTone("fire.scatter").type);
    expect(getGeneratedTone("fire.carbine").durationMs).not.toBe(getGeneratedTone("fire.scatter").durationMs);
  });

  it("keeps match-confirm tones differentiated", () => {
    expect(getGeneratedTone("match.confirm.ready").frequencyHz).not.toBe(getGeneratedTone("match.confirm.accept").frequencyHz);
    expect(getGeneratedTone("match.confirm.ready").releaseMs).not.toBe(getGeneratedTone("match.confirm.accept").releaseMs);
  });

  it("uses distinct envelope timing for weapon and reload cues", () => {
    expect(getGeneratedTone("weapon.swap").attackMs).not.toBe(getGeneratedTone("reload.start").attackMs);
    expect(getGeneratedTone("reload.empty").durationMs).not.toBe(getGeneratedTone("reload.complete").durationMs);
  });
});
