import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../src/scenes/arcade-stage-art", () => ({
  getArcadeObstacleMaterial: (id: string) => id.startsWith("garden-") ? "hedge" : null,
  getArcadeObstacleTexture: () => "test-hedge",
  getArcadeStagePropTexture: (_scene: unknown, prop: string) => `test-${prop}`
}));

import { ARCADE_STAGES } from "../src/domain/map/ArcadeStageCatalog";
import { StageContentSpawner } from "../src/domain/map/StageContentSpawner";
import { StageGeometryManager } from "../src/scenes/stage-geometry";

class Visual {
  public alpha = 1;
  public fillAlpha = 1;
  public visible = true;
  public destroyCount = 0;
  public displayWidth: number;
  public displayHeight: number;
  public constructor(public x: number, public y: number, public width: number, public height: number, public texture = "") {
    this.displayWidth = width; this.displayHeight = height;
  }
  public setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  public setSize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  public setDisplaySize(width: number, height: number): this { this.displayWidth = width; this.displayHeight = height; return this; }
  public setAlpha(value: number): this { this.alpha = value; return this; }
  public setVisible(value: boolean): this { this.visible = value; return this; }
  public setFillStyle(_color: number, alpha: number): this { this.fillAlpha = alpha; return this; }
  public setScale(): this { return this; }
  public setDepth(): this { return this; }
  public setOrigin(): this { return this; }
  public setText(): this { return this; }
  public destroy(): void { this.destroyCount += 1; }
}

describe("cozy static prop ownership", () => {
  it("moves artwork with its real collider, reflects gate state and frees all round/scene objects once", () => {
    const visuals: Visual[] = [];
    const add = (visual: Visual) => { visuals.push(visual); return visual; };
    const scene = {
      time: { now: 1000 },
      add: {
        image: (x: number, y: number, texture: string) => add(new Visual(x, y, 48, 48, texture)),
        rectangle: (x: number, y: number, width: number, height: number) => add(new Visual(x, y, width, height)),
        text: (x: number, y: number) => add(new Visual(x, y, 32, 12))
      }
    };
    const state = { obstacles: [], stageObstacleViews: [], coverPointViews: [], dummyCoverPoints: [] };
    const manager = new StageGeometryManager(scene as never, state as never, {} as never, {
      arcadePresentation: true, hazardDamage: 7, hazardTickMs: 900,
      ammoPickupAmount: 8, ammoPickupRespawnMs: 5000, healthPickupAmount: 28, healthPickupRespawnMs: 6500
    } as never, { emitSoundCue: vi.fn() } as never);
    const stage = ARCADE_STAGES[0]!;
    manager.applyStageGeometry(stage);
    const props = manager.createStaticRuntimeObjects();
    const spawner = new StageContentSpawner();
    manager.applyStageContent(spawner.spawn(stage));
    const gateArt = visuals.find((visual) => visual.texture === "test-gate")!;
    const fountainArt = visuals.find((visual) => visual.texture === "test-fountain")!;
    expect(gateArt).toMatchObject({ x: 480, y: 270, displayWidth: 24, displayHeight: 56, alpha: 0.28 });
    expect(props.gate.bounds).toEqual({ x: 468, y: 242, width: 24, height: 56 });
    expect(fountainArt).toMatchObject({ x: 480, y: 330, displayWidth: 64, displayHeight: 24 });
    manager.debugToggleGate();
    expect(props.gate.open).toBe(false);
    expect(gateArt.alpha).toBe(1);
    expect((props.gate.sprite as unknown as Visual).fillAlpha).toBe(0);
    manager.applyGateDeployment(true);
    expect(gateArt.alpha).toBe(0.28);
    manager.applyStageContent(spawner.spawn(ARCADE_STAGES[2]!));
    expect(gateArt).toMatchObject({ x: 752, y: 270 });
    expect(fountainArt).toMatchObject({ x: 480, y: 354 });
    manager.releaseSceneObjects();
    manager.releaseSceneObjects();
    expect(state.obstacles).toHaveLength(0);
    expect(visuals.every((visual) => visual.destroyCount === 1)).toBe(true);
  });
});
