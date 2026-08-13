import type { MenuDraft, MenuProfitResult } from "./types";

export const finiteMoney = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

export const calculateMenuProfit = (menu: MenuDraft): MenuProfitResult => {
  const salePrice = finiteMoney(menu.salePrice);
  const ingredientCost = menu.ingredients.reduce(
    (sum, ingredient) => sum + finiteMoney(ingredient.cost),
    0,
  );
  const laborCost = finiteMoney(menu.laborCost);
  const operatingCost =
    finiteMoney(menu.gasCost) +
    finiteMoney(menu.packagingCost) +
    finiteMoney(menu.waterCost) +
    finiteMoney(menu.electricityCost);
  const totalCost = ingredientCost + laborCost + operatingCost;
  const profit = salePrice - totalCost;

  return {
    ingredientCost,
    laborCost,
    operatingCost,
    totalCost,
    profit,
    profitMargin: salePrice === 0 ? 0 : (profit / salePrice) * 100,
    costRate: salePrice === 0 ? 0 : (totalCost / salePrice) * 100,
    status: profit > 0 ? "profit" : profit < 0 ? "loss" : "break-even",
  };
};
