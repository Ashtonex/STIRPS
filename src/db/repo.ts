import { db } from "./schema";
import { buildSeed, DEMO_PRODUCT_ID, DEMO_SUPPLIER_ID, DEMO_CASE_UNIT_QTY } from "./seed";
import { LOCATION_ID, ORG_ID, TILL_ID } from "../domain/types";
import type {
  Product,
  ProductId,
  PurchaseOrder,
  Receipt,
  ReceiptLine,
  StockMovement,
  Sale,
  SaleLine,
  SaleChannel,
  SaleUnit,
  PaymentMethod,
  StockCount,
  StockCountLine,
  ActivityEvent,
  DiscountApproval,
  DemoRole,
  TillSession,
} from "../domain/types";
import { toBaseUnits } from "../domain/units";

export { DEMO_PRODUCT_ID, DEMO_SUPPLIER_ID, DEMO_CASE_UNIT_QTY };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function logActivity(entry: Omit<ActivityEvent, "id" | "timestamp">) {
  await db.activityLog.add({ ...entry, id: uid("act"), timestamp: nowIso() });
}

/** Guards a business operation against duplicate submission using a client-supplied idempotency key. */
async function withIdempotency<T>(operationId: string, kind: string, fn: () => Promise<T>): Promise<T> {
  const existing = await db.operationLog.get(operationId);
  if (existing) {
    throw new DuplicateOperationError(operationId);
  }
  const result = await fn();
  await db.operationLog.add({ operationId, kind, createdAt: nowIso() });
  return result;
}

export class DuplicateOperationError extends Error {
  constructor(operationId: string) {
    super(`Operation ${operationId} was already submitted.`);
    this.name = "DuplicateOperationError";
  }
}

export class InsufficientStockError extends Error {
  constructor(productName: string, available: number, requested: number) {
    super(`Insufficient stock for ${productName}: available ${available}, requested ${requested}`);
    this.name = "InsufficientStockError";
  }
}

// ---------------------------------------------------------------------------
// Seeding / reset
// ---------------------------------------------------------------------------

export async function isSeeded(): Promise<boolean> {
  const meta = await db.meta.get("seeded");
  return Boolean(meta?.value);
}

export async function seedIfEmpty(): Promise<void> {
  if (await isSeeded()) return;
  await seedDatabase();
}

export async function resetDemo(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.products,
      db.suppliers,
      db.customers,
      db.purchaseOrders,
      db.receipts,
      db.stockMovements,
      db.sales,
      db.discountApprovals,
      db.stockCounts,
      db.tillSessions,
      db.tillCashMovements,
      db.activityLog,
      db.operationLog,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.suppliers.clear(),
        db.customers.clear(),
        db.purchaseOrders.clear(),
        db.receipts.clear(),
        db.stockMovements.clear(),
        db.sales.clear(),
        db.discountApprovals.clear(),
        db.stockCounts.clear(),
        db.tillSessions.clear(),
        db.tillCashMovements.clear(),
        db.activityLog.clear(),
        db.operationLog.clear(),
        db.meta.clear(),
      ]);
      await seedDatabase();
    },
  );
}

async function seedDatabase(): Promise<void> {
  const bundle = buildSeed();
  await db.products.bulkAdd(bundle.products);
  await db.suppliers.bulkAdd(bundle.suppliers);
  await db.customers.bulkAdd(bundle.customers);
  await db.purchaseOrders.bulkAdd(bundle.purchaseOrders);
  await db.receipts.bulkAdd(bundle.receipts);
  await db.stockMovements.bulkAdd(bundle.openingMovements);
  await db.sales.bulkAdd(bundle.historicalSales);
  await db.stockMovements.bulkAdd(bundle.historicalSaleMovements);
  await db.tillSessions.bulkAdd(bundle.tillSessions);
  await db.activityLog.bulkAdd(bundle.activity);
  await db.meta.put({ key: "seeded", value: true });
  await db.meta.put({ key: "seedDate", value: bundle.seedDate });
}

// ---------------------------------------------------------------------------
// Stock queries
// ---------------------------------------------------------------------------

export async function getAvailableStock(productId: ProductId): Promise<number> {
  const movements = await db.stockMovements.where("productId").equals(productId).toArray();
  return movements.reduce((sum, m) => sum + m.qtyDeltaUnits, 0);
}

