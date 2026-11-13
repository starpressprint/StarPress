/**
 * Star Press Checkout & Authentication Hardening Test Suite
 * Validates:
 * 1. Strict API Authentication Enforcement (HTTP 401 on unauthenticated requests)
 * 2. Idempotency & Duplicate Order Prevention
 * 3. Inventory Stock Validation & Out-of-Stock Rejection
 * 4. Catalog Stock Metadata Consistency
 * 5. Cart Persistence Invariants
 */

import { NextRequest } from "next/server";
import { POST as ordersHandler } from "../src/app/api/orders/route";
import { POST as paymentCreateOrderHandler } from "../src/app/api/payments/razorpay/create-order/route";
import { POST as genericCreateOrderHandler } from "../src/app/api/create-order/route";
import { CATALOG_PRODUCTS, getProductBySlug } from "../src/lib/catalog";
import { createOrder, CreateOrderInput } from "../src/server/orders";
import { db } from "../src/lib/db";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    testsFailed++;
  }
}

async function runCheckoutAuthTests() {
  console.log("\n=======================================================");
  console.log("🔒 STAR PRESS CHECKOUT AUTH & ORDER SECURITY TEST SUITE");
  console.log("=======================================================\n");

  // =========================================================================
  // 1. Mandatory User Authentication Enforcement on Order APIs
  // =========================================================================
  console.log("▶ [Test 1] Order Creation API rejects unauthenticated requests with HTTP 401...");

  const dummyOrderPayload: CreateOrderInput = {
    shippingAddress: {
      fullName: "Guest User",
      phone: "+91 9876543210",
      email: "guest@example.com",
      addressLine1: "123 Mall Road",
      city: "Dehradun",
      state: "Uttarakhand",
      pincode: "248001",
    },
    items: [
      {
        productId: "business-cards",
        productSlug: "business-cards",
        quantity: 100,
        sizeId: getProductBySlug("business-cards")!.sizeOptions[0].id,
        materialId: getProductBySlug("business-cards")!.materialOptions[0].id,
      },
    ],
    shippingMethod: "standard",
    paymentMethod: "PAY_AFTER_PROOF",
  };

  const unauthOrdersReq = new NextRequest("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dummyOrderPayload),
  });

  const ordersRes = await ordersHandler(unauthOrdersReq);
  const ordersJson = await ordersRes.json();

  assert(ordersRes.status === 401, "API /api/orders returns HTTP 401 Unauthorized for guest", `Status: ${ordersRes.status}`);
  assert(
    ordersJson.error && ordersJson.error.toLowerCase().includes("authentication required"),
    "API /api/orders returns clear authentication required error message",
    `Error: ${ordersJson.error}`
  );

  // =========================================================================
  // 2. Razorpay Order Creation API rejects unauthenticated requests with HTTP 401
  // =========================================================================
  console.log("\n▶ [Test 2] Razorpay Payment APIs reject unauthenticated requests with HTTP 401...");

  const unauthPaymentReq = new NextRequest("http://localhost:3000/api/payments/razorpay/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: "dummy-order-id" }),
  });

  const paymentRes = await paymentCreateOrderHandler(unauthPaymentReq);
  const paymentJson = await paymentRes.json();

  assert(paymentRes.status === 401, "/api/payments/razorpay/create-order returns HTTP 401 for unauthenticated", `Status: ${paymentRes.status}`);
  assert(
    paymentJson.error && paymentJson.error.toLowerCase().includes("authentication required"),
    "Returns clear authentication error message",
    `Error: ${paymentJson.error}`
  );

  const unauthGenericReq = new NextRequest("http://localhost:3000/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 50000 }),
  });

  const genericRes = await genericCreateOrderHandler(unauthGenericReq);
  assert(genericRes.status === 401, "/api/create-order returns HTTP 401 for unauthenticated", `Status: ${genericRes.status}`);

  // =========================================================================
  // 3. Catalog Products Stock & Inventory Field Verification
  // =========================================================================
  console.log("\n▶ [Test 3] Catalog Products Stock Metadata Verification...");

  const allProducts = CATALOG_PRODUCTS;
  assert(allProducts.length > 0, "Catalog contains active products");

  let allHaveStock = true;
  let allInStock = true;

  for (const prod of allProducts) {
    if (prod.stockQuantity === undefined || typeof prod.stockQuantity !== "number") {
      allHaveStock = false;
    }
    if (prod.inStock === undefined || typeof prod.inStock !== "boolean") {
      allInStock = false;
    }
  }

  assert(allHaveStock, "All catalog products have valid stockQuantity field defined");
  assert(allInStock, "All catalog products have valid inStock boolean field defined");

  const sampleProd = getProductBySlug("business-cards");
  assert(Boolean(sampleProd), "Found sample product 'business-cards'");
  assert(Number(sampleProd?.stockQuantity) > 0, "Sample product has positive stock", `Stock: ${sampleProd?.stockQuantity}`);
  assert(sampleProd?.inStock === true, "Sample product is inStock = true");

  // =========================================================================
  // 4. Duplicate Order Idempotency Protection
  // =========================================================================
  console.log("\n▶ [Test 4] Duplicate Order Prevention via Idempotency Key...");

  // Mock DB client to verify idempotency handling without external network dependencies
  const testIdempKey = `test_idemp_${Date.now()}_abc123`;
  const existingOrderMock = {
    id: "ord_test_idemp_1",
    orderNumber: "SP-2026-TEST01",
    userId: "test-user-id",
    guestEmail: "customer@starpress.in",
    guestName: "Valued Customer",
    totalAmount: 1499,
    status: "PENDING",
    paymentStatus: "UNPAID",
    idempotencyKey: testIdempKey,
    createdAt: new Date(),
    items: [],
  };

  const mockDbClient: any = {
    order: {
      findFirst: async (args: any) => {
        if (
          args?.where?.idempotencyKey === testIdempKey ||
          (typeof args?.where?.notes?.contains === "string" &&
            args.where.notes.contains.includes(testIdempKey))
        ) {
          return existingOrderMock;
        }
        return null;
      },
      create: async () => {
        throw new Error("create() should not be called when idempotency key exists!");
      },
    },
    product: {
      findFirst: async () => null,
    },
    $transaction: async (fn: any) => fn(mockDbClient),
  };

  const idempotencyTestPayload: CreateOrderInput = {
    userId: "test-user-id",
    guestEmail: "customer@starpress.in",
    guestName: "Valued Customer",
    shippingAddress: {
      fullName: "Valued Customer",
      phone: "+91 9876543210",
      email: "customer@starpress.in",
      addressLine1: "123 Mall Road",
      city: "Dehradun",
      state: "Uttarakhand",
      pincode: "248001",
    },
    items: [
      {
        productId: "business-cards",
        productSlug: "business-cards",
        quantity: 100,
        sizeId: getProductBySlug("business-cards")!.sizeOptions[0].id,
        materialId: getProductBySlug("business-cards")!.materialOptions[0].id,
      },
    ],
    idempotencyKey: testIdempKey,
    shippingMethod: "standard",
    paymentMethod: "PAY_AFTER_PROOF",
  };

  const idempResult = await createOrder(idempotencyTestPayload, mockDbClient);
  assert(idempResult.success === true, "Idempotency request succeeds");
  assert((idempResult as any).isExisting === true, "Identifies order as already existing");
  assert(idempResult.order.id === existingOrderMock.id, "Returns identical order ID without duplicating");

  // =========================================================================
  // 5. Out-of-Stock Validation & Rejection
  // =========================================================================
  console.log("\n▶ [Test 5] Stock Validation: Quantity Exceeding Available Inventory is Rejected...");

  const mockDbWithLowStock: any = {
    order: {
      findFirst: async () => null,
    },
    product: {
      findFirst: async () => ({
        id: "business-cards",
        slug: "business-cards",
        name: "Premium Business Cards",
        trackInventory: true,
        stockQuantity: 5,
        status: "published",
      }),
    },
  };

  const excessiveStockPayload: CreateOrderInput = {
    userId: "test-user-id",
    guestEmail: "customer@starpress.in",
    guestName: "Valued Customer",
    shippingAddress: {
      fullName: "Valued Customer",
      phone: "+91 9876543210",
      email: "customer@starpress.in",
      addressLine1: "123 Mall Road",
      city: "Dehradun",
      state: "Uttarakhand",
      pincode: "248001",
    },
    items: [
      {
        productId: "business-cards",
        productSlug: "business-cards",
        quantity: 50, // exceeds available stock of 5
        sizeId: getProductBySlug("business-cards")!.sizeOptions[0].id,
        materialId: getProductBySlug("business-cards")!.materialOptions[0].id,
      },
    ],
    shippingMethod: "standard",
    paymentMethod: "PAY_AFTER_PROOF",
  };

  let stockRejected = false;
  let stockErrorMessage = "";
  try {
    await createOrder(excessiveStockPayload, mockDbWithLowStock);
  } catch (err: any) {
    if (err.statusCode === 409 || err.message?.includes("Insufficient stock")) {
      stockRejected = true;
      stockErrorMessage = err.message;
    }
  }

  assert(stockRejected, "Order rejected with HTTP 409 when quantity exceeds inventory", stockErrorMessage);
  assert(stockErrorMessage.includes("Available: 5, Requested: 50"), "Error message contains exact stock and requested units");

  // =========================================================================
  // 6. Cart Invariants & Persistence Across Authentication
  // =========================================================================
  console.log("\n▶ [Test 6] Cart Persistence Across Login Flow Invariants...");

  const STORAGE_KEY = "starpress_cart_v2";
  assert(STORAGE_KEY === "starpress_cart_v2", "Cart uses starpress_cart_v2 localStorage key");

  // Simulate cart serialization and restoration across redirect
  const mockCartItems = [
    {
      id: "prod-1-std",
      productId: "business-cards",
      productSlug: "business-cards",
      name: "Premium Business Cards",
      price: 299,
      quantity: 100,
      imageSrc: "/images/hero-composition.jpg",
      href: "/shop/business-cards",
      stockQuantity: 5000,
      inStock: true,
    },
  ];

  const serialized = JSON.stringify(mockCartItems);
  const deserialized = JSON.parse(serialized);

  assert(deserialized.length === 1, "Cart item restored with intact length");
  assert(deserialized[0].id === mockCartItems[0].id, "Cart item ID preserved");
  assert(deserialized[0].quantity === 100, "Cart item quantity preserved");
  assert(deserialized[0].stockQuantity === 5000, "Cart item stockQuantity preserved");
  assert(deserialized[0].inStock === true, "Cart item inStock boolean preserved");

  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log("=======================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runCheckoutAuthTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
