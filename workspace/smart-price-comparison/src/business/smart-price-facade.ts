import type { IProductCatalog, ISmartPriceFacade, IWorkspaceRepository } from "./ports";
import { calculateMenuProfit } from "./profitability";
import { compareProducts } from "./product-pricing";
import type { AppWorkspace, MenuDraft, PriceBasis, ProductOffer } from "./types";

export class SmartPriceFacade implements ISmartPriceFacade {
  constructor(
    private readonly repository: IWorkspaceRepository,
    private readonly productCatalog: IProductCatalog,
    private readonly makeDefaultWorkspace: () => AppWorkspace,
  ) {}

  calculateMenu(menu: MenuDraft) {
    return calculateMenuProfit(menu);
  }

  compareProducts(products: ProductOffer[], basis: PriceBasis) {
    return compareProducts(products, basis);
  }

  findProductByCode(code: string): ProductOffer | null {
    return this.productCatalog.findByCode(code);
  }

  createDefaultWorkspace(): AppWorkspace {
    return this.makeDefaultWorkspace();
  }

  loadWorkspace(): AppWorkspace {
    return this.repository.load() ?? this.makeDefaultWorkspace();
  }

  saveWorkspace(workspace: AppWorkspace): void {
    this.repository.save({ ...workspace, updatedAt: new Date().toISOString() });
  }
}
