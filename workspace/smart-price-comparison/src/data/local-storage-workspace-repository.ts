import type { IWorkspaceRepository } from "../business/ports";
import type { AppWorkspace, ProductOffer } from "../business/types";

export const WORKSPACE_STORAGE_KEY = "smart-price-comparison:workspace:v1";

const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const hasUniqueIds = (values: Array<{ id: string }>): boolean =>
  new Set(values.map(({ id }) => id)).size === values.length;

const isProduct = (value: unknown): value is ProductOffer => {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<ProductOffer>;
  return (
    typeof product.id === "string" &&
    typeof product.code === "string" &&
    typeof product.name === "string" &&
    typeof product.store === "string" &&
    isNonNegativeFinite(product.listPrice) &&
    (product.salePrice === null ||
      (isNonNegativeFinite(product.salePrice) && product.salePrice <= product.listPrice)) &&
    isPositiveFinite(product.quantity) &&
    (product.unit === "g" || product.unit === "ml")
  );
};

export const isWorkspaceV1 = (value: unknown): value is AppWorkspace => {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<AppWorkspace>;
  const menu = workspace.menuDraft;
  return (
    workspace.schemaVersion === 1 &&
    (workspace.persona === "consumer" || workspace.persona === "owner" || workspace.persona === "agency") &&
    (workspace.activeView === "dashboard" || workspace.activeView === "menu" || workspace.activeView === "products") &&
    (workspace.comparisonBasis === "10g" || workspace.comparisonBasis === "100g" || workspace.comparisonBasis === "10ml") &&
    typeof workspace.updatedAt === "string" &&
    Array.isArray(workspace.products) &&
    workspace.products.every(isProduct) &&
    hasUniqueIds(workspace.products) &&
    !!menu &&
    typeof menu.name === "string" &&
    isNonNegativeFinite(menu.salePrice) &&
    isNonNegativeFinite(menu.laborCost) &&
    isNonNegativeFinite(menu.gasCost) &&
    isNonNegativeFinite(menu.packagingCost) &&
    isNonNegativeFinite(menu.waterCost) &&
    isNonNegativeFinite(menu.electricityCost) &&
    Array.isArray(menu.ingredients) &&
    hasUniqueIds(menu.ingredients) &&
    menu.ingredients.every(
      (ingredient) =>
        !!ingredient &&
        typeof ingredient.id === "string" &&
        typeof ingredient.name === "string" &&
        isNonNegativeFinite(ingredient.cost),
    )
  );
};

export class LocalStorageWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly storage: Storage) {}

  load(): AppWorkspace | null {
    const raw = this.storage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isWorkspaceV1(parsed)) throw new Error("저장 데이터 형식이 현재 버전과 맞지 않습니다.");
    return structuredClone(parsed);
  }

  save(workspace: AppWorkspace): void {
    this.storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  }
}
