import type { MapObjectState } from "./MapObjectLogic";

const DEFAULT_TELEPORTER_RADIUS = 24;
const DEFAULT_TELEPORTER_COOLDOWN_MS = 1_500;

export interface TeleporterActor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface TeleportResolution {
  readonly x: number;
  readonly y: number;
  readonly cooldownUntil: number;
  readonly sourceId: string;
  readonly destinationId: string;
}

export function resolveTeleport(
  actor: TeleporterActor,
  teleporters: readonly MapObjectState[],
  now: number,
  radius: number = DEFAULT_TELEPORTER_RADIUS
): TeleportResolution | null {
  const source = teleporters.find((teleporter) => {
    return (
      teleporter.kind === "teleporter" &&
      teleporter.active &&
      (teleporter.cooldownUntil ?? 0) <= now &&
      Math.hypot(actor.x - teleporter.x, actor.y - teleporter.y) <= radius
    );
  });

  if (source === undefined || source.pairId === undefined) {
    return null;
  }

  const matches = teleporters.filter((teleporter) => {
    return teleporter.kind === "teleporter" && teleporter.pairId === source.pairId;
  });
  if (matches.length !== 2) {
    return null;
  }

  const destination = matches.find((teleporter) => teleporter.id !== source.id);
  if (destination === undefined || (destination.cooldownUntil ?? 0) > now) {
    return null;
  }

  const cooldownMs = source.cooldownMs ?? destination.cooldownMs ?? DEFAULT_TELEPORTER_COOLDOWN_MS;
  return {
    x: destination.x,
    y: destination.y,
    cooldownUntil: now + cooldownMs,
    sourceId: source.id,
    destinationId: destination.id
  };
}
