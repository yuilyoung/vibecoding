export interface SpriteHitFeedbackState {
  lastHitAtMs: number;
}

export const SPRITE_HIT_FLASH_DURATION_MS = 70;

export function createSpriteHitFeedbackState(): SpriteHitFeedbackState {
  return { lastHitAtMs: -Infinity };
}

export function recordHit(state: SpriteHitFeedbackState, nowMs: number): SpriteHitFeedbackState {
  return { lastHitAtMs: nowMs };
}

export function shouldShowHitFlash(state: SpriteHitFeedbackState, nowMs: number): boolean {
  return nowMs - state.lastHitAtMs < SPRITE_HIT_FLASH_DURATION_MS;
}