export async function getAvailableStockMap(): Promise<Record<ProductId, number>> {
  const movements = await db.stockMovements.toArray();
  const map: Record<ProductId, number> = {};
  for (const m of movements) {
    map[m.productId] = (map[m.productId] ?? 0) + m.qtyDeltaUnits;
  }
  return map;
}

export async function getBatchesForProduct(
  productId: ProductId,
): Promise<{ batchCode: string; qty: number; expiryDate?: string }[]> {
  const movements = await db.stockMovements.where("productId").equals(productId).toArray();
  const byBatch = new Map<string, { qty: number; expiryDate?: string }>();
  for (const m of movements) {
    const key = m.batchCode ?? "__no_batch__";
    const current = byBatch.get(key) ?? { qty: 0, expiryDate: m.expiryDate };
    current.qty += m.qtyDeltaUnits;
    if (m.expiryDate) current.expiryDate = m.expiryDate;
    byBatch.set(key, current);
  }
  return Array.from(byBatch.entries())
    .filter(([code]) => code !== "__no_batch__")
    .map(([batchCode, v]) => ({ batchCode, qty: v.qty, expiryDate: v.expiryDate }));
}

// ---------------------------------------------------------------------------
// Purchasing & receiving
// ---------------------------------------------------------------------------

export interface CreatePurchaseOrderInput {
  supplierId: string;
  lines: { productId: ProductId; orderedCases?: number; orderedUnits: number }[];
  createdBy: string;
  operationId: string;
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  return withIdempotency(input.operationId, "create_po", async () => {
    const count = await db.purchaseOrders.count();
    const po: PurchaseOrder = {
      id: uid("po"),
      poNumber: `PO-${1001 + count}`,
      supplierId: input.supplierId,
      status: "submitted",
      createdAt: nowIso(),
      createdBy: input.createdBy,
      lines: input.lines.map((l) => ({
        productId: l.productId,
        orderedCases: l.orderedCases ?? 0,
        orderedUnits: l.orderedUnits,
        receivedUnits: 0,
      })),
    };
    await db.purchaseOrders.add(po);
    await logActivity({
      actor: input.createdBy,
      action: "po_created",
      entityType: "purchase_order",
      entityId: po.id,
      description: `Created ${po.poNumber} with ${po.lines.length} line(s).`,
    });
    return po;
  });
}

export interface ReceiveGoodsInput {
  poId: string;
  lines: ReceiptLine[];
  receivedBy: string;
  shortageNotes?: string;
  operationId: string;
}

export async function receiveGoods(input: ReceiveGoodsInput): Promise<Receipt> {
  return withIdempotency(input.operationId, "receive_goods", async () => {
    return db.transaction("rw", [db.purchaseOrders, db.receipts, db.stockMovements, db.activityLog], async () => {
      const po = await db.purchaseOrders.get(input.poId);
      if (!po) throw new Error("Purchase order not found");
      if (po.status === "received" || po.status === "closed") {
        throw new Error("Purchase order is already fully received");
      }

      let hasShortage = false;
      const updatedLines = [...po.lines];
      for (const rl of input.lines) {
        const lineIdx = updatedLines.findIndex((l) => l.productId === rl.productId);
        if (lineIdx === -1) throw new Error(`Product ${rl.productId} is not on this purchase order`);
        const line = updatedLines[lineIdx];
        const newReceived = line.receivedUnits + rl.qtyReceivedUnits;
        if (newReceived > line.orderedUnits) {
          throw new Error(`Cannot receive more than ordered for product ${rl.productId}`);
        }
        if (newReceived < line.orderedUnits) hasShortage = true;
        updatedLines[lineIdx] = { ...line, receivedUnits: newReceived };
      }

      const allFullyReceived = updatedLines.every((l) => l.receivedUnits >= l.orderedUnits);
      const anyReceived = updatedLines.some((l) => l.receivedUnits > 0);

      const receipt: Receipt = {
        id: uid("rcpt"),
        receiptNumber: `RCPT-${Date.now().toString().slice(-6)}`,
        poId: po.id,
        lines: input.lines,
        receivedAt: nowIso(),
        receivedBy: input.receivedBy,
        shortageNotes: input.shortageNotes,
        hasShortage,
      };
      await db.receipts.add(receipt);

      await db.purchaseOrders.update(po.id, {
        lines: updatedLines,
        status: allFullyReceived ? "received" : anyReceived ? "partially_received" : po.status,
      });

      const movements: StockMovement[] = input.lines.map((rl) => ({
        id: uid("mv"),
        orgId: ORG_ID,
        locationId: LOCATION_ID,
        productId: rl.productId,
        batchCode: rl.batchCode,
        expiryDate: rl.expiryDate,
        qtyDeltaUnits: rl.qtyReceivedUnits,
        type: "purchase_receipt",
        sourceType: "receipt",
        sourceId: receipt.id,
        actor: input.receivedBy,
        timestamp: nowIso(),
      }));
      await db.stockMovements.bulkAdd(movements);

      await logActivity({
        actor: input.receivedBy,
        action: "goods_received",
        entityType: "receipt",
        entityId: receipt.id,
        description: `Received ${receipt.receiptNumber} against ${po.poNumber}${hasShortage ? " with shortage" : ""}.`,
      });

      return receipt;
    });
  });
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  return db.purchaseOrders.orderBy("createdAt").reverse().toArray();
}

