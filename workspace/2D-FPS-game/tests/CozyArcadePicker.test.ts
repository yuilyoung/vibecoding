import { describe, expect, it } from "vitest";
import { renderCozyArcadePicker } from "../src/ui/CozyArcadePicker";
import { resolveArcadeExperience } from "../src/domain/visual/ArcadeExperience";

describe("CozyArcadePicker", () => {
  it("renders all four arcade characters with their trait labels", () => {
    const markup = renderCozyArcadePicker(resolveArcadeExperience("?actorSkin=arcade-fox"));

    expect(markup.match(/name="character"/g)).toHaveLength(4);
    expect(markup).toContain('value="arcade-fox"');
    expect(markup).toContain('value="arcade-cat"');
    expect(markup).toContain("DASH SCOUT");
    expect(markup).toContain("SMOOTH LOADER");
  });

  it("renders all eight arcade maps with unique preview classes and no legacy preview image", () => {
    const markup = renderCozyArcadePicker(resolveArcadeExperience("?actorSkin=arcade-fox"));

    expect(markup.match(/name="stage"/g)).toHaveLength(8);
    expect(markup).not.toContain("ground_shaker_asset/map_preview.png");
    for (const stageId of ["garden-maze", "bubble-bay", "picnic-plaza", "beach-boardwalk", "whispering-woods", "sun-dune", "neon-city", "frost-festival"]) {
      expect(markup).toContain(`value="${stageId}"`);
      expect(markup).toContain(`cozy-stage-preview--${stageId}`);
    }
  });

  it("returns from an active cozy game to a completed classic runtime", () => {
    const markup = renderCozyArcadePicker(resolveArcadeExperience("?arcade=cozy"));

    expect(markup).toContain('href="?arcade=classic&setup=complete"');
    expect(markup).toContain("Classic mode");
  });
});
