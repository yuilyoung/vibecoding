import Phaser from "phaser";
import { createInputBindings, type MoveKeys } from "./input-bindings";
import type { MatchFlowStageInput } from "./match-flow-controller";
import type { SceneRuntimeState } from "./scene-runtime-state";

export interface MainSceneInputBindings {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  readonly moveKeys: MoveKeys;
}

export function initializeMainSceneInput(scene: Phaser.Scene): MainSceneInputBindings {
  return createInputBindings(scene);
}

export function createMainSceneStageFlowInput(
  moveKeys: MoveKeys | undefined,
  cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined
): MatchFlowStageInput | null {
  if (moveKeys === undefined || cursors === undefined) {
    return null;
  }

  return {
    confirmPressed: Phaser.Input.Keyboard.JustDown(moveKeys.confirm),
    selectBluePressed: Phaser.Input.Keyboard.JustDown(moveKeys.weapon1) || Phaser.Input.Keyboard.JustDown(cursors.left),
    selectRedPressed: Phaser.Input.Keyboard.JustDown(moveKeys.weapon2) || Phaser.Input.Keyboard.JustDown(cursors.right)
  };
}

export function applyMainSceneInputOverlay(
  active: boolean,
  now: number,
  runtimeState: SceneRuntimeState
): boolean {
  runtimeState.suppressPointerFireUntilMs = active ? Number.POSITIVE_INFINITY : now + 200;
  return active;
}