export async function getReceiptsForPO(poId: string): Promise<Receipt[]> {
  return db.receipts.where("poId").equals(poId).toArray();
}

export async function getAllReceipts(): Promise<Receipt[]> {
  return db.receipts.orderBy("receivedAt").reverse().toArray();
}

// ---------------------------------------------------------------------------
// Point of sale
// ---------------------------------------------------------------------------

export interface PosSaleLineInput {
  productId: ProductId;
  saleUnit: SaleUnit;
  qty: number;
}

/** A discount above this fraction of the subtotal requires manager approval when requested by a cashier. */
export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 0.15;
const ROLES_WITH_DIRECT_DISCOUNT_AUTHORITY: DemoRole[] = ["manager", "owner"];

/** A stable fingerprint of a basket (lines + discount) used to tie an approval to the exact terms approved. */
export function computeBasketHash(lines: PosSaleLineInput[], discountCents: number): string {
  const normalized = lines
    .map((l) => `${l.productId}:${l.saleUnit}:${l.qty}`)
    .sort()
    .join("|");
  return `${normalized}#discount=${discountCents}`;
}

export interface PostSaleInput {
  channel: SaleChannel;
  customerId?: string;
  lines: PosSaleLineInput[];
  discountCents?: number;
  discountApprovalId?: string;
  actorRole: DemoRole;
  paymentMethod: PaymentMethod;
  tenderedCents?: number;
  createdBy: string;
  tillSessionId?: string;
  operationId: string;
}

export class DiscountApprovalRequiredError extends Error {
  constructor() {
    super("This discount exceeds the cashier's authority and requires manager approval.");
    this.name = "DiscountApprovalRequiredError";
  }
}

