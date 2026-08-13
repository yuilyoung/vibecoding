import { finiteMoney } from "./profitability";
import type {
  ComparedProduct,
  MeasureUnit,
  PriceBasis,
  ProductOffer,
} from "./types";

const BASIS: Record<PriceBasis, { amount: number; unit: MeasureUnit }> = {
  "10g": { amount: 10, unit: "g" },
  "100g": { amount: 100, unit: "g" },
  "10ml": { amount: 10, unit: "ml" },
};

export const getPurchasePrice = (offer: ProductOffer): number =>
  offer.salePrice === null ? finiteMoney(offer.listPrice) : finiteMoney(offer.salePrice);

export const calculateNormalizedPrice = (
  offer: ProductOffer,
  basis: PriceBasis,
): number | null => {
  const rule = BASIS[basis];
  const quantity = finiteMoney(offer.quantity);
  if (offer.unit !== rule.unit || quantity === 0) return null;
  return (getPurchasePrice(offer) / quantity) * rule.amount;
};

export const compareProducts = (
  offers: ProductOffer[],
  basis: PriceBasis,
): ComparedProduct[] => {
  const prepared = offers.map((offer) => {
    const listPrice = finiteMoney(offer.listPrice);
    const purchasePrice = getPurchasePrice(offer);
    const savings = Math.max(0, listPrice - purchasePrice);
    const normalizedPrice = calculateNormalizedPrice(offer, basis);
    return {
      offer,
      purchasePrice,
      savings,
      discountRate: listPrice === 0 ? 0 : (savings / listPrice) * 100,
      normalizedPrice,
      isCompatible: normalizedPrice !== null,
      isCheapest: false,
    } satisfies ComparedProduct;
  });

  const prices = prepared
    .map((product) => product.normalizedPrice)
    .filter((price): price is number => price !== null);
  const cheapest = prices.length > 0 ? Math.min(...prices) : null;

  return prepared.map((product) => ({
    ...product,
    isCheapest:
      cheapest !== null &&
      product.normalizedPrice !== null &&
      Math.abs(product.normalizedPrice - cheapest) < 0.000_001,
  }));
};

export const extractProductCode = (rawValue: string): string => {
  const raw = rawValue.trim();
  if (!raw) return "";
  if (/^\d{8,14}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    for (const key of ["gtin", "barcode", "code"]) {
      const candidate = url.searchParams.get(key)?.trim();
      if (candidate) return candidate;
    }
    const gs1 = url.pathname.match(/\/01\/(\d{8,14})(?:\/|$)/);
    if (gs1) return gs1[1];
    const lastNumeric = url.pathname.match(/(\d{8,14})(?:\/)?$/);
    if (lastNumeric) return lastNumeric[1];
  } catch {
    // Plain non-URL codes are still useful to a local catalogue.
  }

  return raw.slice(0, 128);
};
