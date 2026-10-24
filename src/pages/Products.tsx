import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "../db/schema";
import { getAvailableStockMap } from "../db/repo";
import { Card, CardHeader, Badge, Input, EmptyState } from "../components/ui";
import { formatMoney } from "../domain/money";

export function Products() {
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);
  const stockMap = useLiveQuery(() => getAvailableStockMap(), [], undefined);
  const movements = useLiveQuery(() => db.stockMovements.toArray(), [], undefined);
  const [search, setSearch] = useState("");

  const batchesByProduct = useMemo(() => {
    const map = new Map<string, { batchCode: string; qty: number; expiryDate?: string }[]>();
    if (!movements) return map;
    const grouped = new Map<string, Map<string, { qty: number; expiryDate?: string }>>();
    for (const m of movements) {
      if (!m.batchCode) continue;
      const productGroup = grouped.get(m.productId) ?? new Map<string, { qty: number; expiryDate?: string }>();
      const b = productGroup.get(m.batchCode) ?? { qty: 0, expiryDate: m.expiryDate };
      b.qty += m.qtyDeltaUnits;
      if (m.expiryDate) b.expiryDate = m.expiryDate;
      productGroup.set(m.batchCode, b);
      grouped.set(m.productId, productGroup);
    }
    for (const [productId, g] of grouped) {
      map.set(
        productId,
        Array.from(g.entries())
          .filter(([, v]) => v.qty > 0)
          .map(([batchCode, v]) => ({ batchCode, qty: v.qty, expiryDate: v.expiryDate })),
      );
    }
    return map;
  }, [movements]);

  const filtered = (products ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Products &amp; Inventory</h1>
        <p className="text-sm text-[var(--color-ink-500)]">Stock on hand is derived from posted movements only — nothing here is hand-edited.</p>
      </div>

      <Input placeholder="Search by name, SKU or category…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardHeader title={`${filtered.length} product(s)`} />
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-500)]">
                <th className="px-5 py-2">Product</th>
                <th className="px-5 py-2">Category</th>
                <th className="px-5 py-2">On hand</th>
                <th className="px-5 py-2">Retail / Wholesale</th>
                <th className="px-5 py-2">Batches</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const available = stockMap?.[p.id] ?? 0;
                const low = available <= p.lowStockThreshold;
                const batches = batchesByProduct.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="border-b border-[var(--color-border)] align-top last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-[var(--color-ink-500)]">{p.sku} {p.caseUnitQty ? `· case of ${p.caseUnitQty}` : ""}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">{p.category}</td>
                    <td className="px-5 py-3">
                      {available} {p.unitLabel}(s)
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {formatMoney(p.retailPriceCents)} / {formatMoney(p.wholesalePriceCents)}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {batches.length > 0 ? (
                        batches.map((b) => (
                          <div key={b.batchCode}>
                            {b.batchCode}: {b.qty} {b.expiryDate ? `· exp. ${new Date(b.expiryDate).toLocaleDateString()}` : ""}
                          </div>
                        ))
                      ) : (
                        <span className="text-[var(--color-ink-500)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {available <= 0 ? <Badge tone="danger">Out of stock</Badge> : low ? <Badge tone="warning">Low stock</Badge> : <Badge tone="success">OK</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <EmptyState title="No products match your search" />
        )}
      </Card>
    </div>
  );
}
