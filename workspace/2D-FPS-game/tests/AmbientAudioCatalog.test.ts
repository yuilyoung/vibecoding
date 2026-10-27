import { describe, expect, it } from "vitest";
import { getAmbientCueForStage } from "../src/domain/audio/AmbientAudioCatalog";
import { getGeneratedAmbientTone } from "../src/domain/audio/GeneratedAudioCuePlayer";

describe("AmbientAudioCatalog", () => {
  it("assigns a distinct casual motif to every arcade map", () => {
    const stages = ["garden-maze", "bubble-bay", "picnic-plaza", "beach-boardwalk", "whispering-woods", "sun-dune", "neon-city", "frost-festival"];
    const cues = stages.map(getAmbientCueForStage);

    expect(new Set(cues).size).toBe(stages.length);
    expect(getAmbientCueForStage("unknown-stage")).toBe("ambient.casual");
    expect(getGeneratedAmbientTone(cues[0]!).frequencyHz).not.toBe(getGeneratedAmbientTone(cues[1]!).frequencyHz);
  });
});
