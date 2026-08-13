import { describe, expect, it } from "vitest";
import { calculateMenuProfit, finiteMoney } from "../src/business/profitability";
import { createDefaultWorkspace } from "../src/data/sample-data";

describe("menu profitability", () => {
  it("adds every approved cost category and calculates profit ratios", () => {
    const result = calculateMenuProfit(createDefaultWorkspace().menuDraft);

    expect(result.ingredientCost).toBe(2_860);
    expect(result.laborCost).toBe(1_800);
    expect(result.operatingCost).toBe(1_070);
    expect(result.totalCost).toBe(5_730);
    expect(result.profit).toBe(6_770);
    expect(result.profitMargin).toBeCloseTo(54.16, 2);
    expect(result.costRate).toBeCloseTo(45.84, 2);
    expect(result.status).toBe("profit");
  });

  it("shows zero-price and loss inputs without invalid ratios", () => {
    const menu = createDefaultWorkspace().menuDraft;
    const result = calculateMenuProfit({ ...menu, salePrice: 0 });

    expect(result.profit).toBe(-5_730);
    expect(result.profitMargin).toBe(0);
    expect(result.costRate).toBe(0);
    expect(result.status).toBe("loss");
  });

  it("normalizes negative and non-finite monetary values to zero", () => {
    expect(finiteMoney(-1)).toBe(0);
    expect(finiteMoney(Number.NaN)).toBe(0);
    expect(finiteMoney(Number.POSITIVE_INFINITY)).toBe(0);
    expect(finiteMoney(120)).toBe(120);
  });
});
