import type Phaser from "phaser";
import type { DamageNumberConfig } from "../domain/feedback/DamageNumberLogic";

// Air-strike clusters can spawn several overlapping damage numbers in one burst.
const POOL_SIZE = 20;

export class DamageNumberRenderer {
  private pool: Phaser.GameObjects.Text[] = [];
  private activeCount = 0;

  constructor(private scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = scene.add.text(0, 0, "", {
        fontFamily: "monospace",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3
      });
      text.setOrigin(0.5, 0.5);
      text.setVisible(false);
      text.setDepth(1000);
      this.pool.push(text);
    }
  }

  spawn(x: number, y: number, config: DamageNumberConfig): void {
    const text = this.pool[this.activeCount % POOL_SIZE];
    this.activeCount++;

    text.setText(config.text);
    text.setStyle({
      fontSize: `${config.fontSize}px`,
      color: config.color,
      fontFamily: "monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3
    });
    text.setPosition(x, y);
    text.setAlpha(1);
    text.setVisible(true);
    text.setScale(1);

    this.scene.tweens.add({
      targets: text,
      y: y - config.floatDistance,
      alpha: 0,
      scale: 0.7,
      duration: config.durationMs,
      ease: "Quad.easeOut",
      onComplete: () => {
        text.setVisible(false);
      }
    });
  }

  destroy(): void {
    for (const text of this.pool) {
      text.destroy();
    }
    this.pool = [];
  }
}
