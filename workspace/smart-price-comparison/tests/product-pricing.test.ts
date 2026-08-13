import { describe, expect, it } from "vitest";
import {
  calculateNormalizedPrice,
  compareProducts,
  extractProductCode,
  getPurchasePrice,
} from "../src/business/product-pricing";
import type { ProductOffer } from "../src/business/types";

const product = (patch: Partial<ProductOffer> = {}): ProductOffer => ({
  id: "p1",
  code: "8801234567890",
  name: "테스트 상품",
  store: "테스트 마트",
  listPrice: 10_000,
  salePrice: 8_000,
  quantity: 400,
  unit: "g",
  ...patch,
});

describe("product price comparison", () => {
  it("uses an explicit sale price and calculates discount facts", () => {
    const result = compareProducts([product()], "100g")[0];
    expect(getPurchasePrice(result.offer)).toBe(8_000);
    expect(result.savings).toBe(2_000);
    expect(result.discountRate).toBe(20);
    expect(result.normalizedPrice).toBe(2_000);
  });

  it("supports 10g, 100g, and 10ml bases without mixing units", () => {
    expect(calculateNormalizedPrice(product(), "10g")).toBe(200);
    expect(calculateNormalizedPrice(product(), "100g")).toBe(2_000);
    expect(calculateNormalizedPrice(product(), "10ml")).toBeNull();
    expect(
      calculateNormalizedPrice(product({ unit: "ml", quantity: 1_000, salePrice: 6_000 }), "10ml"),
    ).toBe(60);
  });

  it("marks every exact tie as cheapest and excludes incompatible units", () => {
    const results = compareProducts(
      [
        product({ id: "a", salePrice: 4_000, quantity: 200 }),
        product({ id: "b", salePrice: 8_000, quantity: 400 }),
        product({ id: "c", unit: "ml", salePrice: 100, quantity: 100 }),
      ],
      "100g",
    );
    expect(results.map(({ isCheapest }) => isCheapest)).toEqual([true, true, false]);
    expect(results[2].isCompatible).toBe(false);
  });

  it("accepts manual barcodes and common QR URL code formats", () => {
    expect(extractProductCode(" 8801234567890 ")).toBe("8801234567890");
    expect(extractProductCode("https://shop.example/item?barcode=8809999000012")).toBe("8809999000012");
    expect(extractProductCode("https://id.gs1.org/01/8801111000450")).toBe("8801111000450");
    expect(extractProductCode("local-sku-A12")).toBe("local-sku-A12");
  });
});
