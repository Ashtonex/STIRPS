// Core domain types for the STIRPS demo prototype.
// Money is stored in integer minor units (cents). Quantities are stored in base units (each).

export type ProductId = string;
export type SupplierId = string;
export type CustomerId = string;
export type PurchaseOrderId = string;
export type ReceiptId = string;
export type SaleId = string;
export type StockCountId = string;
export type MovementId = string;
export type ActivityId = string;
export type DiscountApprovalId = string;
export type TillSessionId = string;

export const LOCATION_ID = "main-store";
export const ORG_ID = "demo-org";
export const TILL_ID = "till-1";

export interface Product {
  id: ProductId;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  /** Label for a single base unit, e.g. "unit", "kg", "loaf" */
  unitLabel: string;
  /** If the product can be sold/ordered by the case, units per case. Undefined = unit-only product. */
  caseUnitQty?: number;
  /** True for weighted products priced per base-unit fraction (e.g. per kg) */
  isWeighted?: boolean;
  retailPriceCents: number;
  wholesalePriceCents: number;
  costCents: number;
  reorderPoint: number;
  lowStockThreshold: number;
  active: boolean;
}

export interface Supplier {
  id: SupplierId;
  name: string;
  contact: string;
}

export interface Customer {
  id: CustomerId;
  name: string;
  kind: "retail" | "wholesale";
  contact: string;
  creditLimitCents?: number;
}

export type POStatus = "draft" | "submitted" | "partially_received" | "received" | "closed";

export interface PurchaseOrderLine {
  productId: ProductId;
  orderedCases: number;
  orderedUnits: number; // total base units ordered (orderedCases * caseUnitQty, or raw units)
  receivedUnits: number; // running total received against this line
}

export interface PurchaseOrder {
  id: PurchaseOrderId;
  poNumber: string;
  supplierId: SupplierId;
  status: POStatus;
  lines: PurchaseOrderLine[];
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface ReceiptLine {
  productId: ProductId;
  qtyReceivedUnits: number;
  batchCode?: string;
  expiryDate?: string;
}

export interface Receipt {
  id: ReceiptId;
  receiptNumber: string;
  poId: PurchaseOrderId;
  lines: ReceiptLine[];
  receivedAt: string;
  receivedBy: string;
  shortageNotes?: string;
  hasShortage: boolean;
}

export type MovementType =
  | "purchase_receipt"
  | "sale"
  | "count_adjustment"
  | "damage"
  | "return_restock"
  | "opening_stock";

export interface StockMovement {
  id: MovementId;
  orgId: string;
  locationId: string;
  productId: ProductId;
  batchCode?: string;
  expiryDate?: string;
  qtyDeltaUnits: number; // positive = stock in, negative = stock out
  type: MovementType;
  sourceType: string;
  sourceId: string;
  actor: string;
  timestamp: string;
  reason?: string;
}

export type SaleChannel = "retail" | "wholesale";
export type SaleUnit = "unit" | "case";
export type PaymentMethod = "cash" | "card" | "credit";

export interface SaleLine {
  productId: ProductId;
  saleUnit: SaleUnit;
  qty: number; // in the chosen sale unit (units or cases)
  qtyBaseUnits: number; // resolved to base units
  unitPriceCents: number; // price per the chosen sale unit
  lineTotalCents: number;
}

export interface Sale {
  id: SaleId;
  saleNumber: string;
  channel: SaleChannel;
  customerId?: CustomerId;
  lines: SaleLine[];
  subtotalCents: number;
  discountCents: number;
  discountApprovalId?: DiscountApprovalId;
  totalCents: number;
  paymentMethod: PaymentMethod;
  tenderedCents?: number;
  changeCents?: number;
  status: "completed" | "voided";
  createdAt: string;
  createdBy: string;
  tillSessionId?: string;
}

export type DiscountApprovalStatus = "pending" | "approved" | "rejected";

export interface DiscountApproval {
  id: DiscountApprovalId;
  saleBasketHash: string;
  requestedDiscountCents: number;
  subtotalCents: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: DiscountApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export type StockCountStatus = "draft" | "submitted" | "approved" | "rejected";

export interface StockCountLine {
  productId: ProductId;
  expectedUnits: number; // snapshotted at submit time, hidden from counter until reveal
  countedUnits: number | null;
  varianceUnits: number | null;
}

export interface StockCount {
  id: StockCountId;
  countNumber: string;
  status: StockCountStatus;
  lines: StockCountLine[];
  createdAt: string;
  createdBy: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

export type TillSessionStatus = "open" | "closed";

export interface TillCashMovement {
  id: string;
  tillSessionId: string;
  type: "sale_cash_in" | "refund_cash_out" | "float_in" | "paid_out";
  amountCents: number; // positive = cash in, negative = cash out
  sourceType: string;
  sourceId: string;
  actor: string;
  timestamp: string;
}

export interface TillSession {
  id: TillSessionId;
  tillId: string;
  status: TillSessionStatus;
  openingFloatCents: number;
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  closedBy?: string;
  countedCashCents?: number;
  expectedCashCents?: number;
  varianceCents?: number;
  varianceReason?: string;
}

export interface ActivityEvent {
  id: ActivityId;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
}

export interface OperationLog {
  /** Idempotency key used to prevent duplicate posting of the same business operation. */
  operationId: string;
  kind: string;
  createdAt: string;
}

export type DemoRole = "owner" | "manager" | "cashier" | "storekeeper";
