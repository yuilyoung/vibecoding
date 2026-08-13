import type { SceneRuntimeState } from "./scene-runtime-state";

type BulletClearState = Pick<SceneRuntimeState, "bullets" | "pendingBulletClear">;

export function requestBulletClear(state: Pick<SceneRuntimeState, "pendingBulletClear">): void {
  state.pendingBulletClear = true;
}

export function flushPendingBulletClear(state: BulletClearState, clearCombatFx: () => void): void {
  if (!state.pendingBulletClear) {
    return;
  }

  for (const bullet of state.bullets) {
    bullet.sprite.destroy();
  }

  state.bullets.length = 0;
  state.pendingBulletClear = false;
  clearCombatFx();
}
