import type { Product, SaleUnit } from "./types";

/** Resolve a quantity expressed in a sale/order unit (unit or case) to base units. */
export function toBaseUnits(product: Product, qty: number, saleUnit: SaleUnit): number {
  if (saleUnit === "case") {
    if (!product.caseUnitQty) {
      throw new Error(`${product.name} is not sold by the case`);
    }
    return qty * product.caseUnitQty;
  }
  return qty;
}

export function casesToUnits(caseUnitQty: number, cases: number): number {
  return cases * caseUnitQty;
}

export function unitsToCasesRemainder(units: number, caseUnitQty: number): { cases: number; remainder: number } {
  return { cases: Math.floor(units / caseUnitQty), remainder: units % caseUnitQty };
}
