import type { ProjectileConfig } from "../src/domain/combat/ProjectileRuntime";
import { flushPendingBulletClear, requestBulletClear } from "../src/scenes/combat-bullet-clear";
import type { SceneRuntimeState } from "../src/scenes/scene-runtime-state";
import type { BulletView } from "../src/scenes/scene-types";

function createBullet(id: string, destroy: ReturnType<typeof vi.fn>): BulletView {
  return {
    sprite: {
      name: id,
      destroy
    } as unknown as BulletView["sprite"],
    velocityX: 120,
    velocityY: 0,
    damage: 10,
    critChance: 0,
    critMultiplier: 1,
    owner: "player",
    effectProfile: "carbine",
    projectileConfig: { trajectory: "linear", speed: 120 } satisfies ProjectileConfig,
    bouncesRemaining: 0
  };
}

function createControllerHarness() {
  const destroyA = vi.fn();
  const destroyB = vi.fn();
  const clearCombatFx = vi.fn();
  const bullets = [createBullet("a", destroyA), createBullet("b", destroyB)];
  const state = {
    bullets,
    pendingBulletClear: false
  } as unknown as SceneRuntimeState;
  return {
    state,
    bullets,
    destroyA,
    destroyB,
    clearCombatFx
  };
}

describe("CombatController hotfix", () => {
  it("defers bullet destruction until the flush boundary", () => {
    const harness = createControllerHarness();

    requestBulletClear(harness.state);

    expect(harness.state.pendingBulletClear).toBe(true);
    expect(harness.bullets).toHaveLength(2);
    expect(harness.destroyA).not.toHaveBeenCalled();
    expect(harness.destroyB).not.toHaveBeenCalled();
    expect(harness.clearCombatFx).not.toHaveBeenCalled();

    flushPendingBulletClear(harness.state, harness.clearCombatFx);

    expect(harness.state.pendingBulletClear).toBe(false);
    expect(harness.bullets).toHaveLength(0);
    expect(harness.destroyA).toHaveBeenCalledTimes(1);
    expect(harness.destroyB).toHaveBeenCalledTimes(1);
    expect(harness.clearCombatFx).toHaveBeenCalledTimes(1);
  });

  it("tolerates a pending clear while the shared bullet array is being read", () => {
    const harness = createControllerHarness();

    const visitedNames: string[] = [];
    for (let index = harness.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = harness.bullets[index];

      if (index === 1) {
        requestBulletClear(harness.state);
      }

      if (bullet !== undefined) {
        visitedNames.push((bullet.sprite as { name: string }).name);
      }
    }

    expect(visitedNames).toEqual(["b", "a"]);
    expect(harness.bullets).toHaveLength(2);
    expect(harness.state.pendingBulletClear).toBe(true);

    flushPendingBulletClear(harness.state, harness.clearCombatFx);

    expect(harness.bullets).toHaveLength(0);
    expect(harness.clearCombatFx).toHaveBeenCalledTimes(1);
  });
});
