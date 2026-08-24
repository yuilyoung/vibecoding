import { vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { StageGeometryManager } from "../src/scenes/stage-geometry";
import type {
  WorldObjectPresentationHandle,
  WorldObjectPresentationPort,
  WorldObjectPresentationSyncInput
} from "../src/scenes/world-object-presentation-composition";

class FakeVisual {
  public visible = true;
  public alpha = 1;
  public rotation = 0;
  public displayWidth: number;
  public displayHeight: number;
  public destroyed = false;

  public constructor(public x: number, public y: number, public width: number, public height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
  }

  public setDepth(): this { return this; }
  public setStrokeStyle(): this { return this; }
  public setCrop(): this { return this; }
  public setOrigin(): this { return this; }
  public setColor(): this { return this; }
  public setFillStyle(): this { return this; }
  public setText(): this { return this; }
  public setRotation(rotation: number): this { this.rotation = rotation; return this; }
  public setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  public setVisible(visible: boolean): this { this.visible = visible; return this; }
  public setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  public setSize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  public setDisplaySize(width: number, height: number): this { this.displayWidth = width; this.displayHeight = height; return this; }
  public setScale(scale: number): this { this.displayWidth = this.width * scale; this.displayHeight = this.height * scale; return this; }
  public setY(y: number): this { this.y = y; return this; }
  public destroy(): void { this.destroyed = true; }
}

function createScene() {
  const visuals: FakeVisual[] = [];
  const add = (visual: FakeVisual) => { visuals.push(visual); return visual; };
  return {
    visuals,
    scene: {
      time: { now: 1_000 },
      add: {
        rectangle: (x: number, y: number, width: number, height: number) => add(new FakeVisual(x, y, width, height)),
        image: (x: number, y: number) => add(new FakeVisual(x, y, 48, 48)),
        text: (x: number, y: number) => add(new FakeVisual(x, y, 32, 12))
      }
    }
  };
}

function createPresentationPort() {
  const attachments: Array<{ id: string; family: string; handle: WorldObjectPresentationHandle }> = [];
  const syncs: Array<{ id: string; input: WorldObjectPresentationSyncInput }> = [];
  const detached: string[] = [];
  const idByToken = new Map<symbol, string>();
  const port: WorldObjectPresentationPort = {
    atlasActive: true,
    initialize: vi.fn(),
    attach: (_anchor, family, id) => {
      const handle = { token: Symbol(id) };
      attachments.push({ id, family, handle });
      idByToken.set(handle.token, id);
      return handle;
    },
    sync: (handle, input) => syncs.push({ id: idByToken.get(handle.token) ?? "unknown", input }),
    detach: (handle) => { if (handle !== null) detached.push(idByToken.get(handle.token) ?? "unknown"); },
    clear: vi.fn(),
    destroy: vi.fn(),
    getDebugState: vi.fn() as never
  };
  return { port, attachments, syncs, detached };
}

describe("StageGeometryManager product presentation", () => {
  it("attaches all T2 variants, synchronizes state, hides legacy glyphs, and releases its handles", () => {
    const { scene } = createScene();
    const state = {
      obstacles: [],
      stageObstacleViews: [],
      coverPointViews: [],
      dummyCoverPoints: []
    } as never;
    const { port, attachments, syncs, detached } = createPresentationPort();
    const manager = new StageGeometryManager(
      scene as never,
      state,
      {} as never,
      {
        hazardDamage: 10,
        hazardTickMs: 250,
        ammoPickupAmount: 30,
        ammoPickupRespawnMs: 4_000,
        healthPickupAmount: 25,
        healthPickupRespawnMs: 5_000,
        coverPointRadius: 24
      } as never,
      {
        getCombatAvailability: vi.fn(), moveKeys: vi.fn(), activePointer: vi.fn(), restockPlayerAmmo: vi.fn(),
        isAmmoOverdriveActive: vi.fn(), activateAmmoOverdrive: vi.fn(), emitSoundCue: vi.fn(), spawnPickupFx: vi.fn(),
        registerPlayerRoundWin: vi.fn(), registerDummyRoundWin: vi.fn(), scheduleResetAfterRound: vi.fn(),
        getCoverEffectId: vi.fn(), getCoverLabel: vi.fn(), isCoverActive: vi.fn(), shouldHighlightCover: vi.fn(),
        suppressPointerFireUntil: vi.fn()
      } as never
    );

    manager.wirePresentation(port);
    manager.applyStageGeometry({
      obstacles: [
        { id: "core", x: 100, y: 100, width: 80, height: 80 },
        { id: "tower", x: 200, y: 100, width: 50, height: 120 },
        { id: "barrier", x: 300, y: 100, width: 180, height: 40 }
      ]
    } as never);
    const staticObjects = manager.createStaticRuntimeObjects();
    manager.applyStageContent({
      gates: [{ id: "gate", kind: "door", x: 480, y: 430, width: 96, height: 24, locked: true, label: "Gate" }],
      hazards: [{ id: "vent", kind: "steam", x: 510, y: 138, width: 170, height: 46, damage: 10, tickMs: 250, label: "Vent" }],
      pickups: [
        { id: "ammo", kind: "ammo", x: 160, y: 430, amount: 30, respawnMs: 4_000, label: "Ammo" },
        { id: "health", kind: "health", x: 870, y: 430, amount: 25, respawnMs: 5_000, label: "Health" }
      ],
      mapObjects: []
    } as never);

    expect(attachments.map(({ family }) => family)).toEqual([
      "arena-obstacle", "arena-obstacle", "arena-obstacle", "service-gate",
      "vent-hazard", "ammo-pickup", "health-pickup"
    ]);
    expect(syncs.filter(({ id }) => id.startsWith("stage:obstacle:")).map(({ input }) => input.variant)).toEqual([
      "core", "tower", "barrier"
    ]);
    expect(syncs.filter(({ id }) => id === "stage:service-gate").at(-1)?.input.open).toBe(false);
    expect(staticObjects.gate.sprite.visible).toBe(false);
    expect(staticObjects.hazardZone.sprite.visible).toBe(false);
    expect(staticObjects.ammoPickup.sprite.visible).toBe(false);
    expect(staticObjects.ammoPickup.label.visible).toBe(false);
    expect(staticObjects.gate.bounds).toEqual({ x: 432, y: 418, width: 96, height: 24 });

    manager.debugToggleGate();
    expect(syncs.filter(({ id }) => id === "stage:service-gate").at(-1)?.input.open).toBe(true);
    manager.applyGateDeployment(false);
    expect(staticObjects.gate.open).toBe(false);
    expect(syncs.filter(({ id }) => id === "stage:service-gate").at(-1)?.input.open).toBe(false);
    manager.updatePickupVisuals(1_100);
    expect(syncs.filter(({ id }) => id === "stage:ammo-pickup").at(-1)?.input.visible).toBe(true);

    manager.releaseSceneObjects();
    expect(detached).toHaveLength(7);
    expect(new Set(detached).size).toBe(7);
  });
});
