import type { AppWorkspace, MenuDraft, MenuProfitResult, PriceBasis, ProductOffer, ComparedProduct } from "./types";

export interface IWorkspaceRepository {
  load(): AppWorkspace | null;
  save(workspace: AppWorkspace): void;
}

export interface IProductCatalog {
  findByCode(code: string): ProductOffer | null;
}

export type ScannerErrorCode =
  | "unsupported"
  | "permission-denied"
  | "cancelled"
  | "timed-out"
  | "unavailable";

export class ScannerError extends Error {
  constructor(
    public readonly code: ScannerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ScannerError";
  }
}

export interface IProductCodeScanner {
  isSupported(): boolean;
  scan(signal: AbortSignal, timeoutMs: number): Promise<string>;
}

export interface ISmartPriceFacade {
  calculateMenu(menu: MenuDraft): MenuProfitResult;
  compareProducts(products: ProductOffer[], basis: PriceBasis): ComparedProduct[];
  findProductByCode(code: string): ProductOffer | null;
  createDefaultWorkspace(): AppWorkspace;
  loadWorkspace(): AppWorkspace;
  saveWorkspace(workspace: AppWorkspace): void;
}

export interface SmartPriceApplication {
  facade: ISmartPriceFacade;
  scanner: IProductCodeScanner;
}
