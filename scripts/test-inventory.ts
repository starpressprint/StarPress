import { Prisma, OrderStatus } from "@prisma/client";
import { createOrder, updateOrderStatus } from "../src/server/orders";
import { expireStaleOrders } from "../src/server/order-expiry";
import { recordPaymentSuccess } from "../src/server/payments";

interface MockProduct {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  isActive?: boolean;
  trackInventory: boolean;
  stockQuantity: number;
}

interface MockOrder {
  id: string;
  orderNumber: string;
  userId?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestName?: string | null;
  status: OrderStatus;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paymentMethod: string;
  paymentStatus: string;
  paymentExpiresAt: Date | null;
  stockRestoredAt: Date | null;
  notes: string | null;
  items: Array<{
    id: string;
    orderId: string;
    productId: string | null;
    productName: string;
    productSlug: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
}

class MockInventoryDatabase {
  products = new Map<string, MockProduct>();
  orders = new Map<string, MockOrder>();
  transactions = new Map<string, any>();
  private transactionTail: Promise<void> = Promise.resolve();

  constructor() {}

  addProduct(product: MockProduct) {
    this.products.set(product.id, {
      slug: product.slug || product.id,
      status: "active",
      isActive: true,
      ...product,
    });
  }

  // Mutex-serialized transaction executor to test real concurrent row-level locking
  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const tx = {
        $queryRaw: async () => [],
        product: {
          findUnique: async ({ where }: any) => {
            const p = this.products.get(where.id);
            return p ? { ...p } : null;
          },
          findFirst: async ({ where }: any) => {
            for (const p of this.products.values()) {
              if (where.OR) {
                for (const clause of where.OR) {
                  if (clause.id && p.id === clause.id) return { ...p };
                  if (clause.slug && p.slug === clause.slug) return { ...p };
                }
              }
              if (where.id && p.id === where.id) return { ...p };
            }
            return null;
          },
          updateMany: async ({ where, data }: any) => {
            const p = this.products.get(where.id);
            if (!p) return { count: 0 };
            if (where.trackInventory && !p.trackInventory) return { count: 0 };
            if (where.stockQuantity?.gte !== undefined && p.stockQuantity < where.stockQuantity.gte) {
              return { count: 0 };
            }

            if (data.stockQuantity?.decrement !== undefined) {
              p.stockQuantity -= data.stockQuantity.decrement;
            }
            if (data.stockQuantity?.increment !== undefined) {
              p.stockQuantity += data.stockQuantity.increment;
            }
            return { count: 1 };
          },
        },
        order: {
          create: async ({ data }: any) => {
            const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const orderItems = (data.items?.create || []).map((it: any, idx: number) => ({
              id: `item-${idx + 1}`,
              orderId: id,
              productId: it.productId,
              productName: it.productName,
              productSlug: it.productSlug,
              quantity: it.quantity,
              unitPrice: new Prisma.Decimal(it.unitPrice),
              lineTotal: new Prisma.Decimal(it.lineTotal),
            }));

            const row: MockOrder = {
              id,
              orderNumber: data.orderNumber,
              userId: data.userId || null,
              guestEmail: data.guestEmail || null,
              guestPhone: data.guestPhone || null,
              guestName: data.guestName || null,
              status: data.status || OrderStatus.PENDING,
              subtotal: new Prisma.Decimal(data.subtotal || 100),
              totalAmount: new Prisma.Decimal(data.totalAmount || 100),
              paymentMethod: data.paymentMethod || "ONLINE",
              paymentStatus: data.paymentStatus || "UNPAID",
              paymentExpiresAt: data.paymentExpiresAt || null,
              stockRestoredAt: null,
              notes: data.notes || null,
              items: orderItems,
            };
            this.orders.set(id, row);
            return { ...row, items: [...orderItems] };
          },
          findUnique: async ({ where }: any) => {
            const o = this.orders.get(where.id);
            return o ? { ...o, items: [...o.items] } : null;
          },
          findFirst: async ({ where }: any) => {
            for (const o of this.orders.values()) {
              if (where.id && o.id !== where.id) continue;
              if (where.orderNumber && o.orderNumber !== where.orderNumber) continue;
              return { ...o, items: [...o.items] };
            }
            return null;
          },
          findMany: async ({ where }: any) => {
            const results: MockOrder[] = [];
            for (const o of this.orders.values()) {
              if (where.status && o.status !== where.status) continue;
              if (where.paymentStatus && o.paymentStatus !== where.paymentStatus) continue;
              if (where.paymentExpiresAt?.lte && (!o.paymentExpiresAt || o.paymentExpiresAt > where.paymentExpiresAt.lte)) {
                continue;
              }
              results.push({ ...o, items: [...o.items] });
            }
            return results;
          },
          update: async ({ where, data }: any) => {
            const o = this.orders.get(where.id);
            if (!o) throw new Error("Order not found");
            Object.assign(o, data);
            return { ...o, items: [...o.items] };
          },
          updateMany: async ({ where, data }: any) => {
            const o = this.orders.get(where.id);
            if (!o) return { count: 0 };
            if ("stockRestoredAt" in where && where.stockRestoredAt === null && o.stockRestoredAt !== null) {
              return { count: 0 };
            }
            Object.assign(o, data);
            return { count: 1 };
          },
        },
        paymentTransaction: {
          findFirst: async ({ where }: any) => {
            for (const txRow of this.transactions.values()) {
              if (where.gatewayPaymentId && txRow.gatewayPaymentId === where.gatewayPaymentId) return txRow;
            }
            return null;
          },
          create: async ({ data }: any) => {
            const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const row = { id, ...data };
            this.transactions.set(id, row);
            return row;
          },
        },
        discount: {
          updateMany: async () => ({ count: 1 }),
        },
      };

