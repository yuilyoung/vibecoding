import { SoundCueLogic } from "../src/domain/audio/SoundCueLogic";

describe("SoundCueLogic", () => {
  it("maps fire events to weapon-specific cues", () => {
    const logic = new SoundCueLogic();

    expect(logic.resolveCue({ kind: "fire", weaponId: "carbine" })).toBe("fire.carbine");
    expect(logic.resolveCue({ kind: "fire", weaponId: "scatter" })).toBe("fire.scatter");
  });

  it("maps hit, pickup, gate, hazard, and match-confirm cues", () => {
    const logic = new SoundCueLogic();

    expect(logic.resolveCue({ kind: "hit", target: "player" })).toBe("hit.player");
    expect(logic.resolveCue({ kind: "hit", target: "dummy" })).toBe("hit.dummy");
    expect(logic.resolveCue({ kind: "pickup", pickupId: "ammo" })).toBe("pickup.ammo");
    expect(logic.resolveCue({ kind: "pickup", pickupId: "health" })).toBe("pickup.health");
    expect(logic.resolveCue({ kind: "gate", action: "open" })).toBe("gate.open");
    expect(logic.resolveCue({ kind: "gate", action: "close" })).toBe("gate.close");
    expect(logic.resolveCue({ kind: "hazard", source: "vent" })).toBe("hazard.tick");
    expect(logic.resolveCue({ kind: "match-confirm", action: "ready" })).toBe("match.confirm.ready");
    expect(logic.resolveCue({ kind: "match-confirm", action: "accept" })).toBe("match.confirm.accept");
    expect(logic.resolveCue({ kind: "match-start" })).toBe("match.start");
  });

  it("preserves cue order when resolving batches", () => {
    const logic = new SoundCueLogic();

    expect(
      logic.resolveCues([
        { kind: "fire", weaponId: "scatter" },
        { kind: "hit", target: "dummy" },
        { kind: "pickup", pickupId: "ammo" },
        { kind: "gate", action: "open" }
      ])
    ).toEqual(["fire.scatter", "hit.dummy", "pickup.ammo", "gate.open"]);
  });
});
