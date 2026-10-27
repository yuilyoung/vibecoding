import { describe, expect, it } from "vitest";
import { renderDeploymentPicker } from "../src/ui/DeploymentPicker";
import { DEFAULT_DEPLOYMENT_SELECTION } from "../src/domain/deployment/DeploymentSelection";

describe("DeploymentPicker", () => {
  it("renders weapon images, three map thumbnails, enemy count choices, weather, and skins", () => {
    const markup = renderDeploymentPicker(DEFAULT_DEPLOYMENT_SELECTION);

    expect(markup).toContain('data-testid="deployment-picker"');
    expect(markup).toContain('src="/assets/runtime/sprites/weapon-hud-carbine.png"');
    expect(markup.match(/data-stage-card=/g)).toHaveLength(3);
    expect(markup).not.toContain("ground_shaker_asset/map_preview.png");
    expect(markup).toContain("deployment-card__thumbnail--foundry");
    expect(markup.match(/name="enemyCount"/g)).toHaveLength(4);
    expect(markup).toContain('value="storm"');
    expect(markup).toContain('value="product-v1"');
  });
});
