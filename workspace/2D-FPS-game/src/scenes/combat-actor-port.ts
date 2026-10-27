import type { ActorId, ControllerKind } from "../domain/round/BattleRosterLogic";
import type { PlayerLogic } from "../domain/player/PlayerLogic";
import type { TeamId } from "../domain/round/MatchFlowLogic";
import type { PlayerWeaponSlot } from "./scene-types";

export interface SceneActorSprite {
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
  setPosition(x: number, y: number): unknown;
  setRotation(rotation: number): unknown;
  setVisible(visible: boolean): unknown;
  setTexture?(textureKey: string, frame?: string | number): unknown;
  play?(animationKey: string): unknown;
  destroy(): void;
}

export interface SceneCombatActor {
  readonly id: ActorId;
  team: TeamId;
  readonly controller: ControllerKind;
  readonly logic: PlayerLogic;
  readonly sprite: SceneActorSprite;
  readonly animatedSprite: SceneActorSprite | null;
  readonly weaponSprite: SceneActorSprite;
  readonly weaponSlots: readonly PlayerWeaponSlot[];
  activeWeaponIndex: number;
  shouldFire: boolean;
  bodyAngle: number;
  readonly isCoverProtected: (now: number) => boolean;
  readonly onHit: (now: number) => void;
  readonly destroy: () => void;
}
