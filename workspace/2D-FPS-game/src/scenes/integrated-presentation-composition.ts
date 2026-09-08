import Phaser from "phaser";
import { ArcadeFxRenderer } from "./arcade-fx-renderer";
import {
  PresentationEventPolicy,
  type PresentationEvent,
  type PresentationEventPort,
  type PresentationSnapshot
} from "../domain/visual/PresentationEvent";

/** Owns short-lived, non-authoritative product-world interaction feedback. */
export class IntegratedPresentationComposition implements PresentationEventPort {
  private readonly policy = new PresentationEventPolicy();
  private readonly effects = new Set<Phaser.GameObjects.Arc>();
  private destroyed = false;
  private readonly arcadeFx: ArcadeFxRenderer | null;
  private readonly onUpdate = (): void => { this.arcadeFx?.update(this.scene.time.now); };

  public constructor(private scene: Phaser.Scene, private readonly enabled: boolean, arcade = false) {
    this.arcadeFx = arcade && enabled ? new ArcadeFxRenderer(scene) : null;
    if (this.arcadeFx !== null) scene.events.on("update", this.onUpdate);
  }

  public publish(event: PresentationEvent): void {
    if (this.destroyed || !this.enabled) return;
    const instruction = this.policy.accept(event);
    if (instruction === null) return;
    if (this.arcadeFx !== null) {
      this.arcadeFx.burst(instruction.x, instruction.y, instruction.kind === "destroy", instruction.family);
      return;
    }
    const color = instruction.kind === "destroy" || instruction.kind === "death" ? 0xff8a3d : 0xffe08a;
    const radius = instruction.kind === "destroy" || instruction.kind === "death" ? 22 : 15;
    const effect = this.scene.add.circle(instruction.x, instruction.y, radius, color, 0.62).setDepth(8);
    this.effects.add(effect);
    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scale: instruction.kind === "destroy" || instruction.kind === "death" ? 1.8 : 1.35,
      duration: instruction.kind === "destroy" || instruction.kind === "death" ? 210 : 130,
      onComplete: () => this.release(effect)
    });
  }

  public syncSnapshot(snapshot: PresentationSnapshot): boolean {
    return !this.destroyed && this.enabled && this.policy.syncSnapshot(snapshot);
  }

  public releaseSubject(subjectId: string): void {
    this.policy.releaseSubject(subjectId);
  }

  /** Debug-only observation; it never exposes or mutates gameplay state. */
  public getActiveEffectCount(): number {
    return this.effects.size + (this.arcadeFx?.getCount() ?? 0);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.arcadeFx !== null) this.scene.events.off("update", this.onUpdate);
    this.arcadeFx?.destroy();
    for (const effect of [...this.effects]) this.release(effect);
  }

  private release(effect: Phaser.GameObjects.Arc): void {
    if (!this.effects.delete(effect)) return;
    this.scene.tweens.killTweensOf(effect);
    effect.destroy();
  }
}
