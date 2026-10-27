import { describe, expect, it } from "vitest";
import { formatHealthPair, formatHealthValue } from "../src/ui/health-formatters";
import { renderArcadeProfileMarkup } from "../src/ui/arcade-profile";

describe("health formatters", () => {
  it("rounds fractional health for display without emitting decimals", () => {
    expect(formatHealthValue(74.49)).toBe("74");
    expect(formatHealthValue(74.5)).toBe("75");
    expect(formatHealthPair(74.49, 136.2)).toBe("74/136");
  });

  it("normalizes invalid and negative display values", () => {
    expect(formatHealthValue(-4)).toBe("0");
    expect(formatHealthValue(Number.NaN)).toBe("0");
    expect(formatHealthPair(Number.POSITIVE_INFINITY, Number.NaN)).toBe("0/0");
  });
});

describe("arcade HUD profile", () => {
  it("renders a positioned mascot profile instead of a legacy image", () => {
    const markup = renderArcadeProfileMarkup("player", "arcade-fox", "Turbo Fox");

    expect(markup).toContain("arcade-profile");
    expect(markup).toContain("cozy-mascot--fox");
    expect(markup).toContain('aria-label="Turbo Fox"');
    expect(markup).not.toContain("<img");
  });
});
