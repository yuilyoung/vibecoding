import { createCenteredRect } from "../collision/CollisionLogic";
import {
  reflectVelocity,
  type ProjectileRuntimeState
} from "../combat/ProjectileRuntime";
import { destroyMapObject, type MapObjectState } from "./MapObjectLogic";

const BOUNCE_WALL_WIDTH = 48;
const BOUNCE_WALL_HEIGHT = 8;

export type BounceWallResult =
  | {
      readonly kind: "passthrough";
      readonly wall: MapObjectState;
    }
  | {
      readonly kind: "reflected";
      readonly projectile: ProjectileRuntimeState;
      readonly wall: MapObjectState;
    };

export function reflectProjectileOffWall(
  projectile: ProjectileRuntimeState,
  wall: MapObjectState
): BounceWallResult {
  if (wall.kind !== "bounce-wall" || !wall.active || (wall.reflectionsRemaining ?? 0) <= 0) {
    return {
      kind: "passthrough",
      wall
    };
  }

  const obstacle = getWallBounds(wall);
  const nextBounds = createCenteredRect(
    projectile.x + Math.sign(projectile.velocityX || 0) * (obstacle.width + projectile.width + 1),
    projectile.y + Math.sign(projectile.velocityY || 0) * (obstacle.height + projectile.height + 1),
    projectile.width,
    projectile.height
  );
  const velocity = reflectVelocity(projectile, nextBounds, [obstacle]);
  const reflectionsRemaining = Math.max(0, (wall.reflectionsRemaining ?? 0) - 1);
  const nextWall = reflectionsRemaining === 0
    ? {
        ...destroyMapObject(wall),
        reflectionsRemaining
      }
    : {
        ...wall,
        reflectionsRemaining
      };

  return {
    kind: "reflected",
    projectile: {
      ...projectile,
      velocityX: velocity.x,
      velocityY: velocity.y
    },
    wall: nextWall
  };
}

function getWallBounds(wall: MapObjectState) {
  const normalizedAngle = Math.abs((wall.angleDegrees ?? 0) % 180);
  const isVertical = normalizedAngle === 90;
  return createCenteredRect(
    wall.x,
    wall.y,
    isVertical ? BOUNCE_WALL_HEIGHT : BOUNCE_WALL_WIDTH,
    isVertical ? BOUNCE_WALL_WIDTH : BOUNCE_WALL_HEIGHT
  );
}
