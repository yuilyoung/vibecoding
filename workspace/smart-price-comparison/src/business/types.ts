export type Persona = "consumer" | "owner" | "agency";
export type AppView = "dashboard" | "menu" | "products";
export type MeasureUnit = "g" | "ml";
export type PriceBasis = "10g" | "100g" | "10ml";

export interface MenuIngredient {
  id: string;
  name: string;
  cost: number;
}

export interface MenuDraft {
  name: string;
  salePrice: number;
  ingredients: MenuIngredient[];
  laborCost: number;
  gasCost: number;
  packagingCost: number;
  waterCost: number;
  electricityCost: number;
}

export interface MenuProfitResult {
  ingredientCost: number;
  laborCost: number;
  operatingCost: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  costRate: number;
  status: "profit" | "break-even" | "loss";
}

export interface ProductOffer {
  id: string;
  code: string;
  name: string;
  store: string;
  listPrice: number;
  salePrice: number | null;
  quantity: number;
  unit: MeasureUnit;
}

export interface ComparedProduct {
  offer: ProductOffer;
  purchasePrice: number;
  savings: number;
  discountRate: number;
  normalizedPrice: number | null;
  isCompatible: boolean;
  isCheapest: boolean;
}

export interface AppWorkspace {
  schemaVersion: 1;
  persona: Persona;
  activeView: AppView;
  menuDraft: MenuDraft;
  products: ProductOffer[];
  comparisonBasis: PriceBasis;
  updatedAt: string;
}
