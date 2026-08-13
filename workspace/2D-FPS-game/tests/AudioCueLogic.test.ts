import { AudioCueLogic } from "../src/domain/audio/AudioCueLogic";

describe("AudioCueLogic", () => {
  it("uses override rules for priority and cooldown when resolving cues", () => {
    const logic = new AudioCueLogic({
      "hazard.tick": {
        priority: 90,
        cooldownMs: 500
      }
    });

    const first = logic.resolveCues([
      { kind: "hazard", source: "vent" },
      { kind: "fire", weaponId: "carbine" }
    ], {
      maxSimultaneous: 1,
      lastPlayedAtMsByCue: {}
    }, 1000);

    const second = logic.resolveCues([
      { kind: "hazard", source: "vent" }
    ], {
      maxSimultaneous: 1,
      lastPlayedAtMsByCue: {
        "hazard.tick": 1200
      }
    }, 1500);

    expect(first.play).toEqual(["hazard.tick"]);
    expect(first.drop).toEqual(["fire.carbine"]);
    expect(second.play).toEqual([]);
    expect(second.drop).toEqual(["hazard.tick"]);
  });
});
