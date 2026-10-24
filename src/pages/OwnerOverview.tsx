import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../db/schema";
import { getAvailableStockMap, getPendingDiscountApprovals, getTillVarianceExceptions } from "../db/repo";
import {
  getLowStockProducts,
  getNearExpiryBatches,
  getOutstandingReceivingShortages,
  getUnresolvedStockCounts,
  getSalesSummary,
  getStockValueCents,
} from "../db/queries";
import { Card, CardHeader, StatTile, Badge, EmptyState } from "../components/ui";
import { formatMoney } from "../domain/money";

export function OwnerOverview() {
  const salesSummary = useLiveQuery(() => getSalesSummary(), [], undefined);
  const stockValueCents = useLiveQuery(() => getStockValueCents(), [], undefined);
  const lowStock = useLiveQuery(() => getLowStockProducts(), [], undefined);
  const nearExpiry = useLiveQuery(() => getNearExpiryBatches(), [], undefined);
  const shortages = useLiveQuery(() => getOutstandingReceivingShortages(), [], undefined);
  const unresolvedCounts = useLiveQuery(() => getUnresolvedStockCounts(), [], undefined);
  const pendingDiscounts = useLiveQuery(() => getPendingDiscountApprovals(), [], undefined);
  const tillVariances = useLiveQuery(() => getTillVarianceExceptions(), [], undefined);
  const stockMap = useLiveQuery(() => getAvailableStockMap(), [], undefined);
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);

  const loading = !salesSummary || !products || !stockMap;
  const exceptionCount =
    (lowStock?.length ?? 0) +
    (nearExpiry?.length ?? 0) +
    (shortages?.length ?? 0) +
    (unresolvedCounts?.length ?? 0) +
    (pendingDiscounts?.length ?? 0) +
    (tillVariances?.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--color-ink-900)]">Owner Overview</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Both partners see the same committed business records — figures below update live as transactions post.
        </p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--color-ink-500)]">Loading committed records…</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Revenue (all time)" value={formatMoney(salesSummary!.revenueCents)} hint={`${salesSummary!.salesCount} completed sale(s)`} />
            <StatTile
              label="Gross profit"
              value={formatMoney(salesSummary!.grossProfitCents)}
              hint="Revenue minus cost of goods — not net profit"
              tone="success"
            />
            <StatTile label="Stock value (at cost)" value={formatMoney(stockValueCents ?? 0)} hint={`${products!.length} active SKUs`} tone="navy" />
            <StatTile
              label="Pending exceptions"
              value={String(exceptionCount)}
              hint="Low stock, expiry, shortages, variances, approvals"
              tone={exceptionCount > 0 ? "warning" : "neutral"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Receiving shortages" subtitle="Outstanding units from partially received purchase orders" />
              {shortages && shortages.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {shortages.map((s) => (
                    <li key={s.po.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <Link to="/purchasing" className="font-medium text-[var(--color-navy-700)] hover:underline">
                          {s.po.poNumber}
                        </Link>
                        <div className="text-xs text-[var(--color-ink-500)]">Status: {s.po.status.replace("_", " ")}</div>
                      </div>
                      <Badge tone="warning">{s.outstandingUnits} units outstanding</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No outstanding shortages" description="Every purchase order is fully received." />
              )}
            </Card>

            <Card>
              <CardHeader title="Stock-count differences" subtitle="Blind counts awaiting manager review" />
              {unresolvedCounts && unresolvedCounts.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {unresolvedCounts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <Link to="/stock-count" className="font-medium text-[var(--color-navy-700)] hover:underline">
                        {c.countNumber}
                      </Link>
                      <Badge tone="warning">{c.lines.length} line(s) submitted</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nothing awaiting review" description="All submitted counts have been resolved." />
              )}
            </Card>

            <Card>
              <CardHeader title="Low-stock products" subtitle="At or below reorder point" />
              {lowStock && lowStock.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {lowStock.map((e) => (
                    <li key={e.product.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <Link to="/products" className="font-medium text-[var(--color-navy-700)] hover:underline">
                        {e.product.name}
                      </Link>
                      <Badge tone="danger">
                        {e.available} {e.product.unitLabel}(s) left
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No low-stock products" description="Every product is above its reorder point." />
              )}
            </Card>

            <Card>
              <CardHeader title="Near-expiry batches" subtitle="Batches within 5 days of expiry" />
              {nearExpiry && nearExpiry.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {nearExpiry.map((e) => (
                    <li key={`${e.product.id}-${e.batchCode}`} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <Link to="/products" className="font-medium text-[var(--color-navy-700)] hover:underline">
                          {e.product.name}
                        </Link>
                        <div className="text-xs text-[var(--color-ink-500)]">Batch {e.batchCode} · {e.qty} units</div>
                      </div>
                      <Badge tone={e.daysRemaining <= 1 ? "danger" : "warning"}>
                        {e.daysRemaining <= 0 ? "Expires today" : `${e.daysRemaining}d remaining`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No near-expiry batches" description="Nothing is within the 5-day expiry window." />
              )}
            </Card>

            <Card>
              <CardHeader title="Discount approvals awaiting manager" subtitle="A cashier's discount over the authority threshold" />
              {pendingDiscounts && pendingDiscounts.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {pendingDiscounts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <Link to="/approvals" className="font-medium text-[var(--color-navy-700)] hover:underline">
                          {formatMoney(a.requestedDiscountCents)} discount
                        </Link>
                        <div className="text-xs text-[var(--color-ink-500)]">Requested by {a.requestedBy}</div>
                      </div>
                      <Badge tone="warning">Pending</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No discounts awaiting approval" />
              )}
            </Card>

            <Card>
              <CardHeader title="Till differences" subtitle="Closed till sessions with a recorded cash variance" />
              {tillVariances && tillVariances.length > 0 ? (
                <ul className="divide-y divide-[var(--color-border)]">
                  {tillVariances.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <Link to="/till" className="font-medium text-[var(--color-navy-700)] hover:underline">
                          Till closed {s.closedAt ? new Date(s.closedAt).toLocaleString() : ""}
                        </Link>
                        <div className="text-xs text-[var(--color-ink-500)]">{s.varianceReason}</div>
                      </div>
                      <Badge tone="danger">{formatMoney(s.varianceCents ?? 0)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No cash shortages" description="Every closed till balanced to the expected amount." />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
