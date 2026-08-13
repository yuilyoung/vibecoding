import { resolveDamageNumber } from "../src/domain/feedback/DamageNumberLogic";

describe("DamageNumberLogic", () => {
  it("returns grey small text for zero damage", () => {
    const config = resolveDamageNumber(0, false);
    expect(config.text).toBe("0");
    expect(config.color).toBe("#aaaaaa");
    expect(config.fontSize).toBe(12);
    expect(config.floatDistance).toBe(20);
    expect(config.durationMs).toBe(400);
  });

  it("returns grey small text for negative damage", () => {
    const config = resolveDamageNumber(-5, false);
    expect(config.text).toBe("0");
    expect(config.color).toBe("#aaaaaa");
    expect(config.fontSize).toBe(12);
  });

  it("returns white 14px text for normal damage", () => {
    const config = resolveDamageNumber(25, false);
    expect(config.text).toBe("25");
    expect(config.color).toBe("#ffffff");
    expect(config.fontSize).toBe(14);
    expect(config.floatDistance).toBe(28);
    expect(config.durationMs).toBe(600);
  });

  it("returns orange 14px text for self-harm damage", () => {
    const config = resolveDamageNumber(25, false, true);
    expect(config.text).toBe("25");
    expect(config.color).toBe("#ff8844");
    expect(config.fontSize).toBe(14);
    expect(config.floatDistance).toBe(28);
    expect(config.durationMs).toBe(600);
  });

  it("returns yellow 18px text with longer duration for critical damage", () => {
    const config = resolveDamageNumber(50, true);
    expect(config.text).toBe("50");
    expect(config.color).toBe("#ffcc00");
    expect(config.fontSize).toBe(18);
    expect(config.floatDistance).toBe(35);
    expect(config.durationMs).toBe(700);
  });

  it("uses critical styling for critical self-harm damage", () => {
    const config = resolveDamageNumber(50, true, true);
    expect(config.text).toBe("50");
    expect(config.color).toBe("#ffcc00");
    expect(config.fontSize).toBe(18);
    expect(config.floatDistance).toBe(35);
    expect(config.durationMs).toBe(700);
  });

  it("text matches damage value as string", () => {
    expect(resolveDamageNumber(1, false).text).toBe("1");
    expect(resolveDamageNumber(999, false).text).toBe("999");
    expect(resolveDamageNumber(42, true).text).toBe("42");
  });

  it("zero damage ignores isCritical flag", () => {
    const config = resolveDamageNumber(0, true);
    expect(config.color).toBe("#aaaaaa");
    expect(config.fontSize).toBe(12);
  });
});
