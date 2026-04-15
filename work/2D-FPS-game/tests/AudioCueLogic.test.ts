import { AudioCueLogic, type AudioCueState } from "../src/domain/audio/AudioCueLogic";

describe("AudioCueLogic", () => {
  it("maps sound events to cues through the existing sound cue resolver", () => {
    const logic = new AudioCueLogic();

    expect(logic.resolveCue({ kind: "fire", weaponId: "carbine" })).toBe("fire.carbine");
    expect(logic.resolveCue({ kind: "match-start" })).toBe("match.start");
  });

  it("prefers higher priority cues and preserves input order within the same priority", () => {
    const logic = new AudioCueLogic();
    const state: AudioCueState = {
      maxSimultaneous: 2,
      lastPlayedAtMsByCue: {}
    };

    const decision = logic.resolveCues(
      [
        { kind: "fire", weaponId: "generic" },
        { kind: "pickup", pickupId: "ammo" },
        { kind: "match-start" },
        { kind: "hit", target: "player" }
      ],
      state,
      5000
    );

    expect(decision.play).toEqual(["match.start", "hit.player"]);
    expect(decision.drop).toEqual(["pickup.ammo", "fire.generic"]);
  });

  it("drops cues that are still inside their cooldown window", () => {
    const logic = new AudioCueLogic();
    const state: AudioCueState = {
      maxSimultaneous: 4,
      lastPlayedAtMsByCue: {
        "fire.carbine": 1000
      }
    };

    const decision = logic.resolveCues(
      [
        { kind: "fire", weaponId: "carbine" },
        { kind: "fire", weaponId: "carbine" },
        { kind: "fire", weaponId: "scatter" }
      ],
      state,
      1050
    );

    expect(decision.play).toEqual(["fire.scatter"]);
    expect(decision.drop).toEqual(["fire.carbine", "fire.carbine"]);
  });

  it("caps simultaneous playback after priority sorting", () => {
    const logic = new AudioCueLogic();
    const state: AudioCueState = {
      maxSimultaneous: 3,
      lastPlayedAtMsByCue: {}
    };

    const decision = logic.resolveCues(
      [
        { kind: "pickup", pickupId: "ammo" },
        { kind: "hazard", source: "vent" },
        { kind: "match-confirm", action: "ready" },
        { kind: "weapon-state", action: "swap" }
      ],
      state,
      9000
    );

    expect(decision.play).toEqual(["match.confirm.ready", "pickup.ammo", "weapon.swap"]);
    expect(decision.drop).toEqual(["hazard.tick"]);
  });
});
