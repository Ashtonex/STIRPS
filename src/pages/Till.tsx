import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../db/schema";
import { closeTillSession, openTillSession, getExpectedCashCents, getCashMovementsForSession, TILL_ID } from "../db/repo";
import { useDemo } from "../app/DemoContext";
import { Card, CardHeader, Button, Badge, Dialog, Field, Input, Textarea, Toast, EmptyState, StatTile } from "../components/ui";
import { formatMoney } from "../domain/money";
import type { TillSession } from "../domain/types";

export function Till() {
  const { actor } = useDemo();
  const openSession = useLiveQuery(() => db.tillSessions.where("tillId").equals(TILL_ID).and((s) => s.status === "open").first(), [], undefined);
  const expectedCashCents = useLiveQuery(() => (openSession ? getExpectedCashCents(openSession) : undefined), [openSession], undefined);
  const cashMovements = useLiveQuery(() => (openSession ? getCashMovementsForSession(openSession.id) : undefined), [openSession], undefined);
  const closedSessions = useLiveQuery(
    () => db.tillSessions.where("status").equals("closed").toArray().then((r) => r.sort((a, b) => (a.closedAt ?? "") < (b.closedAt ?? "") ? 1 : -1)),
    [],
    undefined,
  );

  const [closeOpen, setCloseOpen] = useState(false);
  const [openFormOpen, setOpenFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Till Reconciliation</h1>
          <p className="text-sm text-[var(--color-ink-500)]">Expected cash is the opening float plus recorded cash movements — not electronic payments or unpaid credit sales.</p>
        </div>
        {openSession ? (
          <Button variant="danger" onClick={() => setCloseOpen(true)}>
            Close Till
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setOpenFormOpen(true)}>
            Open Till
          </Button>
        )}
      </div>

      {openSession ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Opening float" value={formatMoney(openSession.openingFloatCents)} hint={`Opened by ${openSession.openedBy}`} />
            <StatTile label="Cash movements" value={String(cashMovements?.length ?? 0)} hint="Recorded sales/refunds affecting cash" />
            <StatTile label="Expected cash now" value={formatMoney(expectedCashCents ?? openSession.openingFloatCents)} tone="navy" />
            <StatTile label="Opened" value={new Date(openSession.openedAt).toLocaleTimeString()} hint={new Date(openSession.openedAt).toLocaleDateString()} />
          </div>

          <Card>
            <CardHeader title="Cash movements this session" />
            {cashMovements && cashMovements.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)]">
                {cashMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium capitalize">{m.type.replace(/_/g, " ")}</div>
                      <div className="text-xs text-[var(--color-ink-500)]">
                        {m.actor} · {new Date(m.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <span className={m.amountCents >= 0 ? "font-medium text-[var(--color-success-600)]" : "font-medium text-[var(--color-danger-600)]"}>
                      {m.amountCents >= 0 ? "+" : ""}
                      {formatMoney(m.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No cash movements yet" description="Cash sales rung up on this till will appear here." />
            )}
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center">
          <EmptyState title="No till is currently open" description="Open a till with a starting float to begin recording cash sales." />
        </Card>
      )}

      <Card>
        <CardHeader title="Closed sessions" subtitle="Inspectable evidence — a closed session does not change when later activity occurs" />
        {closedSessions && closedSessions.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-500)]">
                <th className="px-5 py-2">Closed</th>
                <th className="px-5 py-2">Expected</th>
                <th className="px-5 py-2">Counted</th>
                <th className="px-5 py-2">Variance</th>
                <th className="px-5 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {closedSessions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3">{s.closedAt ? new Date(s.closedAt).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3">{formatMoney(s.expectedCashCents ?? 0)}</td>
                  <td className="px-5 py-3">{formatMoney(s.countedCashCents ?? 0)}</td>
                  <td className="px-5 py-3">
                    {(s.varianceCents ?? 0) === 0 ? <Badge tone="success">$0.00</Badge> : <Badge tone="danger">{formatMoney(s.varianceCents ?? 0)}</Badge>}
                  </td>
                  <td className="px-5 py-3 text-xs">{s.varianceReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <EmptyState title="No closed sessions yet" />
        )}
      </Card>

      {closeOpen && openSession && (
        <CloseTillDialog
          session={openSession}
          expectedCashCents={expectedCashCents ?? openSession.openingFloatCents}
          actor={actor}
          onClose={() => setCloseOpen(false)}
          onClosed={() => {
            setCloseOpen(false);
            flash("Till closed and recorded.");
          }}
        />
      )}

      {openFormOpen && (
        <OpenTillDialog
          actor={actor}
          onClose={() => setOpenFormOpen(false)}
          onOpened={() => {
            setOpenFormOpen(false);
            flash("Till opened with a fresh float.");
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function CloseTillDialog({
  session,
  expectedCashCents,
  actor,
  onClose,
  onClosed,
}: {
  session: TillSession;
  expectedCashCents: number;
  actor: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [counted, setCounted] = useState(expectedCashCents / 100);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countedCents = Math.round(counted * 100);
  const varianceCents = countedCents - expectedCashCents;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await closeTillSession(session.id, countedCents, actor, reason.trim() || undefined);
      onClosed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close the till.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Close till"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Closing…" : "Close till"}
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-md bg-[var(--color-surface)] px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-ink-500)]">Opening float</span>
          <span>{formatMoney(session.openingFloatCents)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Expected cash</span>
          <span>{formatMoney(expectedCashCents)}</span>
        </div>
      </div>

      <Field label="Physical cash counted">
        <Input type="number" min={0} step={0.01} value={counted} onChange={(e) => setCounted(Number(e.target.value))} />
      </Field>

      <div className={`mb-3 rounded-md px-3 py-2 text-sm ${varianceCents === 0 ? "bg-[var(--color-success-100)] text-[var(--color-success-600)]" : "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]"}`}>
        Variance: {varianceCents >= 0 ? "+" : ""}
        {formatMoney(varianceCents)}
      </div>

      {varianceCents !== 0 && (
        <Field label="Explanation for the variance (required)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Till was short — one cash sale's change may have been miscounted, flagged for follow-up." />
        </Field>
      )}

      {error && <p className="text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}

function OpenTillDialog({ actor, onClose, onOpened }: { actor: string; onClose: () => void; onOpened: () => void }) {
  const [floatAmount, setFloatAmount] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await openTillSession(actor, Math.round(floatAmount * 100));
      onOpened();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the till.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Open till"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Opening…" : "Open till"}
          </Button>
        </>
      }
    >
      <Field label="Opening float">
        <Input type="number" min={0} step={0.01} value={floatAmount} onChange={(e) => setFloatAmount(Number(e.target.value))} />
      </Field>
      {error && <p className="text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}
