import { db } from "./schema";
import { getAvailableStockMap } from "./repo";
import type { Product, PurchaseOrder, Sale, StockCount } from "../domain/types";

export interface LowStockEntry {
  product: Product;
  available: number;
}

export async function getLowStockProducts(): Promise<LowStockEntry[]> {
  const [products, stockMap] = await Promise.all([db.products.toArray(), getAvailableStockMap()]);
  return products
    .filter((p) => p.active)
    .map((p) => ({ product: p, available: stockMap[p.id] ?? 0 }))
    .filter((e) => e.available <= e.product.lowStockThreshold)
    .sort((a, b) => a.available - b.available);
}

export interface NearExpiryEntry {
  product: Product;
  batchCode: string;
  qty: number;
  expiryDate: string;
  daysRemaining: number;
}

const NEAR_EXPIRY_WINDOW_DAYS = 5;

export async function getNearExpiryBatches(): Promise<NearExpiryEntry[]> {
  const [products, movements] = await Promise.all([db.products.toArray(), db.stockMovements.toArray()]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const byKey = new Map<string, { productId: string; batchCode: string; qty: number; expiryDate?: string }>();

  for (const m of movements) {
    if (!m.batchCode) continue;
    const key = `${m.productId}::${m.batchCode}`;
    const current = byKey.get(key) ?? { productId: m.productId, batchCode: m.batchCode, qty: 0, expiryDate: m.expiryDate };
    current.qty += m.qtyDeltaUnits;
    if (m.expiryDate) current.expiryDate = m.expiryDate;
    byKey.set(key, current);
  }

  const now = Date.now();
  const entries: NearExpiryEntry[] = [];
  for (const b of byKey.values()) {
    if (b.qty <= 0 || !b.expiryDate) continue;
    const product = productMap.get(b.productId);
    if (!product) continue;
    const daysRemaining = Math.ceil((new Date(b.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= NEAR_EXPIRY_WINDOW_DAYS) {
      entries.push({ product, batchCode: b.batchCode, qty: b.qty, expiryDate: b.expiryDate, daysRemaining });
    }
  }
  return entries.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export interface ShortagePoEntry {
  po: PurchaseOrder;
  outstandingUnits: number;
}

export async function getOutstandingReceivingShortages(): Promise<ShortagePoEntry[]> {
  const pos = await db.purchaseOrders.toArray();
  return pos
    .map((po) => ({
      po,
      outstandingUnits: po.lines.reduce((sum, l) => sum + (l.orderedUnits - l.receivedUnits), 0),
    }))
    .filter((e) => e.outstandingUnits > 0 && (e.po.status === "partially_received" || e.po.status === "submitted"))
    .sort((a, b) => b.outstandingUnits - a.outstandingUnits);
}

export async function getUnresolvedStockCounts(): Promise<StockCount[]> {
  return db.stockCounts.where("status").equals("submitted").toArray();
}

export interface SalesSummary {
  periodLabel: string;
  salesCount: number;
  revenueCents: number;
  cogsCents: number;
  grossProfitCents: number;
}

export async function getSalesSummary(sinceIso?: string): Promise<SalesSummary> {
  const [sales, products] = await Promise.all([db.sales.toArray(), db.products.toArray()]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const filtered = sinceIso ? sales.filter((s) => s.createdAt >= sinceIso) : sales;
  const completed = filtered.filter((s) => s.status === "completed");

  let revenueCents = 0;
  let cogsCents = 0;
  for (const sale of completed) {
    revenueCents += sale.totalCents;
    for (const line of sale.lines) {
      const product = productMap.get(line.productId);
      if (!product) continue;
      cogsCents += product.costCents * line.qtyBaseUnits;
    }
  }

  return {
    periodLabel: sinceIso ? "Since seed" : "All time",
    salesCount: completed.length,
    revenueCents,
    cogsCents,
    grossProfitCents: revenueCents - cogsCents,
  };
}

export async function getStockValueCents(): Promise<number> {
  const [products, stockMap] = await Promise.all([db.products.toArray(), getAvailableStockMap()]);
  return products.reduce((sum, p) => sum + (stockMap[p.id] ?? 0) * p.costCents, 0);
}

export function salesByProduct(sales: Sale[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.qtyBaseUnits);
    }
  }
  return map;
}
