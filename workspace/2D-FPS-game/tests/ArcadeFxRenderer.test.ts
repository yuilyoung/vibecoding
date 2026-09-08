import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { ArcadeFxRenderer, ARCADE_FRAGMENT_LIMIT, ARCADE_FRAGMENT_LIFETIME_MS } from "../src/scenes/arcade-fx-renderer";

function harness() {
  const images: ReturnType<typeof sprite>[] = [];
  function sprite(x: number, y: number) {
    return { x, y, rotation: 0, alpha: 1, destroyed: 0,
      setDepth() { return this; }, setDisplaySize() { return this; }, setTint() { return this; }, setData() { return this; },
      setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
      setRotation(value: number) { this.rotation = value; return this; },
      setAlpha(value: number) { this.alpha = value; return this; }, destroy() { this.destroyed++; }
    };
  }
  const scene = { time: { now: 100 }, textures: { exists: () => true }, add: { image: (x: number, y: number) => {
    const image = sprite(x, y); images.push(image); return image;
  } } };
  return { scene, images, renderer: new ArcadeFxRenderer(scene as unknown as Phaser.Scene) };
}

describe("bounded cosmetic effects", () => {
  it("evicts excess fragments and releases every image exactly once on expiry and repeated shutdown", () => {
    const h = harness();
    for (let index = 0; index < 20; index++) h.renderer.burst(20, 30, true, "crate");
    expect(h.renderer.getCount()).toBe(ARCADE_FRAGMENT_LIMIT);
    expect(h.images.filter((image) => image.destroyed === 0)).toHaveLength(ARCADE_FRAGMENT_LIMIT);
    h.renderer.update(100 + ARCADE_FRAGMENT_LIFETIME_MS);
    expect(h.renderer.getCount()).toBe(0);
    h.renderer.destroy(); h.renderer.destroy(); h.renderer.burst(20, 30, true);
    expect(h.images.every((image) => image.destroyed === 1)).toBe(true);
    expect(h.renderer.getCount()).toBe(0);
  });
  it("uses elapsed scene time, so multiple updates give the same particle positions as one", () => {
    const a = harness(); const b = harness();
    a.renderer.burst(50, 60, true); b.renderer.burst(50, 60, true);
    for (const time of [110, 130, 160, 200]) a.renderer.update(time);
    b.renderer.update(200);
    expect(a.images.map(({ x, y, alpha }) => ({ x, y, alpha }))).toEqual(b.images.map(({ x, y, alpha }) => ({ x, y, alpha })));
  });
  it("follows a projectile without altering its geometry, and releases art when the authoritative projectile dies", () => {
    const h = harness();
    const anchor = { x: 10, y: 20, width: 12, height: 6, rotation: .5, active: true, scene: {}, alpha: 1,
      setAlpha(value: number) { this.alpha = value; return this; } };
    h.renderer.decorateProjectile(anchor as unknown as Phaser.GameObjects.Rectangle, "scatter", "RED");
    anchor.x = 70; anchor.rotation = 1.2;
    h.renderer.update(140);
    expect(h.images[0]).toMatchObject({ x: 70, y: 20, rotation: 1.2 });
    expect(anchor).toMatchObject({ width: 12, height: 6, x: 70, y: 20 });
    anchor.active = false;
    h.renderer.update(150);
    h.renderer.destroy();
    expect(h.images[0].destroyed).toBe(1);
    expect(h.renderer.getCount()).toBe(0);
  });
});
