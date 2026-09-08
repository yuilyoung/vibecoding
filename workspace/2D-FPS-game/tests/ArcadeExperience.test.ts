import { describe, expect, it } from "vitest";
import { createArcadeExperienceSearch, resolveArcadeExperience } from "../src/domain/visual/ArcadeExperience";

describe("Cozy Arcade entry contract", () => {
  it("preserves existing routes and requires an explicit public experience selection", () => {
    expect(resolveArcadeExperience("").enabled).toBe(false);
    expect(resolveArcadeExperience("?worldSkin=product-v1").enabled).toBe(false);
    expect(resolveArcadeExperience("?arcade=cozy")).toEqual({ enabled: true, character: "arcade-bunny", stage: "garden-maze" });
  });
  it("round-trips all user choices and normalizes unsupported input to known local values", () => {
    for (const character of ["arcade-bunny", "arcade-bear"] as const) {
      for (const stage of ["garden-maze", "bubble-bay", "picnic-plaza"] as const) {
        expect(resolveArcadeExperience(createArcadeExperienceSearch(character, stage))).toEqual({ enabled: true, character, stage });
      }
    }
    expect(createArcadeExperienceSearch("<script>", "https://example.com")).toBe("?arcade=cozy&actorSkin=arcade-bunny&stage=garden-maze");
  });
});