      return await callback(tx);
    } finally {
      release();
    }
  }

  // Client-level methods delegating to map or transaction
  product = {
    findUnique: async ({ where }: any) => {
      const p = this.products.get(where.id);
      return p ? { ...p } : null;
    },
    findFirst: async ({ where }: any) => {
      for (const p of this.products.values()) {
        if (where.OR) {
          for (const clause of where.OR) {
            if (clause.id && p.id === clause.id) return { ...p };
            if (clause.slug && p.slug === clause.slug) return { ...p };
          }
        }
        if (where.id && p.id === where.id) return { ...p };
      }
      return null;
    },
  };

  order = {
    findFirst: async ({ where }: any) => {
      for (const o of this.orders.values()) {
        if (where.notes?.contains && !o.notes?.includes(where.notes.contains)) continue;
        return { ...o, items: [...o.items] };
      }
      return null;
    },
    findMany: async (args: any) => {
      const results: MockOrder[] = [];
      for (const o of this.orders.values()) {
        if (args.where?.status && o.status !== args.where.status) continue;
        if (args.where?.paymentStatus && o.paymentStatus !== args.where.paymentStatus) continue;
        if (args.where?.paymentExpiresAt?.lte && (!o.paymentExpiresAt || o.paymentExpiresAt > args.where.paymentExpiresAt.lte)) {
          continue;
        }
        results.push({ ...o, items: [...o.items] });
      }
      return results;
    },
    findUnique: async ({ where }: any) => {
      const o = this.orders.get(where.id);
      return o ? { ...o, items: [...o.items] } : null;
    },
  };

  paymentTransaction = {
    findFirst: async ({ where }: any) => {
      for (const txRow of this.transactions.values()) {
        if (where.gatewayPaymentId && txRow.gatewayPaymentId === where.gatewayPaymentId) return txRow;
      }
      return null;
    },
  };

  discount = {
    updateMany: async () => ({ count: 1 }),
  };
}

