import type { SmartPriceApplication } from "./business/ports";
import { SmartPriceFacade } from "./business/smart-price-facade";
import { BarcodeDetectorScanner } from "./data/barcode-detector-scanner";
import { LocalStorageWorkspaceRepository } from "./data/local-storage-workspace-repository";
import { createDefaultWorkspace, SampleProductCatalog } from "./data/sample-data";

export const createApplicationServices = (): SmartPriceApplication => {
  const repository = new LocalStorageWorkspaceRepository(window.localStorage);
  return {
    facade: new SmartPriceFacade(repository, new SampleProductCatalog(), createDefaultWorkspace),
    scanner: new BarcodeDetectorScanner(),
  };
};
