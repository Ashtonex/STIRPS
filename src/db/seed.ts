import type {
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  Receipt,
  StockMovement,
  Sale,
  TillSession,
  ActivityEvent,
} from "../domain/types";
import { LOCATION_ID, ORG_ID, TILL_ID } from "../domain/types";

/** The dedicated demonstration SKU used in the live pitch walkthrough. Opens at zero stock. */
export const DEMO_PRODUCT_ID = "sku-oil-2l";
export const DEMO_SUPPLIER_ID = "sup-harare-wholesale";
export const DEMO_CASE_UNIT_QTY = 12;

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export interface SeedBundle {
  seedDate: string;
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  receipts: Receipt[];
  openingMovements: StockMovement[];
  historicalSales: Sale[];
  historicalSaleMovements: StockMovement[];
  tillSessions: TillSession[];
  activity: ActivityEvent[];
}

let movementCounter = 0;
function nextId(prefix: string): string {
  movementCounter += 1;
  return `${prefix}-${movementCounter.toString().padStart(5, "0")}`;
}

export function buildSeed(): SeedBundle {
  movementCounter = 0;
  const now = new Date();
  const seedDate = now.toISOString();
  const yesterday = addDays(now, -1);

  const suppliers: Supplier[] = [
    { id: "sup-harare-wholesale", name: "Harare Wholesale Distributors", contact: "orders@hwd.demo" },
    { id: "sup-fresh-valley", name: "Fresh Valley Farms", contact: "sales@freshvalley.demo" },
    { id: "sup-mukuru", name: "Mukuru FMCG Supplies", contact: "info@mukurufmcg.demo" },
  ];

  const customers: Customer[] = [
    { id: "cust-walkin", name: "Walk-in Customer", kind: "retail", contact: "-" },
    { id: "cust-corner-store", name: "Corner Store Chiremba", kind: "wholesale", contact: "chiremba@store.demo" },
    { id: "cust-mama-edna", name: "Mama Edna's Tuckshop", kind: "wholesale", contact: "edna@tuckshop.demo" },
  ];

  const products: Product[] = [
    {
      id: DEMO_PRODUCT_ID,
      sku: "OIL-2L-001",
      barcode: "6001234500019",
      name: "Sunfresh Cooking Oil 2L",
      category: "Cooking Essentials",
      unitLabel: "bottle",
      caseUnitQty: DEMO_CASE_UNIT_QTY,
      retailPriceCents: 450,
      wholesalePriceCents: 400,
      costCents: 320,
      reorderPoint: 24,
      lowStockThreshold: 24,
      active: true,
    },
    {
      id: "sku-maize-meal",
      sku: "MLM-10KG-002",
      barcode: "6001234500026",
      name: "Golden Harvest Maize Meal 10kg",
      category: "Grains & Staples",
      unitLabel: "bag",
      caseUnitQty: 5,
      retailPriceCents: 800,
      wholesalePriceCents: 720,
      costCents: 600,
      reorderPoint: 10,
      lowStockThreshold: 10,
      active: true,
    },
    {
      id: "sku-sugar",
      sku: "SUG-2KG-003",
      barcode: "6001234500033",
      name: "White Star Sugar 2kg",
      category: "Grains & Staples",
      unitLabel: "bag",
      caseUnitQty: 12,
      retailPriceCents: 250,
      wholesalePriceCents: 220,
      costCents: 180,
      reorderPoint: 20,
      lowStockThreshold: 20,
      active: true,
    },
    {
      id: "sku-rice",
      sku: "RIC-5KG-004",
      barcode: "6001234500040",
      name: "Tanzanite Rice 5kg",
      category: "Grains & Staples",
      unitLabel: "bag",
      caseUnitQty: 8,
      retailPriceCents: 600,
      wholesalePriceCents: 540,
      costCents: 450,
      reorderPoint: 16,
      lowStockThreshold: 16,
      active: true,
    },
    {
      id: "sku-salt",
      sku: "SLT-1KG-005",
      barcode: "6001234500057",
      name: "Red Seal Salt 1kg",
      category: "Grains & Staples",
      unitLabel: "bag",
      caseUnitQty: 24,
      retailPriceCents: 80,
      wholesalePriceCents: 65,
      costCents: 45,
      reorderPoint: 24,
      lowStockThreshold: 24,
      active: true,
    },
    {
      id: "sku-flour",
      sku: "FLR-2KG-006",
      barcode: "6001234500064",
      name: "Blue Ribbon Flour 2kg",
      category: "Grains & Staples",
      unitLabel: "bag",
      caseUnitQty: 12,
      retailPriceCents: 280,
      wholesalePriceCents: 250,
      costCents: 200,
      reorderPoint: 18,
      lowStockThreshold: 18,
      active: true,
    },
    {
      id: "sku-tea",
      sku: "TEA-100B-007",
      barcode: "6001234500071",
      name: "Tanganda Tea 100 Bags",
      category: "Beverages",
      unitLabel: "box",
      caseUnitQty: 24,
      retailPriceCents: 320,
      wholesalePriceCents: 290,
      costCents: 230,
      reorderPoint: 20,
      lowStockThreshold: 20,
      active: true,
    },
    {
      id: "sku-coffee",
      sku: "COF-250G-008",
      barcode: "6001234500088",
      name: "Jenna Coffee 250g",
      category: "Beverages",
      unitLabel: "jar",
      caseUnitQty: 24,
      retailPriceCents: 400,
      wholesalePriceCents: 360,
      costCents: 280,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
    {
      id: "sku-dishwash",
      sku: "DSH-750ML-009",
      barcode: "6001234500095",
      name: "Sunlight Dishwashing Liquid 750ml",
      category: "Household",
      unitLabel: "bottle",
      caseUnitQty: 12,
      retailPriceCents: 220,
      wholesalePriceCents: 195,
      costCents: 150,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
    {
      id: "sku-washpowder",
      sku: "WSP-2KG-010",
      barcode: "6001234500101",
      name: "Surf Washing Powder 2kg",
      category: "Household",
      unitLabel: "box",
      caseUnitQty: 6,
      retailPriceCents: 550,
      wholesalePriceCents: 490,
      costCents: 380,
      reorderPoint: 10,
      lowStockThreshold: 10,
      active: true,
    },
    {
      id: "sku-soap",
      sku: "SOP-175G-011",
      barcode: "6001234500118",
      name: "Lifebuoy Soap Bar 175g",
      category: "Household",
      unitLabel: "bar",
      caseUnitQty: 48,
      retailPriceCents: 60,
      wholesalePriceCents: 50,
      costCents: 35,
      reorderPoint: 30,
      lowStockThreshold: 30,
      active: true,
    },
    {
      id: "sku-milk",
      sku: "MLK-1L-012",
      barcode: "6001234500125",
      name: "Dairibord Full Cream Milk 1L",
      category: "Dairy & Chilled",
      unitLabel: "carton",
      caseUnitQty: 12,
      retailPriceCents: 120,
      wholesalePriceCents: 105,
      costCents: 85,
      reorderPoint: 24,
      lowStockThreshold: 24,
      active: true,
    },
    {
      id: "sku-bread",
      sku: "BRD-700G-013",
      barcode: "6001234500132",
      name: "Lobels White Bread 700g",
      category: "Bakery",
      unitLabel: "loaf",
      caseUnitQty: 20,
      retailPriceCents: 150,
      wholesalePriceCents: 130,
      costCents: 100,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
    {
      id: "sku-eggs",
      sku: "EGG-T30-014",
      barcode: "6001234500149",
      name: "Farm Fresh Eggs Tray (30)",
      category: "Dairy & Chilled",
      unitLabel: "tray",
      retailPriceCents: 480,
      wholesalePriceCents: 430,
      costCents: 350,
      reorderPoint: 12,
      lowStockThreshold: 12,
      active: true,
    },
    {
      id: "sku-peanutbutter",
      sku: "PNB-400G-015",
      barcode: "6001234500156",
      name: "Bakers Inn Peanut Butter 400g",
      category: "Pantry",
      unitLabel: "jar",
      caseUnitQty: 12,
      retailPriceCents: 350,
      wholesalePriceCents: 310,
      costCents: 240,
      reorderPoint: 12,
      lowStockThreshold: 12,
      active: true,
    },
    {
      id: "sku-jam",
      sku: "JAM-450G-016",
      barcode: "6001234500163",
      name: "Sun Jam Strawberry 450g",
      category: "Pantry",
      unitLabel: "jar",
      caseUnitQty: 12,
      retailPriceCents: 300,
      wholesalePriceCents: 270,
      costCents: 200,
      reorderPoint: 10,
      lowStockThreshold: 10,
      active: true,
    },
    {
      id: "sku-beans",
      sku: "BNS-400G-017",
      barcode: "6001234500170",
      name: "Mama's Canned Beans 400g",
      category: "Canned Goods",
      unitLabel: "can",
      caseUnitQty: 24,
      retailPriceCents: 110,
      wholesalePriceCents: 95,
      costCents: 70,
      reorderPoint: 30,
      lowStockThreshold: 30,
      active: true,
    },
    {
      id: "sku-cannedtomato",
      sku: "CNT-400G-018",
      barcode: "6001234500187",
      name: "Cairns Canned Tomatoes 400g",
      category: "Canned Goods",
      unitLabel: "can",
      caseUnitQty: 24,
      retailPriceCents: 100,
      wholesalePriceCents: 85,
      costCents: 65,
      reorderPoint: 30,
      lowStockThreshold: 30,
      active: true,
    },
    {
      id: "sku-spaghetti",
      sku: "SPG-500G-019",
      barcode: "6001234500194",
      name: "ProBrands Spaghetti 500g",
      category: "Pantry",
      unitLabel: "pack",
      caseUnitQty: 20,
      retailPriceCents: 180,
      wholesalePriceCents: 155,
      costCents: 120,
      reorderPoint: 20,
      lowStockThreshold: 20,
      active: true,
    },
    {
      id: "sku-bananas",
      sku: "BAN-KG-020",
      barcode: "6001234500200",
      name: "Freshmark Bananas",
      category: "Produce",
      unitLabel: "kg",
      isWeighted: true,
      retailPriceCents: 140,
      wholesalePriceCents: 110,
      costCents: 70,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
    {
      id: "sku-tomatoes-fresh",
      sku: "TOM-KG-021",
      barcode: "6001234500217",
      name: "Freshmark Tomatoes",
      category: "Produce",
      unitLabel: "kg",
      isWeighted: true,
      retailPriceCents: 180,
      wholesalePriceCents: 140,
      costCents: 90,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
    {
      id: "sku-chicken",
      sku: "CHK-1KG-022",
      barcode: "6001234500224",
      name: "Irvines Chicken Pieces 1kg (Frozen)",
      category: "Frozen",
      unitLabel: "pack",
      caseUnitQty: 10,
      retailPriceCents: 420,
      wholesalePriceCents: 380,
      costCents: 300,
      reorderPoint: 15,
      lowStockThreshold: 15,
      active: true,
    },
  ];

  const openingMovements: StockMovement[] = [];
  function openingStock(productId: string, qty: number, batchCode?: string, expiryDate?: string) {
    openingMovements.push({
      id: nextId("mv-open"),
      orgId: ORG_ID,
      locationId: LOCATION_ID,
      productId,
      batchCode,
      qtyDeltaUnits: qty,
      type: "opening_stock",
      sourceType: "seed",
      sourceId: "seed-opening",
      actor: "System Seed",
      timestamp: addDays(now, -14),
      reason: "Initial demo opening balance",
      expiryDate,
    });
  }

  openingStock("sku-sugar", 80);
  openingStock("sku-rice", 60);
  openingStock("sku-salt", 120);
  openingStock("sku-flour", 90);
  openingStock("sku-tea", 70);
  openingStock("sku-coffee", 55);
  openingStock("sku-dishwash", 65);
  openingStock("sku-washpowder", 40);
  openingStock("sku-soap", 18); // below reorder point -> low stock demo
  openingStock("sku-milk", 40, "MLK-BATCH-A", addDays(now, 20));
  openingStock("sku-milk", 24, "MLK-BATCH-B", addDays(now, 2)); // near-expiry batch
  openingStock("sku-bread", 30, "BRD-BATCH-A", addDays(now, 1)); // near-expiry batch
  openingStock("sku-eggs", 45);
  openingStock("sku-peanutbutter", 36);
  openingStock("sku-jam", 30);
  openingStock("sku-beans", 96);
  openingStock("sku-cannedtomato", 84);
  openingStock("sku-spaghetti", 70);
  openingStock("sku-bananas", 85);
  openingStock("sku-tomatoes-fresh", 60);
  openingStock("sku-chicken", 50);

  // Damaged stock example: freezer malfunction on chicken pieces.
  openingMovements.push({
    id: nextId("mv-damage"),
    orgId: ORG_ID,
    locationId: LOCATION_ID,
    productId: "sku-chicken",
    qtyDeltaUnits: -5,
    type: "damage",
    sourceType: "damage_record",
    sourceId: "damage-seed-1",
    actor: "Tendai (Storekeeper)",
    timestamp: addDays(now, -2),
    reason: "Freezer malfunction overnight - stock thawed and discarded",
  });

  // Historical purchase order + receipt for Maize Meal, fully received, shown as receiving history.
  const histPoId = "po-1000";
  const histReceiptId = "rcpt-1000";
  const purchaseOrders: PurchaseOrder[] = [
    {
      id: histPoId,
      poNumber: "PO-1000",
      supplierId: "sup-harare-wholesale",
      status: "received",
      createdAt: addDays(now, -6),
      createdBy: "Tendai (Storekeeper)",
      lines: [
        {
          productId: "sku-maize-meal",
          orderedCases: 5,
          orderedUnits: 25,
          receivedUnits: 25,
        },
      ],
    },
  ];
  const receipts: Receipt[] = [
    {
      id: histReceiptId,
      receiptNumber: "RCPT-1000",
      poId: histPoId,
      lines: [{ productId: "sku-maize-meal", qtyReceivedUnits: 25 }],
      receivedAt: addDays(now, -5),
      receivedBy: "Tendai (Storekeeper)",
      hasShortage: false,
    },
  ];
  openingMovements.push({
    id: nextId("mv-receipt"),
    orgId: ORG_ID,
    locationId: LOCATION_ID,
    productId: "sku-maize-meal",
    qtyDeltaUnits: 25,
    type: "purchase_receipt",
    sourceType: "receipt",
    sourceId: histReceiptId,
    actor: "Tendai (Storekeeper)",
    timestamp: addDays(now, -5),
    reason: undefined,
  });

  // The live demo purchase order: 10 cases of cooking oil, submitted but not yet received.
  purchaseOrders.push({
    id: "po-1001",
    poNumber: "PO-1001",
    supplierId: DEMO_SUPPLIER_ID,
    status: "submitted",
    createdAt: addDays(now, -1),
    createdBy: "Tendai (Storekeeper)",
    lines: [
      {
        productId: DEMO_PRODUCT_ID,
        orderedCases: 10,
        orderedUnits: 10 * DEMO_CASE_UNIT_QTY,
        receivedUnits: 0,
      },
    ],
  });

  // Historical retail/wholesale sales for Owner Overview context (not touching the demo product).
  const historicalSales: Sale[] = [];
  const historicalSaleMovements: StockMovement[] = [];

  function historicalSale(opts: {
    id: string;
    saleNumber: string;
    channel: "retail" | "wholesale";
    customerId?: string;
    createdAt: string;
    paymentMethod: "cash" | "card" | "credit";
    lines: { productId: string; saleUnit: "unit" | "case"; qty: number; qtyBaseUnits: number; unitPriceCents: number }[];
  }) {
    const lines = opts.lines.map((l) => ({
      ...l,
      lineTotalCents: l.qty * l.unitPriceCents,
    }));
    const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    historicalSales.push({
      id: opts.id,
      saleNumber: opts.saleNumber,
      channel: opts.channel,
      customerId: opts.customerId,
      lines,
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      paymentMethod: opts.paymentMethod,
      tenderedCents: opts.paymentMethod === "cash" ? subtotalCents : undefined,
      changeCents: opts.paymentMethod === "cash" ? 0 : undefined,
      status: "completed",
      createdAt: opts.createdAt,
      createdBy: "Chipo (Cashier)",
    });
    for (const l of lines) {
      historicalSaleMovements.push({
        id: nextId("mv-sale"),
        orgId: ORG_ID,
        locationId: LOCATION_ID,
        productId: l.productId,
        qtyDeltaUnits: -l.qtyBaseUnits,
        type: "sale",
        sourceType: "sale",
        sourceId: opts.id,
        actor: "Chipo (Cashier)",
        timestamp: opts.createdAt,
      });
    }
  }

  historicalSale({
    id: "sale-hist-1",
    saleNumber: "SL-0001",
    channel: "retail",
    customerId: "cust-walkin",
    createdAt: addDays(now, -1),
    paymentMethod: "cash",
    lines: [
      { productId: "sku-bread", saleUnit: "unit", qty: 3, qtyBaseUnits: 3, unitPriceCents: 150 },
      { productId: "sku-milk", saleUnit: "unit", qty: 4, qtyBaseUnits: 4, unitPriceCents: 120 },
    ],
  });

  historicalSale({
    id: "sale-hist-2",
    saleNumber: "SL-0002",
    channel: "retail",
    customerId: "cust-walkin",
    createdAt: addDays(now, -1),
    paymentMethod: "card",
    lines: [
      { productId: "sku-sugar", saleUnit: "unit", qty: 2, qtyBaseUnits: 2, unitPriceCents: 250 },
      { productId: "sku-cannedtomato", saleUnit: "unit", qty: 6, qtyBaseUnits: 6, unitPriceCents: 100 },
    ],
  });

  historicalSale({
    id: "sale-hist-3",
    saleNumber: "SL-0003",
    channel: "wholesale",
    customerId: "cust-corner-store",
    createdAt: yesterday,
    paymentMethod: "credit",
    lines: [{ productId: "sku-beans", saleUnit: "case", qty: 1, qtyBaseUnits: 24, unitPriceCents: 95 * 24 }],
  });

  historicalSale({
    id: "sale-hist-4",
    saleNumber: "SL-0004",
    channel: "retail",
    customerId: "cust-walkin",
    createdAt: addDays(now, -1),
    paymentMethod: "cash",
    lines: [{ productId: "sku-bananas", saleUnit: "unit", qty: 3, qtyBaseUnits: 3, unitPriceCents: 140 }],
  });

  const tillSessions: TillSession[] = [
    {
      id: "till-session-1",
      tillId: TILL_ID,
      status: "open",
      openingFloatCents: 5000,
      openedAt: now.toISOString(),
      openedBy: "Chipo (Cashier)",
    },
  ];

  const activity: ActivityEvent[] = [
    {
      id: nextId("act"),
      timestamp: now.toISOString(),
      actor: "System Seed",
      action: "demo_seeded",
      entityType: "system",
      entityId: "seed",
      description: "Demonstration business data seeded for STIRPS pitch prototype.",
    },
  ];

  return {
    seedDate,
    products,
    suppliers,
    customers,
    purchaseOrders,
    receipts,
    openingMovements,
    historicalSales,
    historicalSaleMovements,
    tillSessions,
    activity,
  };
}
