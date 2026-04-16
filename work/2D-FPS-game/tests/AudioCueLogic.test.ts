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

  describe("edge cases (Phase 3 QA audit)", () => {
    it("plays no cues when maxSimultaneous is zero, regardless of priority", () => {
      const logic = new AudioCueLogic();
      const state: AudioCueState = {
        maxSimultaneous: 0,
        lastPlayedAtMsByCue: {}
      };

      const decision = logic.resolveCues(
        [
          { kind: "match-start" },
          { kind: "hit", target: "player" },
          { kind: "fire", weaponId: "carbine" }
        ],
        state,
        1000
      );

      expect(decision.play).toEqual([]);
      expect(decision.drop).toEqual(["match.start", "hit.player", "fire.carbine"]);
    });

    it("dedupes same-frame duplicate cues that have a non-zero cooldown", () => {
      const logic = new AudioCueLogic();
      const state: AudioCueState = {
        maxSimultaneous: 8,
        lastPlayedAtMsByCue: {}
      };

      // pickup.health has cooldownMs: 80. After the first plays at t=2000,
      // the second same-frame event sees lastPlayed=2000 and (2000-2000) < 80 → drop.
      const decision = logic.resolveCues(
        [
          { kind: "pickup", pickupId: "health" },
          { kind: "pickup", pickupId: "health" },
          { kind: "pickup", pickupId: "health" }
        ],
        state,
        2000
      );

      expect(decision.play).toEqual(["pickup.health"]);
      expect(decision.drop).toEqual(["pickup.health", "pickup.health"]);
    });

    it("allows duplicate same-frame cues when their cooldown is zero", () => {
      const logic = new AudioCueLogic();
      const state: AudioCueState = {
        maxSimultaneous: 8,
        lastPlayedAtMsByCue: {}
      };

      // match.start has cooldownMs: 0 → repeated events all play (until cap).
      const decision = logic.resolveCues(
        [{ kind: "match-start" }, { kind: "match-start" }],
        state,
        100
      );

      expect(decision.play).toEqual(["match.start", "match.start"]);
      expect(decision.drop).toEqual([]);
    });

    it("does not crash when nowMs is negative (no input guard, arithmetic still consistent)", () => {
      const logic = new AudioCueLogic();
      const state: AudioCueState = {
        maxSimultaneous: 4,
        lastPlayedAtMsByCue: { "fire.carbine": -2000 }
      };

      // (-1000) - (-2000) = 1000 >= 90 (carbine cooldown) → plays.
      expect(() =>
        logic.resolveCues([{ kind: "fire", weaponId: "carbine" }], state, -1000)
      ).not.toThrow();

      const decision = logic.resolveCues(
        [{ kind: "fire", weaponId: "carbine" }],
        state,
        -1000
      );

      expect(decision.play).toEqual(["fire.carbine"]);
      expect(decision.drop).toEqual([]);
    });
  });
});
