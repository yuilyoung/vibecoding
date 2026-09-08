import { describe, expect, it } from "vitest";
import { ARCADE_STAGES, getArcadeStagesStartingWith } from "../src/domain/map/ArcadeStageCatalog";
import { isValidStageDefinition } from "../src/domain/map/StageDefinition";
import { isStageContentDefinition, type StageDefinitionWithContent } from "../src/domain/map/StageContentDefinition";
import { StageContentSpawner } from "../src/domain/map/StageContentSpawner";
import { createCenteredRect, intersectsRect, type Rect } from "../src/domain/collision/CollisionLogic";
import { getStageVisualTheme } from "../src/domain/visual/VisualAssetCatalog";
import { createExperienceCoverPoints } from "../src/domain/visual/ArcadeExperience";
import { ACTOR_HALF_SIZE, ACTOR_COLLIDER_WIDTH, ACTOR_COLLIDER_HEIGHT, PLAYFIELD_MIN_X, PLAYFIELD_MAX_X, PLAYFIELD_MIN_Y, PLAYFIELD_MAX_Y } from "../src/scenes/scene-constants";

const STEP = 4;
const SAFE_WIDTH = Math.max(ACTOR_COLLIDER_WIDTH, ACTOR_HALF_SIZE * 2);
const SAFE_HEIGHT = Math.max(ACTOR_COLLIDER_HEIGHT, ACTOR_HALF_SIZE * 2);
type Point = { readonly x: number; readonly y: number };

function blockedRects(stage: StageDefinitionWithContent): Rect[] {
  return [
    ...stage.obstacles,
    // Reachability remains valid when the optional gate is closed and fountains are avoided.
    ...stage.content.gates,
    ...stage.content.hazards,
    ...stage.content.mapObjects.map((object) => ({ ...object, width: 32, height: 32 }))
  ].map((object) => createCenteredRect(object.x, object.y, object.width, object.height));
}

function isClear(point: Point, blocked: readonly Rect[]): boolean {
  const actor = createCenteredRect(point.x, point.y, SAFE_WIDTH, SAFE_HEIGHT);
  return actor.x >= PLAYFIELD_MIN_X && actor.y >= PLAYFIELD_MIN_Y
    && actor.x + actor.width <= PLAYFIELD_MAX_X && actor.y + actor.height <= PLAYFIELD_MAX_Y
    && !blocked.some((rect) => intersectsRect(actor, rect));
}

function reachablePoints(stage: StageDefinitionWithContent): Set<string> {
  const blocked = blockedRects(stage);
  const start = stage.blueSpawns[0]!;
  const origin = { x: Math.round(start.x / STEP) * STEP, y: Math.round(start.y / STEP) * STEP };
  expect(isClear(origin, blocked)).toBe(true);
  const queue = [origin];
  const visited = new Set<string>([`${origin.x},${origin.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: current.x + dx!, y: current.y + dy! };
      const key = `${next.x},${next.y}`;
      if (!visited.has(key) && isClear(next, blocked)) {
        visited.add(key); queue.push(next);
      }
    }
  }
  return visited;
}

describe("original casual stage catalog", () => {
  it("rotates the three choices without losing stages or changing legacy defaults", () => {
    expect(ARCADE_STAGES.map((stage) => stage.id)).toEqual(["garden-maze", "bubble-bay", "picnic-plaza"]);
    expect(getArcadeStagesStartingWith("bubble-bay").map((stage) => stage.id)).toEqual(["bubble-bay", "picnic-plaza", "garden-maze"]);
    expect(getArcadeStagesStartingWith(null)).toEqual(ARCADE_STAGES);
    expect(getArcadeStagesStartingWith("invalid")).toEqual(ARCADE_STAGES);
    expect(getArcadeStagesStartingWith(null)).not.toBe(ARCADE_STAGES);
    expect(getStageVisualTheme("missing").id).toBe("foundry");
  });

  for (const stage of ARCADE_STAGES) {
    it(`${stage.id} has complete runtime content and its own clear visual identity`, () => {
      expect(isValidStageDefinition(stage)).toBe(true);
      expect(isStageContentDefinition(stage.content)).toBe(true);
      const plan = new StageContentSpawner().spawn(stage);
      expect(plan.pickups.map((pickup) => pickup.kind).sort()).toEqual(["ammo", "health"]);
      expect(plan.hazards).toHaveLength(1);
      expect(plan.gates).toHaveLength(1);
      expect(plan.mapObjects.length).toBeGreaterThan(0);
      expect(stage.weather?.type).toBe("clear");
      expect(stage.wind?.strength).toBeLessThanOrEqual(0.3);
      expect(getStageVisualTheme(stage.id)).toMatchObject({ id: stage.id, overlayAlpha: 0 });
      const ids = [...stage.obstacles, ...plan.pickups, ...plan.hazards, ...plan.gates, ...plan.mapObjects].map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it(`${stage.id} connects every spawn and pickup with 54px clearance even with the gate shut`, () => {
      const blocked = blockedRects(stage);
      const targets = [...stage.blueSpawns, ...stage.redSpawns, ...stage.content.pickups, ...createExperienceCoverPoints(true)];
      const reachable = reachablePoints(stage);
      for (const point of targets) {
        expect(isClear(point, blocked), `${stage.id}: blocked target ${point.x},${point.y}`).toBe(true);
        const key = `${Math.round(point.x / STEP) * STEP},${Math.round(point.y / STEP) * STEP}`;
        expect(reachable.has(key), `${stage.id}: unreachable ${key}`).toBe(true);
      }
    });

    it(`${stage.id} keeps props and interaction zones clear of solid geometry`, () => {
      const obstacleRects = stage.obstacles.map((item) => createCenteredRect(item.x, item.y, item.width, item.height));
      for (const object of [...stage.content.gates, ...stage.content.hazards, ...stage.content.mapObjects]) {
        const width = "width" in object ? object.width : 32;
        const height = "height" in object ? object.height : 32;
        const rect = createCenteredRect(object.x, object.y, width, height);
        expect(obstacleRects.some((solid) => intersectsRect(rect, solid)), object.id).toBe(false);
      }
    });
  }
});
