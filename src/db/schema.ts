import Dexie, { type Table } from "dexie";
import type {
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  Receipt,
  StockMovement,
  Sale,
  DiscountApproval,
  StockCount,
  TillSession,
  TillCashMovement,
  ActivityEvent,
  OperationLog,
} from "../domain/types";

export class StirpsDB extends Dexie {
  products!: Table<Product, string>;
  suppliers!: Table<Supplier, string>;
  customers!: Table<Customer, string>;
  purchaseOrders!: Table<PurchaseOrder, string>;
  receipts!: Table<Receipt, string>;
  stockMovements!: Table<StockMovement, string>;
  sales!: Table<Sale, string>;
  discountApprovals!: Table<DiscountApproval, string>;
  stockCounts!: Table<StockCount, string>;
  tillSessions!: Table<TillSession, string>;
  tillCashMovements!: Table<TillCashMovement, string>;
  activityLog!: Table<ActivityEvent, string>;
  operationLog!: Table<OperationLog, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("stirps-demo-db");
    this.version(1).stores({
      products: "id, sku, barcode, category",
      suppliers: "id, name",
      customers: "id, name, kind",
      purchaseOrders: "id, poNumber, supplierId, status, createdAt",
      receipts: "id, receiptNumber, poId, receivedAt, hasShortage",
      stockMovements: "id, productId, type, sourceType, sourceId, timestamp, [productId+timestamp]",
      sales: "id, saleNumber, channel, customerId, createdAt, status, tillSessionId",
      discountApprovals: "id, status, requestedAt",
      stockCounts: "id, countNumber, status, createdAt",
      tillSessions: "id, tillId, status, openedAt",
      tillCashMovements: "id, type, sourceId, timestamp",
      activityLog: "id, timestamp, entityType, entityId",
      operationLog: "operationId, kind, createdAt",
      meta: "key",
    });
  }
}

export const db = new StirpsDB();
