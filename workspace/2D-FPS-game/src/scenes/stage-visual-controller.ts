import type { StageVisualTheme } from "../domain/visual/VisualAssetCatalog";
import { getStageVisualTheme } from "../domain/visual/VisualAssetCatalog";
import type { ArenaBackdropVisuals } from "./arena-textures";
import { ARCADE_FLOOR_KEY, getArcadeFloorTint } from "./arcade-arena-art";
import { getArcadeStageFloorKey } from "./arcade-stage-art";

export interface StageVisualDebugState {
  readonly stageId: string;
  readonly crop: StageVisualTheme["terrainCrop"];
  readonly terrainTint: number;
  readonly overlayColor: number;
  readonly borderColor: number;
}

export class StageVisualController {
  private theme = getStageVisualTheme("foundry");

  public constructor(private readonly visuals: ArenaBackdropVisuals) {}

  public applyStage(stageId: string): void {
    this.theme = getStageVisualTheme(stageId);
    const floor = this.visuals.arcadeFloor;
    const stageFloorKey = getArcadeStageFloorKey(floor.scene, stageId);
    floor.setTexture(stageFloorKey ?? ARCADE_FLOOR_KEY).setTint(stageFloorKey === null ? getArcadeFloorTint(stageId) : 0xffffff);
    const crop = this.theme.terrainCrop;
    this.visuals.terrain
      .setCrop(crop.x, crop.y, crop.width, crop.height)
      .setTint(this.theme.terrainTint);
    this.visuals.toneOverlay.setFillStyle(this.theme.overlayColor, this.theme.overlayAlpha);
    this.visuals.border.setStrokeStyle(2, this.theme.borderColor, 0.62);
  }

  public getDebugState(): StageVisualDebugState {
    return {
      stageId: this.theme.id,
      crop: this.theme.terrainCrop,
      terrainTint: this.theme.terrainTint,
      overlayColor: this.theme.overlayColor,
      borderColor: this.theme.borderColor
    };
  }

  public destroy(): void {
    this.visuals.background.destroy();
    this.visuals.terrain.destroy();
    this.visuals.toneOverlay.destroy();
    this.visuals.border.destroy();
    this.visuals.arcadeFloor.destroy();
  }
}
