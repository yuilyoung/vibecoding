import { describe, expect, it } from "vitest";
import { createArcadeExperienceSearch, resolveArcadeExperience } from "../src/domain/visual/ArcadeExperience";

describe("Cozy Arcade entry contract", () => {
  it("preserves existing routes and requires an explicit public experience selection", () => {
    expect(resolveArcadeExperience("").enabled).toBe(true);
    expect(resolveArcadeExperience("?worldSkin=product-v1").enabled).toBe(true);
    expect(resolveArcadeExperience("?arcade=cozy")).toEqual({ enabled: true, character: "arcade-bunny", stage: "garden-maze" });
  });
  it("round-trips all user choices and normalizes unsupported input to known local values", () => {
    for (const character of ["arcade-bunny", "arcade-bear", "arcade-fox", "arcade-cat"] as const) {
      for (const stage of ["garden-maze", "bubble-bay", "picnic-plaza"] as const) {
        const search = createArcadeExperienceSearch(character, stage);
        expect(resolveArcadeExperience(search)).toEqual({ enabled: true, character, stage });
        expect(new URLSearchParams(search).getAll("setup")).toEqual(["complete"]);
      }
    }
    expect(createArcadeExperienceSearch("<script>", "https://example.com")).toBe("?arcade=cozy&actorSkin=arcade-bunny&stage=garden-maze&setup=complete");
  });
});
