import { createCenteredRect, type Rect } from "../collision/CollisionLogic";
import type { MapObjectState } from "./MapObjectLogic";

const COVER_WIDTH = 48;
const COVER_HEIGHT = 16;

export interface CoverBulletSegment {
  readonly x: number;
  readonly y: number;
  readonly prevX: number;
  readonly prevY: number;
}

export function isBulletBlocked(cover: MapObjectState, bullet: CoverBulletSegment): boolean {
  if (cover.kind !== "cover" || !cover.active || cover.hp <= 0) {
    return false;
  }

  return segmentIntersectsRectInclusive(
    bullet.prevX,
    bullet.prevY,
    bullet.x,
    bullet.y,
    createCenteredRect(cover.x, cover.y, COVER_WIDTH, COVER_HEIGHT)
  );
}

function segmentIntersectsRectInclusive(x1: number, y1: number, x2: number, y2: number, rect: Rect): boolean {
  if (pointInRectInclusive(x1, y1, rect) || pointInRectInclusive(x2, y2, rect)) {
    return true;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  return (
    segmentsIntersectInclusive(x1, y1, x2, y2, left, top, right, top) ||
    segmentsIntersectInclusive(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsIntersectInclusive(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsIntersectInclusive(x1, y1, x2, y2, left, bottom, left, top)
  );
}

function pointInRectInclusive(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function segmentsIntersectInclusive(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 === 0 && onSegmentInclusive(ax, ay, cx, cy, bx, by)) {
    return true;
  }
  if (o2 === 0 && onSegmentInclusive(ax, ay, dx, dy, bx, by)) {
    return true;
  }
  if (o3 === 0 && onSegmentInclusive(cx, cy, ax, ay, dx, dy)) {
    return true;
  }
  if (o4 === 0 && onSegmentInclusive(cx, cy, bx, by, dx, dy)) {
    return true;
  }

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  return Math.abs(value) < 1e-6 ? 0 : value;
}

function onSegmentInclusive(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return bx >= Math.min(ax, cx) && bx <= Math.max(ax, cx) && by >= Math.min(ay, cy) && by <= Math.max(ay, cy);
}