export async function postSale(input: PostSaleInput): Promise<Sale> {
  return withIdempotency(input.operationId, "post_sale", async () => {
    return db.transaction(
      "rw",
      [db.products, db.stockMovements, db.sales, db.tillCashMovements, db.discountApprovals, db.activityLog],
      async () => {
        if (input.lines.length === 0) throw new Error("Cannot post an empty sale");

        const resolvedLines: SaleLine[] = [];
        for (const line of input.lines) {
          const product = await db.products.get(line.productId);
          if (!product) throw new Error(`Unknown product ${line.productId}`);
          const qtyBaseUnits = toBaseUnits(product, line.qty, line.saleUnit);
          const available = await getAvailableStock(product.id);
          if (available < qtyBaseUnits) {
            throw new InsufficientStockError(product.name, available, qtyBaseUnits);
          }
          const unitPriceCents = input.channel === "wholesale" ? product.wholesalePriceCents : product.retailPriceCents;
          const priceForUnit = line.saleUnit === "case" && product.caseUnitQty ? unitPriceCents * product.caseUnitQty : unitPriceCents;
          resolvedLines.push({
            productId: product.id,
            saleUnit: line.saleUnit,
            qty: line.qty,
            qtyBaseUnits,
            unitPriceCents: priceForUnit,
            lineTotalCents: priceForUnit * line.qty,
          });
        }

        const subtotalCents = resolvedLines.reduce((s, l) => s + l.lineTotalCents, 0);
        const discountCents = Math.min(Math.max(0, input.discountCents ?? 0), subtotalCents);
        let discountApprovalId: string | undefined;

        if (discountCents > 0) {
          const needsAuthority = discountCents / subtotalCents > DISCOUNT_APPROVAL_THRESHOLD_PCT;
          const hasDirectAuthority = ROLES_WITH_DIRECT_DISCOUNT_AUTHORITY.includes(input.actorRole);
          if (needsAuthority && !hasDirectAuthority) {
            if (!input.discountApprovalId) throw new DiscountApprovalRequiredError();
            const approval = await db.discountApprovals.get(input.discountApprovalId);
            if (!approval || approval.status !== "approved") throw new DiscountApprovalRequiredError();
            const expectedHash = computeBasketHash(input.lines, discountCents);
            if (approval.saleBasketHash !== expectedHash) {
              throw new Error("The basket changed since this discount was approved — request approval again.");
            }
            discountApprovalId = approval.id;
          }
        }

        const totalCents = subtotalCents - discountCents;
        const count = await db.sales.count();

        const sale: Sale = {
          id: uid("sale"),
          saleNumber: `SL-${(1005 + count).toString().padStart(4, "0")}`,
          channel: input.channel,
          customerId: input.customerId,
          lines: resolvedLines,
          subtotalCents,
          discountCents,
          discountApprovalId,
          totalCents,
          paymentMethod: input.paymentMethod,
          tenderedCents: input.tenderedCents,
          changeCents: input.paymentMethod === "cash" && input.tenderedCents !== undefined ? input.tenderedCents - totalCents : undefined,
          status: "completed",
          createdAt: nowIso(),
          createdBy: input.createdBy,
          tillSessionId: input.tillSessionId,
        };
        await db.sales.add(sale);

        const movements: StockMovement[] = resolvedLines.map((l) => ({
          id: uid("mv"),
          orgId: ORG_ID,
          locationId: LOCATION_ID,
          productId: l.productId,
          qtyDeltaUnits: -l.qtyBaseUnits,
          type: "sale",
          sourceType: "sale",
          sourceId: sale.id,
          actor: input.createdBy,
          timestamp: nowIso(),
        }));
        await db.stockMovements.bulkAdd(movements);

        if (input.paymentMethod === "cash" && input.tillSessionId) {
          await db.tillCashMovements.add({
            id: uid("till-mv"),
            tillSessionId: input.tillSessionId,
            type: "sale_cash_in",
            amountCents: totalCents,
            sourceType: "sale",
            sourceId: sale.id,
            actor: input.createdBy,
            timestamp: nowIso(),
          });
        }

        await logActivity({
          actor: input.createdBy,
          action: "sale_posted",
          entityType: "sale",
          entityId: sale.id,
          description: `Posted ${sale.saleNumber} (${input.channel}) for ${(totalCents / 100).toFixed(2)}${discountCents > 0 ? ` (discount ${(discountCents / 100).toFixed(2)})` : ""}.`,
        });

        return sale;
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Discount approvals
// ---------------------------------------------------------------------------

export interface RequestDiscountApprovalInput {
  lines: PosSaleLineInput[];
  subtotalCents: number;
  discountCents: number;
  reason: string;
  requestedBy: string;
}

export async function requestDiscountApproval(input: RequestDiscountApprovalInput): Promise<DiscountApproval> {
  const approval: DiscountApproval = {
    id: uid("disc"),
    saleBasketHash: computeBasketHash(input.lines, input.discountCents),
    requestedDiscountCents: input.discountCents,
    subtotalCents: input.subtotalCents,
    reason: input.reason,
    requestedBy: input.requestedBy,
    requestedAt: nowIso(),
    status: "pending",
  };
  await db.discountApprovals.add(approval);
  await logActivity({
    actor: input.requestedBy,
    action: "discount_requested",
    entityType: "discount_approval",
    entityId: approval.id,
    description: `Requested approval for a ${(input.discountCents / 100).toFixed(2)} discount on a ${(input.subtotalCents / 100).toFixed(2)} sale. Reason: ${input.reason}`,
  });
  return approval;
}

export async function decideDiscountApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  decisionReason: string,
): Promise<DiscountApproval> {
  const approval = await db.discountApprovals.get(approvalId);
  if (!approval) throw new Error("Discount approval not found");
  if (approval.status !== "pending") throw new Error("This approval has already been decided");
  const updated: DiscountApproval = { ...approval, status: decision, decidedBy, decidedAt: nowIso(), decisionReason };
  await db.discountApprovals.put(updated);
  await logActivity({
    actor: decidedBy,
    action: decision === "approved" ? "discount_approved" : "discount_rejected",
    entityType: "discount_approval",
    entityId: approval.id,
    description: `${decision === "approved" ? "Approved" : "Rejected"} discount request for ${(approval.requestedDiscountCents / 100).toFixed(2)}. Reason: ${decisionReason}`,
  });
  return updated;
}

export async function getPendingDiscountApprovals(): Promise<DiscountApproval[]> {
  return db.discountApprovals.where("status").equals("pending").toArray();
}

export async function listProducts(): Promise<Product[]> {
  return db.products.toArray();
}

export async function getSales(): Promise<Sale[]> {
  return db.sales.orderBy("createdAt").reverse().toArray();
}

// ---------------------------------------------------------------------------
// Stock counts
// ---------------------------------------------------------------------------

export async function createStockCount(productIds: ProductId[], createdBy: string): Promise<StockCount> {
  const count = await db.stockCounts.count();
  const sc: StockCount = {
    id: uid("sc"),
    countNumber: `SC-${1001 + count}`,
    status: "draft",
    lines: productIds.map((productId) => ({
      productId,
      expectedUnits: 0,
      countedUnits: null,
      varianceUnits: null,
    })),
    createdAt: nowIso(),
    createdBy,
  };
  await db.stockCounts.add(sc);
  await logActivity({
    actor: createdBy,
    action: "stock_count_started",
    entityType: "stock_count",
    entityId: sc.id,
    description: `Started blind stock count ${sc.countNumber} for ${productIds.length} product(s).`,
  });
  return sc;
}

export async function submitStockCount(
  countId: string,
  countedUnitsByProduct: Record<ProductId, number>,
  submittedBy: string,
): Promise<StockCount> {
  return db.transaction("rw", [db.stockCounts, db.stockMovements, db.activityLog], async () => {
    const sc = await db.stockCounts.get(countId);
    if (!sc) throw new Error("Stock count not found");
    if (sc.status !== "draft") throw new Error("Stock count already submitted");

    const lines: StockCountLine[] = [];
    for (const line of sc.lines) {
      const expected = await getAvailableStock(line.productId);
      const counted = countedUnitsByProduct[line.productId] ?? 0;
      lines.push({
        productId: line.productId,
        expectedUnits: expected,
        countedUnits: counted,
        varianceUnits: counted - expected,
      });
    }

    const updated: StockCount = { ...sc, lines, status: "submitted", submittedAt: nowIso() };
    await db.stockCounts.put(updated);
    await logActivity({
      actor: submittedBy,
      action: "stock_count_submitted",
      entityType: "stock_count",
      entityId: sc.id,
      description: `Submitted ${sc.countNumber} for review. Variance revealed to reviewer.`,
    });
    return updated;
  });
}

export async function approveStockCount(countId: string, reviewedBy: string, reviewReason: string): Promise<StockCount> {
  return db.transaction("rw", [db.stockCounts, db.stockMovements, db.activityLog], async () => {
    const sc = await db.stockCounts.get(countId);
    if (!sc) throw new Error("Stock count not found");
    if (sc.status !== "submitted") throw new Error("Only submitted counts can be approved");

    const movements: StockMovement[] = [];
    for (const line of sc.lines) {
      if (line.varianceUnits && line.varianceUnits !== 0) {
        movements.push({
          id: uid("mv"),
          orgId: ORG_ID,
          locationId: LOCATION_ID,
          productId: line.productId,
          qtyDeltaUnits: line.varianceUnits,
          type: "count_adjustment",
          sourceType: "stock_count",
          sourceId: sc.id,
          actor: reviewedBy,
          timestamp: nowIso(),
          reason: reviewReason,
        });
      }
    }
    if (movements.length) await db.stockMovements.bulkAdd(movements);

    const updated: StockCount = { ...sc, status: "approved", reviewedBy, reviewedAt: nowIso(), reviewReason };
    await db.stockCounts.put(updated);
    await logActivity({
      actor: reviewedBy,
      action: "stock_count_approved",
      entityType: "stock_count",
      entityId: sc.id,
      description: `Approved ${sc.countNumber}: ${movements.length} adjustment(s) posted. Reason: ${reviewReason}`,
    });
    return updated;
  });
}

export async function rejectStockCount(countId: string, reviewedBy: string, reviewReason: string): Promise<StockCount> {
  const sc = await db.stockCounts.get(countId);
  if (!sc) throw new Error("Stock count not found");
  const updated: StockCount = { ...sc, status: "rejected", reviewedBy, reviewedAt: nowIso(), reviewReason };
  await db.stockCounts.put(updated);
  await logActivity({
    actor: reviewedBy,
    action: "stock_count_rejected",
    entityType: "stock_count",
    entityId: sc.id,
    description: `Rejected ${sc.countNumber}. Reason: ${reviewReason}`,
  });
  return updated;
}

export async function getStockCounts(): Promise<StockCount[]> {
  return db.stockCounts.orderBy("createdAt").reverse().toArray();
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function getRecentActivity(limit = 50): Promise<ActivityEvent[]> {
  return db.activityLog.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getSeedDate(): Promise<string | undefined> {
  const meta = await db.meta.get("seedDate");
  return meta?.value as string | undefined;
}

// ---------------------------------------------------------------------------
// Till reconciliation
// ---------------------------------------------------------------------------

export async function getOpenTillSession(): Promise<TillSession | undefined> {
  return db.tillSessions.where("tillId").equals(TILL_ID).and((s) => s.status === "open").first();
}

export async function getCashMovementsForSession(tillSessionId: string) {
  const all = await db.tillCashMovements.toArray();
  return all.filter((m) => m.tillSessionId === tillSessionId);
}

export async function getExpectedCashCents(session: TillSession): Promise<number> {
  const movements = await getCashMovementsForSession(session.id);
  return session.openingFloatCents + movements.reduce((sum, m) => sum + m.amountCents, 0);
}

export async function openTillSession(openedBy: string, openingFloatCents: number): Promise<TillSession> {
  const existing = await getOpenTillSession();
  if (existing) throw new Error("A till session is already open");
  const session: TillSession = {
    id: uid("till-session"),
    tillId: TILL_ID,
    status: "open",
    openingFloatCents,
    openedAt: nowIso(),
    openedBy,
  };
  await db.tillSessions.add(session);
  await logActivity({
    actor: openedBy,
    action: "till_opened",
    entityType: "till_session",
    entityId: session.id,
    description: `Opened till with a float of ${(openingFloatCents / 100).toFixed(2)}.`,
  });
  return session;
}

export async function closeTillSession(
  tillSessionId: string,
  countedCashCents: number,
  closedBy: string,
  varianceReason?: string,
): Promise<TillSession> {
  return db.transaction("rw", [db.tillSessions, db.tillCashMovements, db.activityLog], async () => {
    const session = await db.tillSessions.get(tillSessionId);
    if (!session) throw new Error("Till session not found");
    if (session.status !== "open") throw new Error("Till session is already closed");

    const expectedCashCents = await getExpectedCashCents(session);
    const varianceCents = countedCashCents - expectedCashCents;
    if (varianceCents !== 0 && !varianceReason?.trim()) {
      throw new Error("A reason is required to close the till with a cash variance");
    }

    const updated: TillSession = {
      ...session,
      status: "closed",
      closedAt: nowIso(),
      closedBy,
      countedCashCents,
      expectedCashCents,
      varianceCents,
      varianceReason: varianceCents !== 0 ? varianceReason : undefined,
    };
    await db.tillSessions.put(updated);
    await logActivity({
      actor: closedBy,
      action: "till_closed",
      entityType: "till_session",
      entityId: session.id,
      description: `Closed till. Expected ${(expectedCashCents / 100).toFixed(2)}, counted ${(countedCashCents / 100).toFixed(2)}, variance ${(varianceCents / 100).toFixed(2)}.`,
    });
    return updated;
  });
}

export async function getTillSessions(): Promise<TillSession[]> {
  return db.tillSessions.orderBy("openedAt").reverse().toArray();
}

export async function getTillVarianceExceptions(): Promise<TillSession[]> {
  const sessions = await db.tillSessions.toArray();
  return sessions.filter((s) => s.status === "closed" && (s.varianceCents ?? 0) !== 0);
}

export { TILL_ID };
