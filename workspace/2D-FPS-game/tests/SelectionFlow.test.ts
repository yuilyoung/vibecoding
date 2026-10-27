import { describe, expect, it } from "vitest";
import { renderSelectionFlow } from "../src/ui/SelectionFlow";
import { DEFAULT_DEPLOYMENT_SELECTION } from "../src/domain/deployment/DeploymentSelection";

describe("SelectionFlow", () => {
  it("renders four character choices and map selection together for arcade entry", () => {
    const markup = renderSelectionFlow(DEFAULT_DEPLOYMENT_SELECTION);

    expect(markup).toContain('data-testid="selection-flow"');
    expect(markup.match(/name="character"/g)).toHaveLength(4);
    expect(markup).toContain('value="arcade-fox"');
    expect(markup).toContain('value="arcade-cat"');
    expect(markup).toContain("Quick paws");
    expect(markup).toContain("Smooth loader");
    expect(markup.match(/name="stage"/g)).toHaveLength(8);
    expect(markup).not.toContain("ground_shaker_asset/map_preview.png");
    for (const stageId of ["garden-maze", "bubble-bay", "picnic-plaza", "beach-boardwalk", "whispering-woods", "sun-dune", "neon-city", "frost-festival"]) {
      expect(markup).toContain(`value="${stageId}"`);
      expect(markup).toContain(`cozy-stage-preview--${stageId}`);
    }
    expect(markup).not.toContain("Choose your mode");
    expect(markup).not.toContain("Choose your weapon");
    expect(markup).toContain("Enter duel");
  });
});
