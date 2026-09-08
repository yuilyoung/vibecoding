import type Phaser from "phaser";

export const ARCADE_FRAGMENT_LIMIT = 96;
export const ARCADE_FRAGMENT_LIFETIME_MS = 460;
type Fragment = { image: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; born: number; duration: number; spin: number };

/** Scene-local, non-authoritative art. Particle motion uses elapsed time, never frame count. */
export class ArcadeFxRenderer {
  private readonly fragments: Fragment[] = [];
  private readonly projectiles = new Map<Phaser.GameObjects.Rectangle, Phaser.GameObjects.Image>();
  private destroyed = false;

  public constructor(private readonly scene: Phaser.Scene) {}

  public decorateProjectile(anchor: Phaser.GameObjects.Rectangle, profile: string, team: "BLUE" | "RED"): void {
    if (this.destroyed || this.projectiles.has(anchor)) return;
    this.ensureTextures();
    const style = profile === "scatter" ? "star" : profile === "bazooka" ? "comet" : profile === "grenade" ? "star" : "bubble";
    const image = this.scene.add.image(anchor.x, anchor.y, `cozy-fx-${style}`).setDepth(8)
      .setDisplaySize(style === "comet" ? 27 : 17, style === "comet" ? 19 : 17)
      .setTint(team === "BLUE" ? 0xb4f8ff : 0xffb5d2);
    image.setData("arcadeProjectile", style);
    anchor.setAlpha(0);
    this.projectiles.set(anchor, image);
  }

  public burst(x: number, y: number, destroyed: boolean, material = "impact"): void {
    if (this.destroyed) return;
    this.ensureTextures();
    const count = destroyed ? 12 : 6;
    const color = material === "crate" ? 0xf0c384 : material === "cover" ? 0x9bdbbd
      : material === "barrel" ? 0xffb7a2 : material === "scatter" ? 0xffe7a1 : 0xa4f0f5;
    for (let index = 0; index < count; index++) {
      while (this.fragments.length >= ARCADE_FRAGMENT_LIMIT) this.fragments.shift()!.image.destroy();
      const angle = index * Math.PI * 2 / count + 0.27;
      const speed = (destroyed ? 75 : 40) + (index % 3) * 18;
      const size = destroyed ? 7 + index % 3 : 4 + index % 3;
      const image = this.scene.add.image(x, y, `cozy-fx-${destroyed && index % 3 !== 0 ? "chip" : "star"}`)
        .setDepth(9).setDisplaySize(size, size).setTint(color);
      image.setData("arcadeFragment", material);
      this.fragments.push({ image, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35,
        born: this.scene.time.now, duration: destroyed ? ARCADE_FRAGMENT_LIFETIME_MS : 270, spin: index % 2 === 0 ? 5 : -5 });
    }
  }

  public update(now: number): void {
    for (const [anchor, image] of this.projectiles) {
      if (!anchor.active || !anchor.scene) {
        image.destroy();
        this.projectiles.delete(anchor);
      } else image.setPosition(anchor.x, anchor.y).setRotation(anchor.rotation);
    }
    for (let index = this.fragments.length - 1; index >= 0; index--) {
      const fragment = this.fragments[index];
      const elapsed = Math.max(0, now - fragment.born);
      if (elapsed >= fragment.duration) {
        fragment.image.destroy();
        this.fragments.splice(index, 1);
        continue;
      }
      const seconds = elapsed / 1000;
      fragment.image.setPosition(fragment.x + fragment.vx * seconds, fragment.y + fragment.vy * seconds + 95 * seconds * seconds)
        .setRotation(fragment.spin * seconds).setAlpha(1 - elapsed / fragment.duration);
    }
  }

  public getCount(): number { return this.fragments.length + this.projectiles.size; }

  public clear(): void {
    for (const fragment of this.fragments) fragment.image.destroy();
    this.fragments.length = 0;
    for (const image of this.projectiles.values()) image.destroy();
    this.projectiles.clear();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clear();
  }

  private ensureTextures(): void {
    if (this.scene.textures.exists("cozy-fx-bubble")) return;
    const g = this.scene.add.graphics();
    g.fillStyle(0x356b85).fillCircle(16, 16, 14);
    g.fillStyle(0xcffaff).fillCircle(16, 15, 12);
    g.fillStyle(0x6abcca).fillCircle(18, 19, 8);
    g.fillStyle(0xb9f4f4).fillCircle(16, 15, 9);
    g.fillStyle(0xffffff).fillEllipse(12, 10, 8, 5);
    g.lineStyle(1.5, 0xffffff, .9).strokeCircle(16, 15, 11);
    g.generateTexture("cozy-fx-bubble", 32, 32);
    g.clear();
    const star = Array.from({ length: 10 }, (_, index) => {
      const angle = index * Math.PI / 5 - Math.PI / 2;
      const radius = index % 2 === 0 ? 14 : 7;
      return { x: 16 + Math.cos(angle) * radius, y: 16 + Math.sin(angle) * radius };
    });
    g.fillStyle(0xffffee).fillPoints(star, true);
    g.lineStyle(2, 0x877958).strokePoints(star, true);
    g.fillStyle(0xffffff).fillEllipse(14, 12, 7, 4);
    g.generateTexture("cozy-fx-star", 32, 32);
    g.clear();
    g.fillStyle(0xc9eef1).fillTriangle(1, 9, 23, 16, 1, 23);
    g.fillStyle(0xffffff).fillTriangle(3, 13, 25, 16, 3, 19);
    g.fillStyle(0x557d90).fillCircle(22, 16, 9);
    g.fillStyle(0xfffaf0).fillCircle(22, 15, 7);
    g.fillStyle(0xffffff).fillEllipse(21, 12, 5, 3);
    g.generateTexture("cozy-fx-comet", 32, 32);
    g.clear();
    g.fillStyle(0x7e7765).fillRoundedRect(4, 5, 24, 24, 5);
    g.fillStyle(0xffffff).fillRoundedRect(4, 3, 24, 22, 5);
    g.lineStyle(2, 0xd6dac4).lineBetween(8, 7, 22, 7);
    g.generateTexture("cozy-fx-chip", 32, 32);
    g.destroy();
  }
}
