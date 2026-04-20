import Phaser from "phaser";

const HP_THRESHOLD = 0.3;
const MAX_ALPHA = 0.35;
const VIGNETTE_COLOR = 0xff0000;

export class LowHpVignette {
  private overlay: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.overlay = scene.add.rectangle(width / 2, height / 2, width, height, VIGNETTE_COLOR);
    this.overlay.setDepth(900);
    this.overlay.setAlpha(0);
    this.overlay.setScrollFactor(0);
  }

  update(currentHp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? currentHp / maxHp : 1;
    if (ratio >= HP_THRESHOLD || currentHp <= 0) {
      this.overlay.setAlpha(0);
      return;
    }
    const intensity = 1 - (ratio / HP_THRESHOLD);
    this.overlay.setAlpha(intensity * MAX_ALPHA);
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
