import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "../db/schema";
import { createStockCount, submitStockCount, approveStockCount, rejectStockCount } from "../db/repo";
import { useDemo } from "../app/DemoContext";
import { Card, CardHeader, Button, Badge, Dialog, Field, Input, Textarea, Toast, EmptyState } from "../components/ui";
import type { StockCount, StockCountStatus } from "../domain/types";

function statusTone(status: StockCountStatus): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "submitted":
      return "warning";
    default:
      return "neutral";
  }
}

export function StockCountPage() {
  const { actor, role } = useDemo();
  const counts = useLiveQuery(() => db.stockCounts.orderBy("createdAt").reverse().toArray(), [], undefined);
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);

  const [startOpen, setStartOpen] = useState(false);
  const [countTarget, setCountTarget] = useState<StockCount | null>(null);
  const [reviewTarget, setReviewTarget] = useState<StockCount | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const canReview = role === "manager" || role === "owner";

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Blind Stock Count</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            The counter enters physical quantities without seeing the system's expected quantity. Submitting reveals the variance for manager review.
          </p>
        </div>
        <Button variant="primary" onClick={() => setStartOpen(true)}>
          + Start blind count
        </Button>
      </div>

      <Card>
        <CardHeader title="Stock counts" />
        {counts && counts.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-500)]">
                <th className="px-5 py-2">Count #</th>
                <th className="px-5 py-2">Products</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Created by</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium">{c.countNumber}</td>
                  <td className="px-5 py-3">{c.lines.length} product(s)</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-5 py-3">{c.createdBy}</td>
                  <td className="px-5 py-3 text-right">
                    {c.status === "draft" && (
                      <Button variant="secondary" onClick={() => setCountTarget(c)}>
                        Enter counts
                      </Button>
                    )}
                    {c.status === "submitted" && canReview && (
                      <Button variant="secondary" onClick={() => setReviewTarget(c)}>
                        Review variance
                      </Button>
                    )}
                    {c.status === "submitted" && !canReview && <span className="text-xs text-[var(--color-ink-500)]">Awaiting manager review</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <EmptyState title="No stock counts yet" description="Start a blind count to reconcile physical stock." />
        )}
      </Card>

      {startOpen && (
        <StartCountDialog
          products={products ?? []}
          actor={actor}
          onClose={() => setStartOpen(false)}
          onCreated={(sc) => {
            setStartOpen(false);
            flash(`${sc.countNumber} started for ${sc.lines.length} product(s).`);
          }}
        />
      )}

      {countTarget && (
        <EnterCountsDialog
          count={countTarget}
          productMap={productMap}
          actor={actor}
          onClose={() => setCountTarget(null)}
          onSubmitted={(sc) => {
            setCountTarget(null);
            flash(`${sc.countNumber} submitted — variance now visible to the reviewer.`);
          }}
        />
      )}

      {reviewTarget && (
        <ReviewCountDialog
          count={reviewTarget}
          productMap={productMap}
          actor={actor}
          onClose={() => setReviewTarget(null)}
          onDecided={(sc) => {
            setReviewTarget(null);
            flash(sc.status === "approved" ? `${sc.countNumber} approved — adjustment posted.` : `${sc.countNumber} rejected.`);
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function StartCountDialog({
  products,
  actor,
  onClose,
  onCreated,
}: {
  products: { id: string; name: string; category: string }[];
  actor: string;
  onClose: () => void;
  onCreated: (sc: StockCount) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(products.map((p) => p.id)));
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    const sc = await createStockCount(Array.from(selected), actor);
    setSubmitting(false);
    onCreated(sc);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Start blind stock count"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting || selected.size === 0}>
            {submitting ? "Starting…" : `Start count (${selected.size})`}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-[var(--color-ink-500)]">Select the products to include in this count.</p>
      <div className="grid grid-cols-2 gap-1">
        {products.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-surface)]">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
    </Dialog>
  );
}

function EnterCountsDialog({
  count,
  productMap,
  actor,
  onClose,
  onSubmitted,
}: {
  count: StockCount;
  productMap: Map<string, { name: string; unitLabel: string }>;
  actor: string;
  onClose: () => void;
  onSubmitted: (sc: StockCount) => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const l of count.lines) init[l.productId] = 0;
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const sc = await submitStockCount(count.id, values, actor);
      onSubmitted(sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit count.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Enter physical counts — ${count.countNumber}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit count"}
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-md bg-[var(--color-warning-100)] px-3 py-2 text-xs text-[var(--color-warning-600)]">
        This is a blind count: the system's expected quantity is hidden until you submit.
      </p>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--color-ink-500)]">
            <th className="py-2">Product</th>
            <th className="py-2">Counted quantity</th>
          </tr>
        </thead>
        <tbody>
          {count.lines.map((l) => {
            const product = productMap.get(l.productId);
            return (
              <tr key={l.productId} className="border-t border-[var(--color-border)]">
                <td className="py-2">{product?.name ?? l.productId}</td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    value={values[l.productId] ?? 0}
                    onChange={(e) => setValues((prev) => ({ ...prev, [l.productId]: Math.max(0, Number(e.target.value)) }))}
                    className="w-28"
                  />
                  <span className="ml-2 text-xs text-[var(--color-ink-500)]">{product?.unitLabel}(s)</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}

function ReviewCountDialog({
  count,
  productMap,
  actor,
  onClose,
  onDecided,
}: {
  count: StockCount;
  productMap: Map<string, { name: string; unitLabel: string }>;
  actor: string;
  onClose: () => void;
  onDecided: (sc: StockCount) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "approve" | "reject") {
    if (!reason.trim()) {
      setError("A reason is required before approving or rejecting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sc = kind === "approve" ? await approveStockCount(count.id, actor, reason.trim()) : await rejectStockCount(count.id, actor, reason.trim());
      onDecided(sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the decision.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Review variance — ${count.countNumber}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => decide("reject")} disabled={submitting}>
            Reject
          </Button>
          <Button variant="primary" onClick={() => decide("approve")} disabled={submitting}>
            Approve adjustment
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--color-ink-500)]">
            <th className="py-2">Product</th>
            <th className="py-2">Expected</th>
            <th className="py-2">Counted</th>
            <th className="py-2">Variance</th>
          </tr>
        </thead>
        <tbody>
          {count.lines.map((l) => (
            <tr key={l.productId} className="border-t border-[var(--color-border)]">
              <td className="py-2">{productMap.get(l.productId)?.name ?? l.productId}</td>
              <td className="py-2">{l.expectedUnits}</td>
              <td className="py-2">{l.countedUnits}</td>
              <td className="py-2">
                {l.varianceUnits === 0 ? (
                  <Badge tone="success">0</Badge>
                ) : (
                  <Badge tone={(l.varianceUnits ?? 0) < 0 ? "danger" : "warning"}>{(l.varianceUnits ?? 0) > 0 ? "+" : ""}{l.varianceUnits}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <Field label="Reviewer reason (required)">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Confirmed recount, approving adjustment to actual." />
      </Field>
      {error && <p className="text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}
