import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db } from "../db/schema";
import {
  getAvailableStockMap,
  postSale,
  InsufficientStockError,
  DuplicateOperationError,
  DiscountApprovalRequiredError,
  TILL_ID,
  DISCOUNT_APPROVAL_THRESHOLD_PCT,
  computeBasketHash,
  requestDiscountApproval,
} from "../db/repo";
import { usePosCart } from "../app/PosCartContext";
import { useDemo } from "../app/DemoContext";
import { Card, CardHeader, Button, Dialog, Field, Input, Select, Textarea, Toast, EmptyState } from "../components/ui";
import { formatMoney } from "../domain/money";
import type { DemoRole, PaymentMethod, Product, Sale } from "../domain/types";

export function Pos() {
  const { actor, role } = useDemo();
  const cart = usePosCart();
  const products = useLiveQuery(() => db.products.toArray(), [], undefined);
  const customers = useLiveQuery(() => db.customers.toArray(), [], undefined);
  const stockMap = useLiveQuery(() => getAvailableStockMap(), [], undefined);
  const tillSession = useLiveQuery(() => db.tillSessions.where("tillId").equals(TILL_ID).and((s) => s.status === "open").first(), [], undefined);
  const discountApprovals = useLiveQuery(() => db.discountApprovals.toArray(), [], undefined);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [discountReason, setDiscountReason] = useState("");
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // Decoupled from cart.discountCents during typing so fast/automated keystrokes can't race the
  // controlled-input re-render (which would otherwise read a stale DOM value and mis-parse it).
  const [discountText, setDiscountText] = useState<string>(() => (cart.discountCents > 0 ? String(cart.discountCents / 100) : ""));

  useEffect(() => {
    if (cart.lines.length === 0 && discountText !== "") setDiscountText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.lines.length]);

  function onDiscountTextChange(raw: string) {
    setDiscountText(raw);
    const num = Number(raw);
    cart.setDiscountCents(Number.isFinite(num) ? Math.round(Math.max(0, num) * 100) : 0);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const categories = useMemo(() => {
    const set = new Set((products ?? []).map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (!p.active) return false;
      if (category !== "all" && p.category !== category) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    });
  }, [products, category, search]);

  const productMap = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const customerMap = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers]);

  const priceFor = (product: Product, saleUnit: "unit" | "case") => {
    const base = cart.channel === "wholesale" ? product.wholesalePriceCents : product.retailPriceCents;
    return saleUnit === "case" && product.caseUnitQty ? base * product.caseUnitQty : base;
  };

  const cartRows = cart.lines.map((line) => {
    const product = productMap.get(line.productId);
    const unitPrice = product ? priceFor(product, line.saleUnit) : 0;
    return { ...line, product, unitPrice, lineTotal: unitPrice * line.qty };
  });
  const subtotalCents = cartRows.reduce((s, r) => s + r.lineTotal, 0);
  const discountCents = Math.min(cart.discountCents, subtotalCents);
  const totalCents = subtotalCents - discountCents;

  const basketHash = computeBasketHash(
    cart.lines.map((l) => ({ productId: l.productId, saleUnit: l.saleUnit, qty: l.qty })),
    discountCents,
  );
  const exceedsThreshold = subtotalCents > 0 && discountCents / subtotalCents > DISCOUNT_APPROVAL_THRESHOLD_PCT;
  const hasDirectAuthority = role === "manager" || role === "owner";
  const needsApproval = discountCents > 0 && exceedsThreshold && !hasDirectAuthority;
  const matchingApproval = needsApproval
    ? (discountApprovals ?? [])
        .filter((a) => a.saleBasketHash === basketHash)
        .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0]
    : undefined;
  const approvalGranted = !needsApproval || matchingApproval?.status === "approved";

  async function submitDiscountApprovalRequest() {
    if (!discountReason.trim()) {
      setApprovalError("A reason is required to request manager approval.");
      return;
    }
    setRequestingApproval(true);
    setApprovalError(null);
    try {
      await requestDiscountApproval({
        lines: cart.lines.map((l) => ({ productId: l.productId, saleUnit: l.saleUnit, qty: l.qty })),
        subtotalCents,
        discountCents,
        reason: discountReason.trim(),
        requestedBy: actor,
      });
      setDiscountReason("");
    } catch (e) {
      setApprovalError(e instanceof Error ? e.message : "Could not request approval.");
    } finally {
      setRequestingApproval(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:h-full lg:grid-cols-[1fr_380px]">
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-white p-1 text-sm">
            <button
              className={`rounded px-3 py-1.5 font-medium ${cart.channel === "retail" ? "bg-[var(--color-navy-900)] text-white" : "text-[var(--color-ink-700)]"}`}
              onClick={() => cart.setChannel("retail")}
            >
              Retail
            </button>
            <button
              className={`rounded px-3 py-1.5 font-medium ${cart.channel === "wholesale" ? "bg-[var(--color-navy-900)] text-white" : "text-[var(--color-ink-700)]"}`}
              onClick={() => cart.setChannel("wholesale")}
            >
              Wholesale
            </button>
          </div>

          {cart.channel === "wholesale" && (
            <Select value={cart.customerId ?? ""} onChange={(e) => cart.setCustomerId(e.target.value || undefined)} className="w-56">
              <option value="">Select wholesale customer…</option>
              {(customers ?? [])
                .filter((c) => c.kind === "wholesale")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}

          <Input placeholder="Search by name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${category === c ? "bg-[var(--color-crimson-600)] text-white" : "bg-white border border-[var(--color-border)] text-[var(--color-ink-700)]"}`}
            >
              {c === "all" ? "All categories" : c}
            </button>
          ))}
        </div>

        <div className="scroll-region min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((p) => {
              const available = stockMap?.[p.id] ?? 0;
              const outOfStock = available <= 0;
              return (
                <Card key={p.id} className="flex flex-col p-3">
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-ink-500)]">{p.sku}</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--color-navy-900)]">
                    {formatMoney(priceFor(p, "unit"))} <span className="text-xs font-normal text-[var(--color-ink-500)]">/ {p.unitLabel}</span>
                  </div>
                  <div className={`mt-1 text-xs ${outOfStock ? "text-[var(--color-danger-600)]" : "text-[var(--color-ink-500)]"}`}>
                    {outOfStock ? "Out of stock" : `${available} ${p.unitLabel}(s) available`}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1" disabled={outOfStock} onClick={() => cart.addLine(p.id, "unit")}>
                      + {p.unitLabel}
                    </Button>
                    {p.caseUnitQty && (
                      <Button className="flex-1" variant="secondary" disabled={available < p.caseUnitQty} onClick={() => cart.addLine(p.id, "case")}>
                        + case ({p.caseUnitQty})
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          {filteredProducts.length === 0 && <EmptyState title="No products match your search" />}
        </div>
      </div>

      <Card className="flex min-h-0 flex-col">
        <CardHeader title="Current sale" subtitle={cart.channel === "wholesale" ? customerMap.get(cart.customerId ?? "")?.name ?? "No customer selected" : "Walk-in customer"} />
        <div className="scroll-region min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {cartRows.length === 0 ? (
            <EmptyState title="Basket is empty" description="Add products from the catalog on the left." />
          ) : (
            <ul className="flex flex-col gap-3">
              {cartRows.map((row) => (
                <li key={`${row.productId}-${row.saleUnit}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.product?.name ?? row.productId}</div>
                    <div className="text-xs text-[var(--color-ink-500)]">
                      {formatMoney(row.unitPrice)} / {row.saleUnit === "case" ? "case" : row.product?.unitLabel}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={row.qty}
                    onChange={(e) => cart.updateQty(row.productId, row.saleUnit, Number(e.target.value))}
                    className="w-14 rounded-md border border-[var(--color-border)] px-2 py-1 text-center text-sm"
                  />
                  <div className="w-20 text-right font-medium">{formatMoney(row.lineTotal)}</div>
                  <button onClick={() => cart.removeLine(row.productId, row.saleUnit)} className="text-[var(--color-ink-500)] hover:text-[var(--color-danger-600)]" aria-label="Remove line">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-ink-500)]">Subtotal</span>
            <span className="font-medium">{formatMoney(subtotalCents)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--color-ink-500)]">Discount</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={discountText}
              onChange={(e) => onDiscountTextChange(e.target.value)}
              className="w-28 text-right"
              disabled={cartRows.length === 0}
            />
          </div>

          {discountCents > 0 && exceedsThreshold && (
            <div className="mt-2 rounded-md bg-[var(--color-warning-100)] px-3 py-2 text-xs text-[var(--color-warning-600)]">
              {hasDirectAuthority ? (
                <span>Exceeds the {DISCOUNT_APPROVAL_THRESHOLD_PCT * 100}% cashier limit — applied directly under your manager authority.</span>
              ) : matchingApproval?.status === "approved" ? (
                <span>Approved by {matchingApproval.decidedBy}: {matchingApproval.decisionReason}</span>
              ) : matchingApproval?.status === "pending" ? (
                <span>Awaiting manager approval — requested {new Date(matchingApproval.requestedAt).toLocaleTimeString()}.</span>
              ) : (
                <div>
                  <div className="mb-1">Exceeds your {DISCOUNT_APPROVAL_THRESHOLD_PCT * 100}% discount limit{matchingApproval?.status === "rejected" ? ` — previous request was rejected (${matchingApproval.decisionReason})` : ""}. A manager must approve this before you can charge.</div>
                  <Textarea
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for this discount…"
                    className="mb-1 bg-white"
                  />
                  <Button variant="secondary" onClick={submitDiscountApprovalRequest} disabled={requestingApproval}>
                    {requestingApproval ? "Requesting…" : "Request manager approval"}
                  </Button>
                  {approvalError && <p className="mt-1 text-[var(--color-danger-600)]">{approvalError}</p>}
                </div>
              )}
            </div>
          )}

          {cart.channel === "wholesale" && !cart.customerId && cartRows.length > 0 && (
            <div className="mt-2 rounded-md bg-[var(--color-warning-100)] px-3 py-2 text-xs text-[var(--color-warning-600)]">
              Select a wholesale customer above before you can charge this sale.
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(totalCents)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={cart.clear} disabled={cartRows.length === 0}>
              Clear
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={cartRows.length === 0 || (cart.channel === "wholesale" && !cart.customerId) || !approvalGranted}
              onClick={() => setCheckoutOpen(true)}
            >
              Charge {formatMoney(totalCents)}
            </Button>
          </div>
        </div>
      </Card>

      {checkoutOpen && (
        <CheckoutDialog
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          subtotalCents={subtotalCents}
          discountCents={discountCents}
          discountApprovalId={needsApproval ? matchingApproval?.id : undefined}
          actor={actor}
          actorRole={role}
          tillSessionId={tillSession?.id}
          cartRows={cartRows}
          channel={cart.channel}
          customerId={cart.customerId}
          onSuccess={(sale) => {
            setCheckoutOpen(false);
            setReceipt(sale);
            cart.clear();
            setDiscountReason("");
            flash(`${sale.saleNumber} posted — stock updated.`);
          }}
        />
      )}

      {receipt && <ReceiptDialog sale={receipt} productMap={productMap} onClose={() => setReceipt(null)} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function CheckoutDialog({
  open,
  onClose,
  subtotalCents,
  discountCents,
  discountApprovalId,
  actor,
  actorRole,
  tillSessionId,
  cartRows,
  channel,
  customerId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  subtotalCents: number;
  discountCents: number;
  discountApprovalId?: string;
  actor: string;
  actorRole: DemoRole;
  tillSessionId?: string;
  cartRows: { productId: string; saleUnit: "unit" | "case"; qty: number }[];
  channel: "retail" | "wholesale";
  customerId?: string;
  onSuccess: (sale: Sale) => void;
}) {
  const totalCents = subtotalCents - discountCents;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState(totalCents / 100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenderedCents = Math.round(tendered * 100);
  const changeCents = tenderedCents - totalCents;

  async function submit() {
    if (paymentMethod === "cash" && tenderedCents < totalCents) {
      setError("Cash tendered is less than the total due.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sale = await postSale({
        channel,
        customerId: customerId ?? "cust-walkin",
        lines: cartRows.map((r) => ({ productId: r.productId, saleUnit: r.saleUnit, qty: r.qty })),
        discountCents,
        discountApprovalId,
        actorRole,
        paymentMethod,
        tenderedCents: paymentMethod === "cash" ? tenderedCents : undefined,
        createdBy: actor,
        tillSessionId: paymentMethod === "cash" ? tillSessionId : undefined,
        operationId: `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      onSuccess(sale);
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        setError(e.message);
      } else if (e instanceof DuplicateOperationError) {
        setError("This sale was already submitted.");
      } else if (e instanceof DiscountApprovalRequiredError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Could not post sale.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Checkout"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Posting…" : "Confirm payment"}
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg bg-[var(--color-surface)] px-4 py-3 text-center">
        <div className="text-xs text-[var(--color-ink-500)]">Total due</div>
        <div className="text-2xl font-semibold">{formatMoney(totalCents)}</div>
        {discountCents > 0 && (
          <div className="mt-1 text-xs text-[var(--color-ink-500)]">
            {formatMoney(subtotalCents)} subtotal − {formatMoney(discountCents)} discount
          </div>
        )}
      </div>

      <Field label="Payment method">
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          <option value="cash">Cash</option>
          <option value="card">Card (simulated electronic)</option>
          <option value="credit">Credit (wholesale account)</option>
        </Select>
      </Field>

      {paymentMethod === "cash" && (
        <>
          <Field label="Cash tendered">
            <Input type="number" min={0} step={0.01} value={tendered} onChange={(e) => setTendered(Number(e.target.value))} />
          </Field>
          <p className="text-xs text-[var(--color-ink-500)]">
            Change due: <span className="font-medium text-[var(--color-ink-900)]">{formatMoney(Math.max(0, changeCents))}</span>
          </p>
        </>
      )}
      {paymentMethod === "card" && <p className="text-xs text-[var(--color-ink-500)]">Simulated electronic payment — no live processor is called, and expected cash is unaffected.</p>}
      {paymentMethod === "credit" && <p className="text-xs text-[var(--color-ink-500)]">Posted to the wholesale customer's account. No cash or card is collected now.</p>}

      {error && <p className="mt-2 text-xs text-[var(--color-danger-600)]">{error}</p>}
    </Dialog>
  );
}

function ReceiptDialog({ sale, productMap, onClose }: { sale: Sale; productMap: Map<string, Product>; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={`Receipt — ${sale.saleNumber}`} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="font-mono text-xs leading-relaxed">
        <div className="mb-2 text-center font-semibold">Harare Grocers &amp; Wholesale (Demo)</div>
        <div className="mb-2 border-b border-dashed border-[var(--color-border)] pb-2 text-center text-[var(--color-ink-500)]">
          {new Date(sale.createdAt).toLocaleString()} · {sale.channel}
        </div>
        {sale.lines.map((l) => (
          <div key={`${l.productId}-${l.saleUnit}`} className="flex justify-between">
            <span>
              {l.qty} x {productMap.get(l.productId)?.name ?? l.productId} ({l.saleUnit})
            </span>
            <span>{formatMoney(l.lineTotalCents)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-dashed border-[var(--color-border)] pt-2">
          <span>Subtotal</span>
          <span>{formatMoney(sale.subtotalCents)}</span>
        </div>
        {sale.discountCents > 0 && (
          <div className="flex justify-between text-[var(--color-crimson-600)]">
            <span>Discount{sale.discountApprovalId ? " (approved)" : ""}</span>
            <span>-{formatMoney(sale.discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 font-semibold">
          <span>Total</span>
          <span>{formatMoney(sale.totalCents)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[var(--color-ink-500)]">
          <span>Payment</span>
          <span>{sale.paymentMethod}</span>
        </div>
        {sale.paymentMethod === "cash" && (
          <>
            <div className="flex justify-between text-[var(--color-ink-500)]">
              <span>Tendered</span>
              <span>{formatMoney(sale.tenderedCents ?? 0)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-ink-500)]">
              <span>Change</span>
              <span>{formatMoney(sale.changeCents ?? 0)}</span>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
