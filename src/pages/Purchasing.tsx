import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "../db/schema";
import { createPurchaseOrder, receiveGoods, DuplicateOperationError } from "../db/repo";
import { useDemo } from "../app/DemoContext";
import { Card, CardHeader, Button, Badge, Dialog, Field, Input, Select, Toast, EmptyState } from "../components/ui";
import type { PurchaseOrder, ReceiptLine } from "../domain/types";

function poBadgeTone(status: PurchaseOrder["status"]): "neutral" | "warning" | "success" | "navy" {
  switch (status) {
    case "received":
      return "success";
    case "partially_received":
      return "warning";
    case "submitted":
      return "navy";
    default:
      return "neutral";
  }
}

export function Purchasing() {
  const { actor } = useDemo();
  const pos = useLiveQuery(() => db.purchaseOrders.orderBy("createdAt").reverse().toArray(), [], undefined);
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), [], undefined);
  const receipts = useLiveQuery(() => db.receipts.toArray(), [], undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const supplierMap = useMemo(() => new Map((suppliers ?? []).map((s) => [s.id, s])), [suppliers]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Purchasing &amp; Receiving</h1>
          <p className="text-sm text-[var(--color-ink-500)]">Order from suppliers, then receive goods — partial deliveries and shortages are tracked automatically.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + New Purchase Order
        </Button>
      </div>

      <Card>
        <CardHeader title="Purchase orders" subtitle="Most recent first" />
        {pos && pos.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-500)]">
                <th className="px-5 py-2">PO #</th>
                <th className="px-5 py-2">Supplier</th>
                <th className="px-5 py-2">Lines</th>
                <th className="px-5 py-2">Outstanding</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => {
                const outstanding = po.lines.reduce((s, l) => s + (l.orderedUnits - l.receivedUnits), 0);
                return (
                  <tr key={po.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-5 py-3 font-medium">{po.poNumber}</td>
                    <td className="px-5 py-3">{supplierMap.get(po.supplierId)?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      {po.lines.map((l) => (
                        <div key={l.productId} className="text-xs text-[var(--color-ink-700)]">
                          {productMap.get(l.productId)?.name ?? l.productId}: {l.receivedUnits}/{l.orderedUnits} units
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3">{outstanding > 0 ? <Badge tone="warning">{outstanding} units</Badge> : <Badge tone="success">Complete</Badge>}</td>
                    <td className="px-5 py-3">
                      <Badge tone={poBadgeTone(po.status)}>{po.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {po.status !== "received" && po.status !== "closed" && (
                        <Button variant="secondary" onClick={() => setReceiveTarget(po)}>
                          Receive goods
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <EmptyState title="No purchase orders yet" description="Create one to start the purchasing workflow." />
        )}
      </Card>

      <Card>
        <CardHeader title="Receipt history" subtitle="Traceable to the purchase order that generated them" />
        {receipts && receipts.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-500)]">
                <th className="px-5 py-2">Receipt #</th>
                <th className="px-5 py-2">PO</th>
                <th className="px-5 py-2">Received</th>
                <th className="px-5 py-2">Shortage</th>
                <th className="px-5 py-2">Received by</th>
              </tr>
            </thead>
            <tbody>
              {receipts
                .slice()
                .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
                .map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-5 py-3 font-medium">{r.receiptNumber}</td>
                    <td className="px-5 py-3">{pos?.find((p) => p.id === r.poId)?.poNumber ?? r.poId}</td>
                    <td className="px-5 py-3">
                      {r.lines.map((l) => (
                        <div key={l.productId} className="text-xs">
                          {productMap.get(l.productId)?.name ?? l.productId}: {l.qtyReceivedUnits} units
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3">{r.hasShortage ? <Badge tone="warning">Shortage</Badge> : <Badge tone="success">Full</Badge>}</td>
                    <td className="px-5 py-3">{r.receivedBy}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        ) : (
          <EmptyState title="No receipts yet" />
        )}
      </Card>

      {createOpen && (
        <CreatePoDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          products={products ?? []}
          suppliers={suppliers ?? []}
          actor={actor}
          onCreated={(po) => {
            flash(`${po.poNumber} created and submitted to supplier.`);
            setCreateOpen(false);
          }}
        />
      )}

      {receiveTarget && (
        <ReceiveDialog
          po={receiveTarget}
          productMap={productMap}
          actor={actor}
          onClose={() => setReceiveTarget(null)}
          onReceived={(receipt) => {
            flash(receipt.hasShortage ? `${receipt.receiptNumber} posted with a shortage — flagged in exceptions.` : `${receipt.receiptNumber} posted in full.`);
            setReceiveTarget(null);
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function CreatePoDialog({
  open,
  onClose,
  products,
  suppliers,
  actor,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  products: { id: string; name: string; caseUnitQty?: number; unitLabel: string }[];
  suppliers: { id: string; name: string }[];
  actor: string;
  onCreated: (po: PurchaseOrder) => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [orderedCases, setOrderedCases] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);
  const caseUnitQty = product?.caseUnitQty ?? 1;
  const totalUnits = orderedCases * caseUnitQty;

  async function submit() {
    if (!supplierId || !productId || orderedCases <= 0) {
      setError("Select a supplier, product and a positive quantity.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const po = await createPurchaseOrder({
        supplierId,
        lines: [{ productId, orderedCases, orderedUnits: totalUnits }],
        createdBy: actor,
        operationId: `create-po-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onCreated(po);
    } catch (e) {
      if (e instanceof DuplicateOperationError) {
        setError("This order was already submitted.");
      } else {
        setError(e instanceof Error ? e.message : "Could not create purchase order.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New purchase order"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit order"}
          </Button>
        </>
      }
    >
      <Field label="Supplier">
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Product">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`Ordered cases (${caseUnitQty} ${product?.unitLabel ?? "unit"}s per case)`}>
        <Input type="number" min={1} value={orderedCases} onChange={(e) => setOrderedCases(Number(e.target.value))} />
      </Field>
      <p className="text-xs text-[var(--color-ink-500)]">
        Total ordered: <span className="font-medium text-[var(--color-ink-900)]">{totalUnits} {product?.unitLabel}(s)</span>
      </p>
      {error && <p className="mt-2 text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}

function ReceiveDialog({
  po,
  productMap,
  actor,
  onClose,
  onReceived,
}: {
  po: PurchaseOrder;
  productMap: Map<string, { name: string; unitLabel: string; caseUnitQty?: number }>;
  actor: string;
  onClose: () => void;
  onReceived: (receipt: { receiptNumber: string; hasShortage: boolean }) => void;
}) {
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const line of po.lines) init[line.productId] = line.orderedUnits - line.receivedUnits;
    return init;
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const lines: ReceiptLine[] = po.lines
        .map((l) => ({ productId: l.productId, qtyReceivedUnits: qtyByProduct[l.productId] ?? 0 }))
        .filter((l) => l.qtyReceivedUnits > 0);
      if (lines.length === 0) {
        setError("Enter at least one received quantity.");
        setSubmitting(false);
        return;
      }
      const receipt = await receiveGoods({
        poId: po.id,
        lines,
        receivedBy: actor,
        shortageNotes: notes || undefined,
        operationId: `receive-${po.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onReceived(receipt);
    } catch (e) {
      if (e instanceof DuplicateOperationError) {
        setError("This receipt was already posted.");
      } else {
        setError(e instanceof Error ? e.message : "Could not post receipt.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Receive goods — ${po.poNumber}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Posting…" : "Post receipt"}
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--color-ink-500)]">
            <th className="py-2">Product</th>
            <th className="py-2">Ordered</th>
            <th className="py-2">Already received</th>
            <th className="py-2">Receiving now</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line) => {
            const product = productMap.get(line.productId);
            const remaining = line.orderedUnits - line.receivedUnits;
            return (
              <tr key={line.productId} className="border-t border-[var(--color-border)]">
                <td className="py-2 font-medium">{product?.name ?? line.productId}</td>
                <td className="py-2">{line.orderedUnits} {product?.unitLabel}(s)</td>
                <td className="py-2">{line.receivedUnits}</td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    value={qtyByProduct[line.productId] ?? 0}
                    onChange={(e) =>
                      setQtyByProduct((prev) => ({ ...prev, [line.productId]: Math.min(remaining, Math.max(0, Number(e.target.value))) }))
                    }
                    className="w-28"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <Field label="Shortage / receiving notes (optional)">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Supplier short-shipped 1 case" />
      </Field>

      {error && <p className="mt-2 text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}