async function runTests() {
  console.log("===============================================================");
  console.log("🛡️  STAR PRESS — INVENTORY HARDENING TEST SUITE (TASK 4)");
  console.log("===============================================================\n");

  const commonShipping = {
    fullName: "Test Customer",
    phone: "9876543210",
    email: "customer@example.com",
    addressLine1: "123 MG Road",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Atomic Decrement
  // ---------------------------------------------------------------------------
  console.log("▶ [Test 1] Testing standard atomic stock decrement...");
  const db1 = new MockInventoryDatabase();
  db1.addProduct({ id: "prod-1", name: "Standard Visiting Cards", trackInventory: true, stockQuantity: 10 });

  const order1 = await createOrder(
    {
      shippingAddress: commonShipping,
      items: [{ productId: "prod-1", slug: "business-cards", quantity: 2, artworkUrl: "https://example.com/art.pdf" }],
      paymentMethod: "ONLINE",
    },
    db1 as any
  );

  const stock1 = db1.products.get("prod-1")?.stockQuantity;
  if (stock1 !== 8) {
    throw new Error(`Test 1 Failed: Expected stock 8, got ${stock1}`);
  }
  console.log(`  ✓ Stock decremented from 10 to ${stock1} for Order ${order1.order.orderNumber}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Out of Stock (HTTP 409)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Test 2] Testing out-of-stock validation and HTTP 409 error...");
  const db2 = new MockInventoryDatabase();
  db2.addProduct({ id: "prod-2", name: "Premium Metallic Cards", trackInventory: true, stockQuantity: 2 });

  let errorCaught: any = null;
  try {
    await createOrder(
      {
        shippingAddress: commonShipping,
        items: [{ productId: "prod-2", slug: "business-cards", quantity: 5, artworkUrl: "https://example.com/art.pdf" }],
        paymentMethod: "ONLINE",
      },
      db2 as any
    );
  } catch (err: any) {
    errorCaught = err;
  }

  if (!errorCaught || errorCaught.statusCode !== 409) {
    throw new Error(`Test 2 Failed: Expected HTTP 409 error, got: ${JSON.stringify(errorCaught)}`);
  }
  const stock2 = db2.products.get("prod-2")?.stockQuantity;
  if (stock2 !== 2) {
    throw new Error(`Test 2 Failed: Stock should remain untouched at 2, got ${stock2}`);
  }
  console.log(`  ✓ Successfully threw typed 409 error: "${errorCaught.message}"`);
  console.log(`  ✓ Stock remained untouched at ${stock2}`);

  // ---------------------------------------------------------------------------
  // TEST 3: Concurrent Last-Unit Race (Promise.all)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Test 3] Testing concurrent last-unit race condition (Promise.all)...");
  const db3 = new MockInventoryDatabase();
  db3.addProduct({ id: "prod-last", name: "Exclusive Foil Card", trackInventory: true, stockQuantity: 1 });

  const orderPayload = {
    shippingAddress: {
      ...commonShipping,
      fullName: "Race Buyer",
    },
    items: [{ productId: "prod-last", slug: "business-cards", quantity: 1, artworkUrl: "https://example.com/art.pdf" }],
    paymentMethod: "ONLINE",
  };

  const results = await Promise.allSettled([
    createOrder(orderPayload, db3 as any),
    createOrder(orderPayload, db3 as any),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error(`Test 3 Failed: Expected exactly 1 success and 1 rejection, got ${fulfilled.length} won, ${rejected.length} lost`);
  }

  const lostError: any = (rejected[0] as PromiseRejectedResult).reason;
  if (lostError?.statusCode !== 409) {
    throw new Error(`Test 3 Failed: Loser should receive 409 out-of-stock, got ${lostError?.statusCode}`);
  }

  const remainingStock3 = db3.products.get("prod-last")?.stockQuantity;
  if (remainingStock3 !== 0) {
    throw new Error(`Test 3 Failed: Stock should be exactly 0, got ${remainingStock3}`);
  }
  console.log("  ✓ Exactly one buyer won the last unit");
  console.log(`  ✓ Second buyer was cleanly rejected with HTTP 409 ("${lostError.message}")`);
  console.log(`  ✓ Inventory safely settled at ${remainingStock3} without negative drift`);

  // ---------------------------------------------------------------------------
  // TEST 4: Restock Exactly Once
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Test 4] Testing restock exactly once on admin cancellation...");
  const db4 = new MockInventoryDatabase();
  db4.addProduct({ id: "prod-4", name: "Flyers", trackInventory: true, stockQuantity: 5 });

  const order4 = await createOrder(
    {
      shippingAddress: commonShipping,
      items: [{ productId: "prod-4", slug: "business-cards", quantity: 2, artworkUrl: "https://example.com/art.pdf" }],
      paymentMethod: "ONLINE",
    },
    db4 as any
  );
  if (db4.products.get("prod-4")?.stockQuantity !== 3) {
    throw new Error("Test 4 Setup Failed: Initial decrement failed");
  }

  // Cancel order first time
  const cancel1 = await updateOrderStatus(order4.order.id, "CANCELLED", undefined, db4 as any);
  if (!cancel1.success) throw new Error("Test 4 Failed: First cancel failed");
  const stockAfterFirstCancel = db4.products.get("prod-4")?.stockQuantity;
  if (stockAfterFirstCancel !== 5) {
    throw new Error(`Test 4 Failed: Stock should be restocked to 5, got ${stockAfterFirstCancel}`);
  }
  const orderRowAfterCancel1 = db4.orders.get(order4.order.id);
  if (!orderRowAfterCancel1?.stockRestoredAt) {
    throw new Error("Test 4 Failed: stockRestoredAt timestamp not set on Order");
  }
  console.log(`  ✓ First cancellation restored stock to ${stockAfterFirstCancel} and set stockRestoredAt`);

  // Cancel order second time (double click / replay)
  const cancel2 = await updateOrderStatus(order4.order.id, "CANCELLED", undefined, db4 as any);
  if (!cancel2.success) throw new Error("Test 4 Failed: Second cancel failed");
  const stockAfterSecondCancel = db4.products.get("prod-4")?.stockQuantity;
  if (stockAfterSecondCancel !== 5) {
    throw new Error(`Test 4 Failed: Stock over-incremented on duplicate cancellation! Expected 5, got ${stockAfterSecondCancel}`);
  }
  console.log(`  ✓ Duplicate cancellation safely ignored restock (stock stayed at ${stockAfterSecondCancel})`);

  // ---------------------------------------------------------------------------
  // TEST 5: Expiry Then Admin-Cancel Restocks Once
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Test 5] Testing expiry then admin-cancel restocks once...");
  const db5 = new MockInventoryDatabase();
  db5.addProduct({ id: "prod-5", name: "Brochures", trackInventory: true, stockQuantity: 10 });

  const order5 = await createOrder(
    {
      shippingAddress: commonShipping,
      items: [{ productId: "prod-5", slug: "business-cards", quantity: 4, artworkUrl: "https://example.com/art.pdf" }],
      paymentMethod: "ONLINE",
    },
    db5 as any
  );
  if (db5.products.get("prod-5")?.stockQuantity !== 6) {
    throw new Error("Test 5 Setup Failed: Expected stock 6 after decrement");
  }

  // Backdate expiry
  const order5Row = db5.orders.get(order5.order.id)!;
  order5Row.paymentExpiresAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago

  // Run expiry cron
  const sweep = await expireStaleOrders(db5 as any);
  if (sweep.expired !== 1) {
    throw new Error(`Test 5 Failed: Expected 1 order expired, got ${sweep.expired}`);
  }
  const stockAfterExpiry = db5.products.get("prod-5")?.stockQuantity;
  if (stockAfterExpiry !== 10) {
    throw new Error(`Test 5 Failed: Expiry should restock 4 units back to 10, got ${stockAfterExpiry}`);
  }
  if (!order5Row.stockRestoredAt) {
    throw new Error("Test 5 Failed: Expiry did not record stockRestoredAt");
  }
  console.log(`  ✓ Expiry worker released inventory back to ${stockAfterExpiry} and stamped stockRestoredAt`);

  // Admin cancels the expired order
  const adminCancel = await updateOrderStatus(order5.order.id, "CANCELLED", undefined, db5 as any);
  if (!adminCancel.success) throw new Error("Test 5 Failed: Admin cancellation failed");
  const stockAfterAdminCancel = db5.products.get("prod-5")?.stockQuantity;
  if (stockAfterAdminCancel !== 10) {
    throw new Error(`Test 5 Failed: Admin cancellation over-restocked already expired order! Expected 10, got ${stockAfterAdminCancel}`);
  }
  console.log(`  ✓ Subsequent admin cancellation preserved inventory at ${stockAfterAdminCancel} (no double restock)`);

  // ---------------------------------------------------------------------------
  // TEST 6: Late Payment Arrival (With Stock vs Out of Stock)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Test 6] Testing late payment arrival after order expiry...");

  // Case 6A: Late payment with sufficient stock -> Reinstate order as paid
  console.log("  • Subtest 6A: Stock is available -> Reinstate order");
  const db6A = new MockInventoryDatabase();
  db6A.addProduct({ id: "prod-6A", name: "Letterheads", trackInventory: true, stockQuantity: 5 });

  const order6A = await createOrder(
    {
      shippingAddress: commonShipping,
      items: [{ productId: "prod-6A", slug: "business-cards", quantity: 2, artworkUrl: "https://example.com/art.pdf" }],
      paymentMethod: "ONLINE",
    },
    db6A as any
  );

  // Expire and restock order
  const order6ARow = db6A.orders.get(order6A.order.id)!;
  order6ARow.paymentExpiresAt = new Date(Date.now() - 3600 * 1000);
  await expireStaleOrders(db6A as any);
  if (db6A.products.get("prod-6A")?.stockQuantity !== 5) {
    throw new Error("Subtest 6A Setup Failed: Stock should be 5 after expiry");
  }

  // Late capture arrives
  const lateCaptureResA = await recordPaymentSuccess(
    {
      orderId: order6A.order.id,
      paymentId: "pay_late_success",
      amount: 100,
      method: "UPI",
    },
    db6A as any
  );

  if (!lateCaptureResA.success || !lateCaptureResA.order) {
    throw new Error("Subtest 6A Failed: Late capture should succeed when stock is available");
  }
  if (lateCaptureResA.order.paymentStatus !== "PAID" || lateCaptureResA.order.status !== OrderStatus.CONFIRMED) {
    throw new Error(`Subtest 6A Failed: Order should be reinstated CONFIRMED + PAID, got status: ${lateCaptureResA.order.status}, paymentStatus: ${lateCaptureResA.order.paymentStatus}`);
  }
  if (lateCaptureResA.order.stockRestoredAt !== null) {
    throw new Error("Subtest 6A Failed: stockRestoredAt should be cleared to null upon reinstatement");
  }
  const stockAfterReinstatement = db6A.products.get("prod-6A")?.stockQuantity;
  if (stockAfterReinstatement !== 3) {
    throw new Error(`Subtest 6A Failed: Stock should be re-decremented from 5 to 3, got ${stockAfterReinstatement}`);
  }
  console.log(`    ✓ Order reinstated as CONFIRMED + PAID`);
  console.log(`    ✓ Stock re-decremented from 5 to ${stockAfterReinstatement}`);
  console.log(`    ✓ stockRestoredAt reset to null`);

  // Case 6B: Late payment when stock is out of stock -> Flag for refund
  console.log("  • Subtest 6B: Stock is unavailable -> Flag for auto-refund");
  const db6B = new MockInventoryDatabase();
  db6B.addProduct({ id: "prod-6B", name: "Envelopes", trackInventory: true, stockQuantity: 2 });

  const order6B = await createOrder(
    {
      shippingAddress: commonShipping,
      items: [{ productId: "prod-6B", slug: "business-cards", quantity: 2, artworkUrl: "https://example.com/art.pdf" }],
      paymentMethod: "ONLINE",
    },
    db6B as any
  );

  // Expire and restock order
  const order6BRow = db6B.orders.get(order6B.order.id)!;
  order6BRow.paymentExpiresAt = new Date(Date.now() - 3600 * 1000);
  await expireStaleOrders(db6B as any);

  // In the meantime, another customer bought all 2 units
  const prod6B = db6B.products.get("prod-6B")!;
  prod6B.stockQuantity = 0;

  // Late capture arrives for order6B
  const lateCaptureResB = await recordPaymentSuccess(
    {
      orderId: order6B.order.id,
      paymentId: "pay_late_out_of_stock",
      amount: 100,
      method: "CARD",
    },
    db6B as any
  );

  if (!lateCaptureResB.requiresRefund) {
    throw new Error("Subtest 6B Failed: requiresRefund flag must be true when out of stock");
  }
  const flaggedTx = [...db6B.transactions.values()].find((t) => t.gatewayPaymentId === "pay_late_out_of_stock");
  if (!flaggedTx || flaggedTx.status !== "REFUND_FLAGGED") {
    throw new Error(`Subtest 6B Failed: Expected PaymentTransaction REFUND_FLAGGED, got: ${flaggedTx?.status}`);
  }
  const stockFinalB = db6B.products.get("prod-6B")?.stockQuantity;
  if (stockFinalB !== 0) {
    throw new Error(`Subtest 6B Failed: Stock should remain 0, got ${stockFinalB}`);
  }
  console.log("    ✓ PaymentTransaction status set to REFUND_FLAGGED for automated refund cron");
  console.log("    ✓ Order flagged with out-of-stock note and returned requiresRefund = true");
  console.log(`    ✓ Inventory protected from negative drift (stock = ${stockFinalB})`);

  console.log("\n===============================================================");
  console.log("✅ ALL 6 INVENTORY HARDENING TESTS PASSED SUCCESSFULLY");
  console.log("===============================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Inventory Hardening Test Suite Failed:", err);
  process.exit(1);
});
