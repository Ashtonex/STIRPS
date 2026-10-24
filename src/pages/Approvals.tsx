import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db } from "../db/schema";
import { decideDiscountApproval } from "../db/repo";
import { useDemo } from "../app/DemoContext";
import { Card, CardHeader, Button, Badge, Dialog, Field, Textarea, Toast, EmptyState } from "../components/ui";
import { formatMoney } from "../domain/money";
import type { DiscountApproval, DiscountApprovalStatus } from "../domain/types";

function statusTone(status: DiscountApprovalStatus): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "warning";
  }
}

export function Approvals() {
  const { actor, role } = useDemo();
  const approvals = useLiveQuery(() => db.discountApprovals.orderBy("requestedAt").reverse().toArray(), [], undefined);
  const [decideTarget, setDecideTarget] = useState<DiscountApproval | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canDecide = role === "manager" || role === "owner";

  const pending = useMemo(() => (approvals ?? []).filter((a) => a.status === "pending"), [approvals]);
  const decided = useMemo(() => (approvals ?? []).filter((a) => a.status !== "pending"), [approvals]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Discount Approvals</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          A cashier's discount above the {15}% threshold is held here until a manager decides it — the exact basket and reason, not just a number.
        </p>
      </div>

      <Card>
        <CardHeader title="Pending requests" subtitle={canDecide ? "Approve or reject, with a reason" : "Only a manager or owner can decide these"} />
        {pending.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {pending.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    Discount {formatMoney(a.requestedDiscountCents)} on a {formatMoney(a.subtotalCents)} sale ({((a.requestedDiscountCents / a.subtotalCents) * 100).toFixed(0)}%)
                  </div>
                  <div className="text-xs text-[var(--color-ink-500)]">
                    Requested by {a.requestedBy} · {new Date(a.requestedAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs italic text-[var(--color-ink-700)]">"{a.reason}"</div>
                </div>
                {canDecide ? (
                  <Button variant="secondary" onClick={() => setDecideTarget(a)}>
                    Review
                  </Button>
                ) : (
                  <Badge tone="warning">Pending</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No pending discount requests" />
        )}
      </Card>

      <Card>
        <CardHeader title="Decision history" />
        {decided.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {decided.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    Discount {formatMoney(a.requestedDiscountCents)} on a {formatMoney(a.subtotalCents)} sale
                  </div>
                  <div className="text-xs text-[var(--color-ink-500)]">
                    {a.decidedBy} · {a.decidedAt ? new Date(a.decidedAt).toLocaleString() : ""} — {a.decisionReason}
                  </div>
                </div>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No decisions yet" />
        )}
      </Card>

      {decideTarget && (
        <DecideDialog
          approval={decideTarget}
          actor={actor}
          onClose={() => setDecideTarget(null)}
          onDecided={(a) => {
            setDecideTarget(null);
            flash(a.status === "approved" ? "Discount approved — the cashier can now complete the sale." : "Discount rejected.");
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function DecideDialog({
  approval,
  actor,
  onClose,
  onDecided,
}: {
  approval: DiscountApproval;
  actor: string;
  onClose: () => void;
  onDecided: (a: DiscountApproval) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    if (!reason.trim()) {
      setError("A decision reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await decideDiscountApproval(approval.id, decision, actor, reason.trim());
      onDecided(updated);
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
      title="Review discount request"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => decide("rejected")} disabled={submitting}>
            Reject
          </Button>
          <Button variant="primary" onClick={() => decide("approved")} disabled={submitting}>
            Approve
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-md bg-[var(--color-surface)] px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-ink-500)]">Sale subtotal</span>
          <span className="font-medium">{formatMoney(approval.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-ink-500)]">Requested discount</span>
          <span className="font-medium">{formatMoney(approval.requestedDiscountCents)} ({((approval.requestedDiscountCents / approval.subtotalCents) * 100).toFixed(1)}%)</span>
        </div>
        <div className="mt-2 text-xs text-[var(--color-ink-500)]">Requested by {approval.requestedBy}</div>
        <div className="mt-1 text-xs italic">"{approval.reason}"</div>
      </div>

      <Field label="Decision reason (required)">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Approved — regular wholesale customer, within monthly volume discount policy." />
      </Field>
      {error && <p className="text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}
