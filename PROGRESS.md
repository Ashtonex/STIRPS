# STIRPS prototype — progress checkpoint

Status: **Pitch Core complete** (Tier 1 + Tier 2 per the delivery-override doc). All gates verified live in the browser. Demo reset to its pristine deterministic state.

## Architecture
- Vite + React 19 + TypeScript, React Router (`createBrowserRouter`), Tailwind v4 (via `@tailwindcss/vite`).
- Persistence: Dexie (IndexedDB), single DB `stirps-demo-db` in `src/db/schema.ts`.
- Repository layer: `src/db/repo.ts` — every mutation goes through a transactional function with an idempotency key (`operationLog` table) and posts to an append-only `stockMovements` ledger. Derived stock = sum of movements (`getAvailableStock`/`getAvailableStockMap`). No direct overwrites of quantities anywhere.
- Deterministic seed: `src/db/seed.ts` (`buildSeed()`), 22 SKUs, dedicated demo SKU `sku-oil-2l` (Sunfresh Cooking Oil 2L, case of 12, opens at 0 stock). Seed/reset orchestration: `seedIfEmpty`, `resetDemo` in `repo.ts`.
- App shell: `src/app/Shell.tsx` (persistent sidebar + topnav, mobile slide-in drawer, role selector, connectivity indicator), `src/app/DemoContext.tsx` (role → actor persona), `src/app/PosCartContext.tsx` (POS basket draft incl. discount, persisted to sessionStorage, survives SPA navigation).
- Pages: `src/pages/{OwnerOverview,Purchasing,Pos,StockCountPage,Approvals,Till,Products,Activity,Demo}.tsx`.

## Gate status (master spec §18) — all DONE
- **Gate 1–2** (shell/routing, data model, seed, transaction rules): DONE.
- **Gate 3** (purchasing → receiving → inventory): DONE, verified live (PO-1001: 10 cases ordered, received 9 cases = 108 units, 12 outstanding, shortage flagged).
- **Gate 4** (POS retail + wholesale → stock → receipt): DONE, verified live (2 units retail cash 108→106; 2 cases wholesale credit 106→82).
- **Gate 5** (approvals → counts → till): DONE.
  - Blind count + approved adjustment: verified live (expected 82, counted 80, variance −2, approved, final stock 80).
  - Discount approval: verified live end-to-end — cashier enters $10 discount on a $27.90 sale (36%, over the 15% threshold), blocked from charging, requests approval with a reason; manager reviews in Approvals and approves with a reason; cashier returns to the *same* basket (hash-matched) and completes the sale; receipt shows "Discount (approved) −$10.00". Also verified a manager/owner can apply an above-threshold discount directly (no approval needed) — confirmed via the "applied directly under your manager authority" message.
  - Till reconciliation: verified live — till opened with $50 float, one $17.90 cash sale recorded, expected cash $67.90 computed correctly; closed with a counted $66.40 (variance −$1.50), required reason enforced, closed session now immutable and listed with its variance.
  - Damage: represented via a seeded damage movement (chicken pieces) as evidence only — no damage-posting *workflow* UI, per the override doc's explicit exclusion list.
  - Returns: not implemented — explicitly excluded by the override doc.
- **Gate 6** (owner reporting, exceptions, guided pitch): DONE. Owner Overview now has 6 exception panels (receiving shortages, stock-count differences, low stock, near-expiry, discount approvals pending, till differences) plus 4 headline stat tiles, all reactive via Dexie live queries. Demo Controls walkthrough covers all 8 pitch steps with a "what this proves" line each.
- **Gate 7** (browser verification, mobile, rehearsal): DONE. Full 8-step journey (Tier 1 + Tier 2) exercised live in the built-in browser at desktop and mobile (375×812) widths.

## Bugs found and fixed during verification
1. `submitStockCount`'s Dexie transaction didn't declare `db.stockMovements` even though `getAvailableStock` reads it inside the tx → threw `NotFoundError` on commit. Fixed by adding the table to the transaction's scope.
2. Mobile layout: sidebar didn't collapse, header overflowed, tables could overflow the page. Fixed with a slide-in drawer nav in `Shell.tsx`, a responsive header, and `overflow-x-auto` wrappers around every `<table>`.
3. `getCashMovementsForSession` used `db.tillCashMovements.where("tillSessionId")` on a field that was never added to the Dexie index string → threw `KeyPath ... is not indexed` and crashed the Till page. Fixed by filtering in JS (`.toArray().filter(...)`), consistent with how the rest of the app queries this table.
4. The POS discount `<input>` was a fully-controlled numeric field re-derived from `cart.discountCents` every render; fast/automated keystrokes raced the re-render, so the DOM's stale value got appended to instead of replaced, inflating a `10` into `100`. Fixed by decoupling the field into local component state (`discountText`) that's write-only into the cart context, eliminating the feedback loop.

## Deliberate scope exclusions (per override doc — confirmed not built)
Registration/password auth, org switching/multi-branch, production tenant isolation, delivery routing, customer statements/credit control, barcode label printing/hardware, returns & damage-posting *workflows*, accounting journal posting, multi-currency, fiscalisation, messaging integrations, external AI, live payments, cloud sync, production backup/restore, offline cold-start, cloud deployment.

## Run commands
- Dev server: `npm run dev` (Vite, port 5173) — also registered as `.claude/launch.json` config `stirps-dev`.
- Typecheck: `npx tsc -b` (clean, no errors, as of this checkpoint).
- Reset demo data: in-app "Reset Demo" button on the Demo Controls page (requires confirmation).

## What's left for a full production pilot (not this prototype)
See `HANDOVER.md` for the client-facing limitations and roadmap.
