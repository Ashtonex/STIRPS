# STIRPS — Pitch Prototype Handover

A working, local-only prototype for Harare Grocers & Wholesale (fictional demo business), built to demonstrate a connected stock-control and cash-control story for the partners.

## 1. Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The app seeds itself automatically on first load. To re-run the demo from scratch, use the **Reset Demo** button on the **Demo Controls** page (confirmation required — this clears and reseeds everything on this device).

Build for a static check: `npm run build`. Typecheck only: `npx tsc -b`.

## 2. Eight-minute pitch script

Follow the **Demo Controls** page in the app — it has these same steps with a jump-link to each screen and a "what this proves" line. Switch the **Acting as** role selector in the header as indicated.

| # | Step | Where | Exact action | Expected result |
|---|------|-------|---------------|------------------|
| 1 | Show the baseline | Owner Overview | Just look | Revenue/profit/stock-value tiles, 0 exceptions on the demo SKU |
| 2 | Receive a shortage | Purchasing | Find **PO-1001** (Sunfresh Cooking Oil 2L, 10 cases ordered). Click **Receive goods**, change the quantity to **108**, add a note, **Post receipt** | Stock becomes **108** units (not 120); PO shows "partially received", 12 units outstanding |
| 3 | See the shortage surface | Owner Overview | Return here | "Receiving shortages" panel shows PO-1001, 12 units outstanding |
| 4 | Sell retail + wholesale | Point of Sale | Retail: add 2× Sunfresh Cooking Oil bottles, pay cash, charge. Switch to Wholesale, pick a customer, add 2× case, pay credit, charge | Stock falls 108 → 106 → 82; wholesale price tier applied automatically |
| 5 | Blocked discount → manager approval | Point of Sale (role: Cashier) | Add a few items, enter a **Discount** over 15% of the subtotal, type a reason, **Request manager approval**. Switch role to **Manager**, open **Approvals**, **Review**, type a decision reason, **Approve**. Switch back to **Cashier**, return to POS (basket is preserved), **Charge** | Cashier cannot charge until approved; once approved, the exact same basket checks out with "Discount (approved)" on the receipt |
| 6 | Blind count variance | Stock Count | **Start blind count**, select only Sunfresh Cooking Oil 2L, **Enter counts** → type **80** (expected is hidden), **Submit**. Switch role to **Manager**, **Review variance**, type a reason, **Approve adjustment** | Variance revealed only after submit (−2); approved adjustment posts; stock becomes **80** |
| 7 | Close the till with a variance | Till | **Close Till**, change counted cash slightly from the expected figure, type a reason, **Close till** | Variance shown live as you type; till closes as an immutable, inspectable record |
| 8 | Inspect the evidence | Owner Overview, Activity History | Return to Owner Overview; check Activity History | Stock-count differences cleared; till difference and discount decision both appear in their panels; full timestamped trail in Activity History |

The exact numbers above (0 → 108 → 106 → 82 → 80 for the demo SKU) are deterministic and will repeat identically after every Reset Demo.

## 3. Implemented workflows

- **Purchasing & receiving**: purchase orders, partial receiving with shortage tracking, receipt history traceable to the PO.
- **Point of sale**: retail and wholesale price tiers, unit/case selling, cash/card/credit payment, cash tendered & change, printable-style receipt, basket persists across navigation and refresh (session-scoped).
- **Discount approval**: a cashier's discount above 15% of the subtotal is blocked until a manager approves the *exact* basket and discount (a hash ties the approval to those terms — changing the basket invalidates it); a manager/owner can apply a larger discount directly.
- **Blind stock count**: counter never sees the system's expected quantity; submitting reveals the variance to a reviewer; only an approved, reasoned adjustment changes posted stock.
- **Till reconciliation**: opening float, cash sales tracked automatically (card/credit do not affect expected cash), physical count vs. expected, required reason for any variance, closed sessions are immutable evidence.
- **Owner Overview**: revenue, gross profit (vs. cost), stock value at cost, and six live exception panels (receiving shortages, stock-count differences, low stock, near-expiry batches, pending discount approvals, till differences) — all derived from the same posted records, nothing hard-coded.
- **Activity History**: a readable, timestamped log of who did what and why, across every workflow above.
- **Demo controls**: deterministic Reset Demo (with confirmation), guided walkthrough, role switcher (Owner/Manager/Cashier/Storekeeper — a presentation convenience, not authentication).

## 4. Verification performed

All of the following were exercised live in a real browser (desktop 1024×768 and mobile 375×812), not just compiled:

- The full 8-step journey above, with the exact numbers shown.
- `npx tsc -b` passes with zero errors.
- Refresh mid-workflow preserves committed records and the POS basket draft; back/forward and direct URL loads all work; the app shell never fully reloads between pages.
- Reset Demo reseeds to the exact same starting numbers, with no manual repair needed.
- Mobile: sidebar collapses to a drawer, no page-level horizontal scroll, every table scrolls independently within its own container.

Three real bugs were found and fixed during this verification (not merely "it compiled"): a Dexie transaction missing a table in its scope (crashed stock-count submission), an unindexed Dexie query (crashed the Till page), and a controlled-input race that could inflate a typed discount value tenfold. See `PROGRESS.md` for details.

Not executed: multi-user concurrent access, load/performance testing beyond normal interactive use, and automated test suite (none was requested or added — verification here was manual, in-browser, end-to-end).

## 5. Client-friendly limitations

This is a **local, single-device demonstration**, not a production system:

- All data lives in this browser's IndexedDB. Nothing syncs between devices or to a server. Closing the browser's storage (or using a different browser/device) starts fresh.
- "Acting as" role switching is a presentation convenience — there is no password, login, or real access control behind it.
- Payments are simulated: no live card processor or bank integration is called; "cash", "card" and "credit" only affect the till math inside this prototype.
- There is one branch, one till, one organization — no multi-branch or multi-tenant separation.
- No barcode scanner hardware, label printer, SMS/WhatsApp/email, or external AI service is connected; insights shown are simple rule checks, not an AI model.
- Returns and damage-posting workflows were intentionally left out of this build (damage appears only as a seeded example movement for the near-expiry/low-stock story).
- No offline cold-start guarantee: the page must load successfully once before any local-only behavior applies.

## 6. Pilot roadmap (beyond this prototype)

| Area | Today (this prototype) | Needed for a pilot |
|------|------------------------|---------------------|
| Persistence | Browser-local IndexedDB | Server-backed database with backups |
| Auth | Role selector, no password | Real authentication & per-user authorization |
| Tenancy | Single org, local filtering only | Enforced server-side tenant isolation |
| Sync | None — single device | Multi-device/multi-till real-time sync |
| Payments | Simulated | Live payment processor integration |
| Compliance | None | Fiscalisation / tax-authority requirements for the target market |
| Operations | Manual reset only | Scheduled backups, monitoring, incident response |
| Hardware | None | Barcode scanners, receipt printers tested against real devices |
| Workflows | Purchasing, POS, counts, discounts, till | Add returns/damage posting, delivery routing, customer statements as the pilot scope grows |

---
Generated as part of the STIRPS pitch-prototype build. See `PROGRESS.md` for the engineering-facing status and gate-by-gate verification log.
