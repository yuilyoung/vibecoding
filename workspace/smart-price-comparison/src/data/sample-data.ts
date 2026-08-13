import type { IProductCatalog } from "../business/ports";
import type { AppWorkspace, ProductOffer } from "../business/types";

export const sampleProducts: ProductOffer[] = [
  {
    id: "product-oats-450",
    code: "8801111000450",
    name: "통귀리 오트밀",
    store: "동네마트",
    listPrice: 6_900,
    salePrice: 5_900,
    quantity: 450,
    unit: "g",
  },
  {
    id: "product-oats-900",
    code: "8801111000900",
    name: "대용량 오트밀",
    store: "스마트마트",
    listPrice: 11_900,
    salePrice: 8_900,
    quantity: 900,
    unit: "g",
  },
  {
    id: "product-granola-600",
    code: "8801111000603",
    name: "견과 그래놀라",
    store: "그린마켓",
    listPrice: 9_800,
    salePrice: null,
    quantity: 600,
    unit: "g",
  },
  {
    id: "product-juice-1000",
    code: "8802222001002",
    name: "착즙 오렌지 주스",
    store: "스마트마트",
    listPrice: 7_500,
    salePrice: 6_200,
    quantity: 1_000,
    unit: "ml",
  },
];

export class SampleProductCatalog implements IProductCatalog {
  findByCode(code: string): ProductOffer | null {
    const product = sampleProducts.find((candidate) => candidate.code === code);
    return product ? { ...product } : null;
  }
}

export const createDefaultWorkspace = (): AppWorkspace => ({
  schemaVersion: 1,
  persona: "owner",
  activeView: "dashboard",
  comparisonBasis: "100g",
  menuDraft: {
    name: "시그니처 치킨 덮밥",
    salePrice: 12_500,
    ingredients: [
      { id: "ingredient-rice", name: "밥", cost: 420 },
      { id: "ingredient-chicken", name: "닭고기", cost: 1_850 },
      { id: "ingredient-sauce", name: "소스", cost: 380 },
      { id: "ingredient-garnish", name: "채소·고명", cost: 210 },
    ],
    laborCost: 1_800,
    gasCost: 320,
    packagingCost: 450,
    waterCost: 90,
    electricityCost: 210,
  },
  products: sampleProducts.slice(0, 3).map((product) => ({ ...product })),
  updatedAt: new Date(0).toISOString(),
});
