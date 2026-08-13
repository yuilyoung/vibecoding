import { getDummyVisualState, getPlayerVisualState, getRespawnFxState } from "../src/ui/scene-visuals";

describe("scene visuals", () => {
  it("returns fully restored respawn fx after the timer ends", () => {
    expect(getRespawnFxState(1000, 900, 900)).toEqual({
      alpha: 1,
      scale: 1
    });
  });

  it("returns player death visuals when the player is dead", () => {
    expect(getPlayerVisualState({
      isDead: true,
      isStunned: false,
      isSprinting: false,
      muzzleFlashActive: false,
      respawnFx: { alpha: 1, scale: 1 }
    })).toEqual({
      tint: 0x5a6a75,
      alpha: 0.35,
      scale: 0.82
    });
  });

  it("returns sprinting player visuals with muzzle flash scaling", () => {
    expect(getPlayerVisualState({
      isDead: false,
      isStunned: false,
      isSprinting: true,
      muzzleFlashActive: true,
      respawnFx: { alpha: 0.9, scale: 1.1 }
    })).toEqual({
      tint: 0xffffff,
      alpha: 0.9,
      scale: 1.08 * 1.1 * 1.04
    });
  });

  it("returns larger dummy visuals for avoid-hazard mode", () => {
    const visual = getDummyVisualState({
      isDead: false,
      healthRatio: 0.5,
      decision: "avoid-hazard",
      respawnFxScale: 1.1
    });

    expect(visual.alpha).toBe(1);
    expect(visual.scale).toBeCloseTo(1.12 * 1.1);
  });
});
