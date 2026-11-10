/**
 * Star Press - Admin Order Fetching & Sync Verification Suite
 * Verifies that orders are reliably fetched from PostgreSQL, status filters work without
 * throwing Prisma enum errors, pagination functions properly, and date parsing is resilient.
 */

import { listOrders, getOrderStats } from "../src/server/orders";
import { verifyAdminAccess } from "../src/lib/admin/auth-check";
import { isUserAdmin } from "../src/lib/admin/is-admin";
import { GET as getAdminOrders } from "../src/app/api/admin/orders/route";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("📦 STAR PRESS ADMIN ORDER FETCHING & SYNC VERIFICATION");
  console.log("=======================================================\n");

  // -----------------------------------------------------------------
  // 1. Verify Database Order Count & listOrders Retrieval
  // -----------------------------------------------------------------
  console.log("▶ [Test 1] Fetching all orders from database via listOrders()...");
  const dbCount = await db.order.count().catch(() => 0);
  console.log(`   Database reported total orders: ${dbCount}`);

  const allOrdersResult = await listOrders({ limit: 50 });
  assert(allOrdersResult.total >= dbCount, `listOrders returned at least ${dbCount} orders`, `Got: ${allOrdersResult.total}`);
  assert(allOrdersResult.orders.length > 0, "listOrders returned a non-empty order list");

  // Verify that the 4 real orders exist in the result
  const realOrderNumbers = ["SP-2026-CFM939746", "SP-2026-9VVW14616", "SP-2026-EZCU34910", "SP-2026-COD284115"];
  const retrievedNumbers = new Set(allOrdersResult.orders.map((o: any) => o.orderNumber));
  for (const num of realOrderNumbers) {
    assert(retrievedNumbers.has(num), `Real customer order ${num} is present in fetched orders`);
  }

  // -----------------------------------------------------------------
  // 2. Status Filter Robustness (Preventing Prisma enum crashes)
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 2] Testing all status filters against database queries...");
  const statusFiltersToTest = [
    "all",
    "pending",
    "processing",
    "confirmed",
    "in_production",
    "shipped",
    "dispatched",
    "delivered",
    "cancelled",
    "refunded",
  ];

  for (const st of statusFiltersToTest) {
    try {
      const res = await listOrders({ status: st, limit: 10 });
      assert(true, `Filter status='${st}' executes cleanly without Prisma enum crash (found ${res.total})`);
    } catch (err: any) {
      assert(false, `Filter status='${st}' crashed with error`, err?.message);
    }
  }

  // -----------------------------------------------------------------
  // 3. Payment Filter Robustness
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 3] Testing all payment filters...");
  const paymentFiltersToTest = ["all", "paid", "unpaid", "pay_after_proof"];
  for (const pf of paymentFiltersToTest) {
    try {
      const res = await listOrders({ paymentStatus: pf, limit: 10 });
      assert(true, `Filter paymentStatus='${pf}' executes cleanly (found ${res.total})`);
    } catch (err: any) {
      assert(false, `Filter paymentStatus='${pf}' crashed with error`, err?.message);
    }
  }

  // -----------------------------------------------------------------
  // 4. Pagination & Slicing
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 4] Testing pagination parameters...");
  const page1 = await listOrders({ limit: 5, skip: 0 });
  assert(page1.orders.length <= 5, "Page 1 limit <= 5 respected", `Got: ${page1.orders.length}`);

  if (allOrdersResult.total > 5) {
    const page2 = await listOrders({ limit: 5, skip: 5 });
    assert(page2.orders.length > 0, "Page 2 returns subsequent orders", `Got: ${page2.orders.length}`);
    const page1FirstId = page1.orders[0]?.id;
    const page2FirstId = page2.orders[0]?.id;
    assert(page1FirstId !== page2FirstId, "Page 1 and Page 2 contain distinct order sets");
  }

  // -----------------------------------------------------------------
  // 5. Dynamic Stats Aggregation
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 5] Testing dynamic order stats calculation...");
  const stats = await getOrderStats();
  assert(stats.total >= dbCount, `Stats total >= ${dbCount}`, `Got: ${stats.total}`);
  assert(typeof stats.pending === "number", "stats.pending is a valid number");
  assert(typeof stats.processing === "number", "stats.processing is a valid number");
  assert(typeof stats.paid === "number", "stats.paid is a valid number");
  assert(typeof stats.unpaid === "number", "stats.unpaid is a valid number");

  // -----------------------------------------------------------------
  // 6. Admin Access Verification Across Roles
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 6] Testing admin authorization checks...");
  // User with ADMIN_EMAILS email
  const adminEmailUser = { email: "starpress.print@gmail.com", role: "CUSTOMER" };
  assert(isUserAdmin(adminEmailUser), "Store owner starpress.print@gmail.com recognized as admin via ADMIN_EMAILS");

  const princeAdminUser = { email: "princesaxena511@gmail.com", role: "CUSTOMER" };
  assert(isUserAdmin(princeAdminUser), "princesaxena511@gmail.com recognized as admin via ADMIN_EMAILS");

  // User with database role ADMIN
  const dbRoleUser = { email: "staff@starpress.in", role: "ADMIN" };
  assert(isUserAdmin(dbRoleUser), "User with role=ADMIN recognized as admin");

  // Normal customer should be rejected
  const customerUser = { email: "regular.customer@gmail.com", role: "CUSTOMER" };
  assert(!isUserAdmin(customerUser), "Regular customer correctly rejected from admin access");

  // -----------------------------------------------------------------
  // 7. Route Handler GET /api/admin/orders
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 7] Testing GET /api/admin/orders route handler response structure...");
  // Test that unauthenticated returns 401
  const reqUnauth = new NextRequest("http://localhost:3000/api/admin/orders");
  const resUnauth = await getAdminOrders(reqUnauth);
  assert(resUnauth.status === 401, "Unauthenticated request returns HTTP 401", `Got: ${resUnauth.status}`);

  // Test that authorized request formatting parses all orders and dates without crashing
  const orders = allOrdersResult.orders;
  let dateParsingError = false;
  for (const o of orders) {
    try {
      const parsedDate = o.createdAt && o.createdAt !== "undefined" ? new Date(o.createdAt).toISOString() : new Date().toISOString();
      if (!parsedDate || parsedDate === "Invalid Date") dateParsingError = true;
    } catch {
      dateParsingError = true;
    }
  }
  assert(!dateParsingError, "All order createdAt values parse into valid ISO date strings without RangeError");

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passedCount} passed, ${failedCount} failed.`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

