import type { GameBalanceMapObjects } from "../../scenes/scene-types";
import { destroyMapObject, type MapObjectState } from "./MapObjectLogic";
import { resolveTeleport } from "./TeleporterLogic";

export type MapObjectDropType = "health" | "ammo" | "boost";

export interface MapObjectActor {
  readonly id?: string;
  readonly x: number;
  readonly y: number;
}

export interface MapObjectDrop {
  readonly id: string;
  readonly type: MapObjectDropType;
  readonly x: number;
  readonly y: number;
}

export interface MapObjectTeleport {
  readonly actorId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly x: number;
  readonly y: number;
  readonly cooldownUntil: number;
}

export interface MapObjectTickResult {
  readonly objects: readonly MapObjectState[];
  readonly triggered: readonly string[];
  readonly drops: readonly MapObjectDrop[];
  readonly teleports: readonly MapObjectTeleport[];
}

export interface MapObjectRuntimeWeather {
  readonly minesDisabled?: boolean;
}

type MapObjectRuntimeConfig = GameBalanceMapObjects & {
  readonly teleporter?: {
    readonly radius: number;
    readonly cooldownMs: number;
  };
};

export function advanceMapObjects(
  now: number,
  _dt: number,
  actors: readonly MapObjectActor[],
  objects: readonly MapObjectState[],
  config: MapObjectRuntimeConfig,
  rng: () => number = Math.random,
  weather?: MapObjectRuntimeWeather
): MapObjectTickResult {
  const triggered: string[] = [];
  const drops: MapObjectDrop[] = [];
  const teleports: Array<{
    actorId: string;
    fromId: string;
    toId: string;
    x: number;
    y: number;
    cooldownUntil: number;
  }> = [];

  const nextObjects = objects.map((object) => {
    if (object.kind === "teleporter" && object.cooldownMs === undefined && config.teleporter !== undefined) {
      return {
        ...object,
        cooldownMs: config.teleporter.cooldownMs
      };
    }

    if (object.kind === "mine") {
      return advanceMine(now, actors, object, config.mine, triggered, weather);
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

  let teleporterAwareObjects = nextObjects;
  const teleporterRadius = config.teleporter?.radius;

  if (teleporterRadius !== undefined) {
    actors.forEach((actor, actorIndex) => {
      const resolution = resolveTeleport(
        {
          id: actor.id ?? `actor-${actorIndex}`,
          x: actor.x,
          y: actor.y
        },
        teleporterAwareObjects,
        now,
        teleporterRadius
      );

      if (resolution === null) {
        return;
      }

      teleports.push({
        actorId: actor.id ?? `actor-${actorIndex}`,
        fromId: resolution.sourceId,
        toId: resolution.destinationId,
        x: resolution.x,
        y: resolution.y,
        cooldownUntil: resolution.cooldownUntil
      });
      teleporterAwareObjects = teleporterAwareObjects.map((object) => {
        if (object.id !== resolution.sourceId && object.id !== resolution.destinationId) {
          return object;
        }

        return {
          ...object,
          cooldownUntil: resolution.cooldownUntil
        };
      });
    });
  }

  return {
    objects: teleporterAwareObjects,
    triggered,
    drops,
    teleports
  };
}

function advanceMine(
  now: number,
  actors: readonly MapObjectActor[],
  object: MapObjectState,
  config: GameBalanceMapObjects["mine"],
  triggered: string[],
  weather?: MapObjectRuntimeWeather
): MapObjectState {
  if (!object.active) {
    return object;
  }

  const armedAt = object.armedAt ?? now + config.armDelayMs;
  const isArmed = now >= armedAt;
  const actorInRange = isArmed && weather?.minesDisabled !== true && actors.some((actor) => {
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
