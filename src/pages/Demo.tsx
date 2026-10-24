import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/schema";
import { resetDemo, getAvailableStock, getSeedDate, DEMO_PRODUCT_ID } from "../db/repo";
import { Card, Button, Badge, Dialog, Toast } from "../components/ui";

interface WalkthroughStep {
  title: string;
  detail: string;
  proves: string;
  to: string;
  cta: string;
}

const STEPS: WalkthroughStep[] = [
  {
    title: "1. Show the owners' business overview",
    detail: "Open Owner Overview. Point out revenue, gross profit, stock value and the exceptions panels — all zero issues until the demo introduces them.",
    proves: "Both partners see one set of numbers, derived from the same committed records — not a spreadsheet someone edited by hand.",
    to: "/overview",
    cta: "Open Owner Overview",
  },
  {
    title: "2. Receive 9 of 10 ordered cases",
    detail: "Open Purchasing. Find PO-1001 (Sunfresh Cooking Oil 2L, 10 cases ordered). Click Receive goods and enter 9 cases (108 units) received.",
    proves: "Partial receiving updates stock by exactly what arrived — 108 units, not the 120 ordered — and the shortfall is tracked, not lost.",
    to: "/purchasing",
    cta: "Open Purchasing",
  },
  {
    title: "3. Show the shortage and resulting stock",
    detail: "Return to Owner Overview. The receiving-shortage panel now shows PO-1001 with 12 units outstanding.",
    proves: "A delivery shortfall surfaces automatically to the owners — nobody has to remember to report it.",
    to: "/overview",
    cta: "Open Owner Overview",
  },
  {
    title: "4. Sell retail units and a wholesale case",
    detail: "Open Point of Sale. In Retail, sell 2 Sunfresh Cooking Oil 2L units (stock falls 108 → 106). Switch to Wholesale, pick a customer, sell 2 cases (stock falls 106 → 82).",
    proves: "The same stock ledger backs both retail and wholesale sales, with the correct price tier applied automatically.",
    to: "/pos",
    cta: "Open Point of Sale",
  },
  {
    title: "5. Demonstrate a blocked discount and manager decision",
    detail: "As Cashier in Point of Sale, add items and enter a discount above 15% of the subtotal. The cashier cannot finalize it directly — request approval with a reason, switch to Manager, open Approvals and approve or reject it, then return to POS and complete the sale.",
    proves: "A cashier's authority is capped automatically; only a manager's reasoned decision unlocks a large discount, and changing the basket after approval would invalidate it.",
    to: "/pos",
    cta: "Open Point of Sale",
  },
  {
    title: "6. Submit and approve a blind count variance",
    detail: "Open Stock Count. Start a count including the cooking oil, enter a physical count of 80 units (without seeing the expected 82), submit, then switch to Manager and approve the revealed -2 variance.",
    proves: "Counting is blind until submission, and only an approved, reasoned adjustment ever changes posted stock.",
    to: "/stock-count",
    cta: "Open Stock Count",
  },
  {
    title: "7. Close a till with a recorded cash difference",
    detail: "Open Till. Review expected cash (opening float plus cash sales), enter a physical count that differs slightly, give a reason for the variance, and close the till.",
    proves: "A cash shortage or overage is captured with a reason at the point of close, not discovered — or hidden — later.",
    to: "/till",
    cta: "Open Till",
  },
  {
    title: "8. Return to the owner view and inspect the evidence",
    detail: "Back on Owner Overview, confirm stock-count differences are cleared, the till difference and discount decision both appear in their panels, and check Activity History for the full trail of what just happened.",
    proves: "Every step left a traceable record — who did what, when, and why.",
    to: "/overview",
    cta: "Open Owner Overview",
  },
];

export function Demo() {
  const seedDate = useLiveQuery(() => getSeedDate(), [], undefined);
  const demoStock = useLiveQuery(() => getAvailableStock(DEMO_PRODUCT_ID), [], undefined);
  const demoProduct = useLiveQuery(() => db.products.get(DEMO_PRODUCT_ID), [], undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function doReset() {
    setResetting(true);
    await resetDemo();
    setResetting(false);
    setConfirmOpen(false);
    setToast("Demo reset to its deterministic starting state.");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Demo Controls &amp; Walkthrough</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            Local demo — stored on this device. Records do not synchronize across devices. Seeded {seedDate ? new Date(seedDate).toLocaleString() : "…"}.
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Reset Demo
        </Button>
      </div>

      <Card className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-xs text-[var(--color-ink-500)]">Demo SKU — {demoProduct?.name ?? "Sunfresh Cooking Oil 2L"}</div>
          <div className="text-xs text-[var(--color-ink-500)]">Expected path: 0 → 108 → 106 → 82 → 80 units</div>
        </div>
        <Badge tone="navy">{demoStock ?? 0} units on hand now</Badge>
      </Card>

      <div className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <Card key={step.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-ink-700)]">{step.detail}</p>
                <p className="mt-2 text-xs italic text-[var(--color-navy-700)]">What this proves: {step.proves}</p>
              </div>
              <Link to={step.to}>
                <Button variant="secondary">{step.cta}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Reset demo data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReset} disabled={resetting}>
              {resetting ? "Resetting…" : "Yes, reset everything"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-ink-700)]">
          This clears every purchase order, receipt, sale, stock count and activity record on this device and reseeds the deterministic
          demonstration business from scratch. This cannot be undone.
        </p>
      </Dialog>

      {toast && <Toast message={toast} />}
    </div>
  );
}
