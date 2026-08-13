import { HazardZoneLogic } from "../src/domain/map/HazardZoneLogic";

describe("HazardZoneLogic", () => {
  it("applies damage when an actor overlaps the zone", () => {
    const hazard = new HazardZoneLogic(7, 500);

    const tick = hazard.tick("player", true, 1000);

    expect(tick.triggered).toBe(true);
    expect(tick.damage).toBe(7);
    expect(tick.nextReadyAtMs).toBe(1500);
  });

  it("respects per-actor cooldowns", () => {
    const hazard = new HazardZoneLogic(7, 500);

    hazard.tick("player", true, 1000);
    const blocked = hazard.tick("player", true, 1200);
    const dummy = hazard.tick("dummy", true, 1200);

    expect(blocked.triggered).toBe(false);
    expect(dummy.triggered).toBe(true);
  });

  it("does not tick when the actor is outside the zone", () => {
    const hazard = new HazardZoneLogic(7, 500);

    const tick = hazard.tick("player", false, 1000);

    expect(tick.triggered).toBe(false);
    expect(tick.damage).toBe(0);
  });

  it("clears cooldowns on reset", () => {
    const hazard = new HazardZoneLogic(7, 500);

    hazard.tick("player", true, 1000);
    hazard.reset();

    expect(hazard.tick("player", true, 1100).triggered).toBe(true);
  });
});
