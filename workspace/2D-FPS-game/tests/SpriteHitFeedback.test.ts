import { describe, it, expect } from "vitest";
import {
  createSpriteHitFeedbackState,
  recordHit,
  shouldShowHitFlash,
  SPRITE_HIT_FLASH_DURATION_MS,
} from "../src/domain/feedback/SpriteHitFeedback";

describe("SpriteHitFeedback", () => {
  it("createSpriteHitFeedbackState returns lastHitAtMs: -Infinity", () => {
    const state = createSpriteHitFeedbackState();
    expect(state.lastHitAtMs).toBe(-Infinity);
  });

  it("recordHit records the timestamp", () => {
    const state = createSpriteHitFeedbackState();
    const updated = recordHit(state, 1000);
    expect(updated.lastHitAtMs).toBe(1000);
  });

  it("recordHit does not mutate original state", () => {
    const state = createSpriteHitFeedbackState();
    const updated = recordHit(state, 1000);
    expect(state.lastHitAtMs).toBe(-Infinity);
    expect(updated.lastHitAtMs).toBe(1000);
  });

  it("shouldShowHitFlash returns true within flash duration", () => {
    const state = recordHit(createSpriteHitFeedbackState(), 1000);
    expect(shouldShowHitFlash(state, 1000)).toBe(true);
    expect(shouldShowHitFlash(state, 1000 + SPRITE_HIT_FLASH_DURATION_MS - 1)).toBe(true);
  });

  it("shouldShowHitFlash returns false after flash duration", () => {
    const state = recordHit(createSpriteHitFeedbackState(), 1000);
    expect(shouldShowHitFlash(state, 1000 + SPRITE_HIT_FLASH_DURATION_MS)).toBe(false);
    expect(shouldShowHitFlash(state, 2000)).toBe(false);
  });

  it("shouldShowHitFlash returns false for fresh state (no hit recorded)", () => {
    const state = createSpriteHitFeedbackState();
    expect(shouldShowHitFlash(state, 0)).toBe(false);
    expect(shouldShowHitFlash(state, 5000)).toBe(false);
  });

  it("multiple rapid hits: latest timestamp wins", () => {
    let state = createSpriteHitFeedbackState();
    state = recordHit(state, 1000);
    state = recordHit(state, 1050);
    // Flash window is relative to latest hit (1050)
    expect(shouldShowHitFlash(state, 1050 + SPRITE_HIT_FLASH_DURATION_MS - 1)).toBe(true);
    expect(shouldShowHitFlash(state, 1050 + SPRITE_HIT_FLASH_DURATION_MS)).toBe(false);
    expect(state.lastHitAtMs).toBe(1050);
  });
});
