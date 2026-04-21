import type { GameBalanceMapObjects } from "../../scenes/scene-types";
import { destroyMapObject, type MapObjectState } from "./MapObjectLogic";

export type MapObjectDropType = "health" | "ammo" | "boost";

export interface MapObjectActor {
  readonly x: number;
  readonly y: number;
}

export interface MapObjectDrop {
  readonly id: string;
  readonly type: MapObjectDropType;
  readonly x: number;
  readonly y: number;
}

export interface MapObjectTickResult {
  readonly objects: readonly MapObjectState[];
  readonly triggered: readonly string[];
  readonly drops: readonly MapObjectDrop[];
}

export function advanceMapObjects(
  now: number,
  _dt: number,
  actors: readonly MapObjectActor[],
  objects: readonly MapObjectState[],
  config: GameBalanceMapObjects,
  rng: () => number = Math.random
): MapObjectTickResult {
  const triggered: string[] = [];
  const drops: MapObjectDrop[] = [];

  const nextObjects = objects.map((object) => {
    if (object.kind === "mine") {
      return advanceMine(now, actors, object, config.mine, triggered);
    }

    if (object.kind === "crate" && !object.active && object.hp <= 0) {
      drops.push({
        id: object.id,
        type: selectDrop(config.crate.dropTable, rng()),
        x: object.x,
        y: object.y
      });
    }

    return object;
  });

  return {
    objects: nextObjects,
    triggered,
    drops
  };
}

function advanceMine(
  now: number,
  actors: readonly MapObjectActor[],
  object: MapObjectState,
  config: GameBalanceMapObjects["mine"],
  triggered: string[]
): MapObjectState {
  if (!object.active) {
    return object;
  }

  const armedAt = object.armedAt ?? now + config.armDelayMs;
  const isArmed = now >= armedAt;
  const actorInRange = isArmed && actors.some((actor) => {
    return Math.hypot(actor.x - object.x, actor.y - object.y) <= config.proximityRadius;
  });
  const fuseStartedAt = actorInRange ? object.fuseStartedAt ?? now : undefined;

  if (fuseStartedAt !== undefined && now - fuseStartedAt >= config.fuseMs) {
    triggered.push(object.id);
    return destroyMapObject(object);
  }

  return {
    ...object,
    armedAt,
    fuseStartedAt
  };
}

function selectDrop(dropTable: GameBalanceMapObjects["crate"]["dropTable"], roll: number): MapObjectDropType {
  const normalizedRoll = Math.min(Math.max(roll, 0), 0.999999);
  const healthThreshold = dropTable.health;
  const ammoThreshold = healthThreshold + dropTable.ammo;

  if (normalizedRoll < healthThreshold) {
    return "health";
  }

  if (normalizedRoll < ammoThreshold) {
    return "ammo";
  }

  return "boost";
}
