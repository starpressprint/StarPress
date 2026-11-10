// =============================================================================
// Automated Unit Tests: Server Quote Engine (Phase A1)
// Verifies:
// 1. Batch vs unit pricing models
// 2. Coupon min order amount validation
// 3. Rush / express fee calculation (+₹249)
// 4. Quantity <= 0 rejection
// =============================================================================

import { quoteOrder } from "../src/server/quote";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` — ${details}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n🧪 Running Server Quote & Pricing Unit Tests...\n");

  // -------------------------------------------------------------------------
  // Test 1: Batch Pricing Model (e.g. Business Cards - 100 starter batch)
  // -------------------------------------------------------------------------
  console.log("Scenario 1: Batch Pricing Model (Business Cards)");
  try {
    const quote100 = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 100 }],
    });
    // Base starter batch of 100 cards is ₹299
    assert(
      quote100.subtotal === 299,
      "Starter batch of 100 cards costs ₹299 (not ₹29,900)",
      `Expected ₹299, got ₹${quote100.subtotal}`
    );
    assert(
      quote100.lineSnapshots[0].specs.pricingModel === "batch",
      "Business cards identified as batch pricing model"
    );

    const quote1000 = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 1000 }],
    });
    // Bulk volume tier discounts apply
    assert(
      quote1000.subtotal < 2990 && quote1000.subtotal > 1500,
      `Volume tier discount applies for 1,000 cards (subtotal: ₹${quote1000.subtotal})`
    );
  } catch (err: any) {
    assert(false, "Batch pricing calculation threw unexpected error", err?.message);
  }

  // -------------------------------------------------------------------------
  // Test 2: Unit Pricing Model (e.g. Custom Mugs - per item)
  // -------------------------------------------------------------------------
  console.log("\nScenario 2: Unit Pricing Model (Custom Mugs)");
  try {
    const quoteMug1 = await quoteOrder({
      items: [{ slug: "mug-printing", quantity: 1 }],
    });
    const quoteMug5 = await quoteOrder({
      items: [{ slug: "mug-printing", quantity: 5 }],
    });

    assert(
      quoteMug1.lineSnapshots[0].specs.pricingModel === "unit",
      "Mug printing identified as unit pricing model"
    );
    assert(
      quoteMug5.subtotal === quoteMug1.subtotal * 5,
      "5 mugs cost 5x single mug when in same initial quantity tier",
      `1 mug: ₹${quoteMug1.subtotal}, 5 mugs: ₹${quoteMug5.subtotal}`
    );
  } catch (err: any) {
    assert(false, "Unit pricing calculation threw unexpected error", err?.message);
  }

  // -------------------------------------------------------------------------
  // Test 3: Coupon Min Order Amount Validation
  // -------------------------------------------------------------------------
  console.log("\nScenario 3: Coupon Min Amount Rules");
  try {
    // PRESS20 requires min order ₹1500
    // Try applying with subtotal < 1500
    let rejected = false;
    try {
      await quoteOrder({
        items: [{ slug: "business-cards", quantity: 100 }], // ₹299
        couponCode: "PRESS20",
      });
    } catch (err: any) {
      rejected = true;
      assert(
        err.message.includes("1,500") || err.statusCode === 400,
        "PRESS20 rejected when subtotal < ₹1,500",
        err.message
      );
    }
    assert(rejected, "Coupon with unmet minimum order amount was rejected");

    // Valid coupon STAR10 (10% off)
    const quoteWithStar10 = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 100 }], // ₹299
      couponCode: "STAR10",
    });
    assert(
      quoteWithStar10.discount === Math.round(299 * 0.1),
      `STAR10 gave exactly 10% discount (₹${quoteWithStar10.discount})`
    );
  } catch (err: any) {
    assert(false, "Coupon validation threw unexpected error", err?.message);
  }

  // -------------------------------------------------------------------------
  // Test 4: Rush / Express Priority Fee
  // -------------------------------------------------------------------------
  console.log("\nScenario 4: Rush & Express Fee Calculation");
  try {
    const standardQuote = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 100 }],
      shippingMethod: "standard",
    });

    const rushQuote = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 100 }],
      shippingMethod: "rush",
    });

    assert(
      rushQuote.rushFee === 249,
      "Rush fee is exactly ₹249",
      `Got rushFee: ₹${rushQuote.rushFee}`
    );
    assert(
      rushQuote.shipping === standardQuote.shipping + 249,
      "Rush quote shipping total equals standard shipping + ₹249",
      `Standard shipping: ₹${standardQuote.shipping}, Rush shipping: ₹${rushQuote.shipping}`
    );
    assert(
      rushQuote.grandTotal === standardQuote.grandTotal + 249,
      "Grand total includes +₹249 rush fee"
    );
  } catch (err: any) {
    assert(false, "Rush fee calculation threw unexpected error", err?.message);
  }

  // -------------------------------------------------------------------------
  // Test 5: Quantity <= 0 Rejection
  // -------------------------------------------------------------------------
  console.log("\nScenario 5: Quantity <= 0 Rejection");
  const invalidQuantities = [0, -1, -50];
  for (const qty of invalidQuantities) {
    let threw = false;
    try {
      await quoteOrder({
        items: [{ slug: "business-cards", quantity: qty }],
      });
    } catch (err: any) {
      threw = true;
      assert(
        err.statusCode === 400 || err.message.includes("Quantity must be a positive integer"),
        `Quantity ${qty} rejected with 400 validation error`
      );
    }
    assert(threw, `Quantity ${qty} properly blocked from pricing`);
  }

  // -------------------------------------------------------------------------
  // Test 6: 18% GST Calculation
  // -------------------------------------------------------------------------
  console.log("\nScenario 6: 18% GST Standard Compliance");
  try {
    const quote = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 100 }],
    });
    const expectedGst = Math.round(quote.taxableAmount * 0.18);
    assert(
      quote.gst === expectedGst,
      `18% GST calculated precisely (Taxable: ₹${quote.taxableAmount}, GST: ₹${quote.gst})`
    );
  } catch (err: any) {
    assert(false, "GST test error", err?.message);
  }

  // -------------------------------------------------------------------------
  // Test 7: Pack/Batch Starter Quantity Cart Regression (Fix for "always ₹103/₹106")
  // -------------------------------------------------------------------------
  console.log("\nScenario 7: Pack/Batch Starter Quantity Cart Regression (Fix for always ₹103/₹106)");
  try {
    // 1 pack of stickers: base price is ₹349 (NOT ₹3)
    const stickerQuote1 = await quoteOrder({
      items: [{ slug: "custom-stickers", quantity: 1 }],
      shippingMethod: "standard",
    });
    assert(
      stickerQuote1.subtotal === 349,
      "1 pack of Waterproof Die-Cut Vinyl Stickers has subtotal ₹349 (not ₹3)",
      `Expected 349, got ${stickerQuote1.subtotal}`
    );
    assert(
      stickerQuote1.gst === Math.round(349 * 0.18),
      `18% GST on 1 pack is ₹${Math.round(349 * 0.18)} (not ₹1)`,
      `Expected ${Math.round(349 * 0.18)}, got ${stickerQuote1.gst}`
    );
    assert(
      stickerQuote1.shipping === 40,
      "Standard shipping is ₹40",
      `Expected 40, got ${stickerQuote1.shipping}`
    );
    assert(
      stickerQuote1.grandTotal === 349 + Math.round(349 * 0.18) + 40,
      `Grand total for 1 pack is ₹${349 + Math.round(349 * 0.18) + 40} (NOT ₹103)`,
      `Expected ${349 + Math.round(349 * 0.18) + 40}, got ${stickerQuote1.grandTotal}`
    );

    // 2 packs of stickers: subtotal ₹698 (NOT ₹6)
    const stickerQuote2 = await quoteOrder({
      items: [{ slug: "custom-stickers", quantity: 2 }],
      shippingMethod: "standard",
    });
    assert(
      stickerQuote2.subtotal === 698,
      "2 packs of Waterproof Die-Cut Vinyl Stickers has subtotal ₹698 (not ₹6)",
      `Expected 698, got ${stickerQuote2.subtotal}`
    );
    assert(
      stickerQuote2.grandTotal === 698 + Math.round(698 * 0.18) + 40,
      `Grand total for 2 packs is ₹${698 + Math.round(698 * 0.18) + 40} (NOT ₹106)`,
      `Expected ${698 + Math.round(698 * 0.18) + 40}, got ${stickerQuote2.grandTotal}`
    );

    // 1 pack of business cards: base price is ₹299 (NOT ₹3)
    const cardQuote1 = await quoteOrder({
      items: [{ slug: "business-cards", quantity: 1 }],
      shippingMethod: "standard",
    });
    assert(
      cardQuote1.subtotal === 299,
      "1 pack of Business Cards has subtotal ₹299 (not ₹3)",
      `Expected 299, got ${cardQuote1.subtotal}`
    );

    // Free shipping threshold check (>= ₹999)
    const freeShippingQuote = await quoteOrder({
      items: [{ slug: "custom-stickers", quantity: 4 }], // 4 packs = ~₹1,187 >= 999
      shippingMethod: "standard",
    });
    assert(
      freeShippingQuote.shipping === 0,
      "Standard shipping is FREE for orders >= ₹999",
      `Expected 0, got ${freeShippingQuote.shipping}`
    );
  } catch (err: any) {
    assert(false, "Pack regression test threw unexpected error", err?.message);
  }

  // Summary
  console.log("\n------------------------------------------------------------");
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log("------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Unhandled test suite error:", e);
  process.exit(1);
});
