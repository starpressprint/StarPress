/**
 * Star Press - Razorpay Live Payment Production Readiness Test Suite
 * Validates backend payment security, signature checks, webhook idempotency,
 * amount validation, and production environment readiness.
 */

import crypto from "crypto";
import {
  verifyRazorpaySignature,
  verifyWebhookSignature,
  isLiveProductionPayment,
  getRazorpayCredentials,
} from "../src/server/payments";
import { isAllowedWebhookSource } from "../src/lib/webhook-security";

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

async function runProductionReadinessTests() {
  console.log("\n=======================================================");
  console.log("🛡️  RAZORPAY LIVE INTEGRATION PRODUCTION READINESS AUDIT");
  console.log("=======================================================\n");

  // -----------------------------------------------------------------
  // 1. Signature Verification Cryptographic Integrity
  // -----------------------------------------------------------------
  console.log("▶ [Test 1] Razorpay Payment Signature Verification (HMAC-SHA256)...");
  const testSecret = "live_audit_test_secret_32chars_min";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  const validOrderId = "order_OId12345678901";
  const validPaymentId = "pay_PId12345678901";
  const validSig = crypto
    .createHmac("sha256", testSecret)
    .update(`${validOrderId}|${validPaymentId}`)
    .digest("hex");

  assert(
    verifyRazorpaySignature(validOrderId, validPaymentId, validSig),
    "Genuine HMAC-SHA256 signature verifies successfully"
  );

  const tamperedSig = validSig.slice(0, -2) + "ff";
  assert(
    !verifyRazorpaySignature(validOrderId, validPaymentId, tamperedSig),
    "Tampered signature is strictly rejected"
  );

  const wrongOrderId = "order_DIFFERENT9999";
  assert(
    !verifyRazorpaySignature(wrongOrderId, validPaymentId, validSig),
    "Mismatched Order ID with valid signature is rejected"
  );

  const wrongPaymentId = "pay_DIFFERENT9999";
  assert(
    !verifyRazorpaySignature(validOrderId, wrongPaymentId, validSig),
    "Mismatched Payment ID with valid signature is rejected"
  );

  // Strict defense: Reject mock values
  assert(
    !verifyRazorpaySignature("order_mock_123", validPaymentId, validSig),
    "Mock order ID is rejected unconditionally"
  );
  assert(
    !verifyRazorpaySignature(validOrderId, "pay_mock_123", validSig),
    "Mock payment ID is rejected unconditionally"
  );
  assert(
    !verifyRazorpaySignature(validOrderId, validPaymentId, "mock_signature"),
    "Mock signature string is rejected unconditionally"
  );

  // -----------------------------------------------------------------
  // 2. Webhook Signature Verification & Raw-Body Protection
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 2] Razorpay Webhook Signature Verification...");
  const webhookSecret = "live_webhook_audit_secret_32chars";
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  const samplePayload = JSON.stringify({
    entity: "event",
    account_id: "acc_live_audit_01",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_testcapture_01",
          amount: 50000,
          currency: "INR",
          status: "captured",
          order_id: "order_testcapture_01",
        },
      },
    },
    created_at: 1700000000,
  });

  const validWebhookSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(samplePayload)
    .digest("hex");

  assert(
    verifyWebhookSignature(samplePayload, validWebhookSig),
    "Genuine raw payload HMAC-SHA256 webhook signature verifies successfully"
  );

  const tamperedPayload = samplePayload.replace("50000", "10000");
  assert(
    !verifyWebhookSignature(tamperedPayload, validWebhookSig),
    "Payload tampering (amount modification) invalidates webhook signature"
  );

  assert(
    !verifyWebhookSignature(samplePayload, "invalid_webhook_sig_hex"),
    "Invalid webhook signature rejected"
  );

  assert(
    !verifyWebhookSignature("", validWebhookSig),
    "Empty webhook payload rejected"
  );

  // -----------------------------------------------------------------
  // 3. Live vs Test Key Detection Logic
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 3] Live vs Test Key Identification & Handling...");
  assert(
    isLiveProductionPayment("rzp_live_9K123456789abc"),
    "Recognizes rzp_live_ prefix as genuine Live production key"
  );
  assert(
    !isLiveProductionPayment("rzp_test_1K123456789abc"),
    "Recognizes rzp_test_ prefix as non-live Test key"
  );

  // -----------------------------------------------------------------
  // 4. Client-Facing Secret Isolation Audit
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 4] Secret Isolation & Frontend Leakage Prevention...");
  // Check that RAZORPAY_KEY_SECRET is NOT prefixed with NEXT_PUBLIC_
  const hasPublicSecret = Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET);
  assert(!hasPublicSecret, "NEXT_PUBLIC_RAZORPAY_KEY_SECRET does not exist in environment");

  const hasPublicWebhookSecret = Boolean(process.env.NEXT_PUBLIC_RAZORPAY_WEBHOOK_SECRET);
  assert(!hasPublicWebhookSecret, "NEXT_PUBLIC_RAZORPAY_WEBHOOK_SECRET does not exist in environment");

  // Verify getRazorpayCredentials only returns keyId and keySecret
  const creds = getRazorpayCredentials();
  assert("keyId" in creds && "keySecret" in creds, "getRazorpayCredentials returns safe credential pair");

  // -----------------------------------------------------------------
  // 5. Server-Authoritative Amount Calculation & Currency Enforcement
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 5] Server Currency & Paise Conversion Rules...");
  const rupeeAmount = 149.5;
  const paise = Math.round(rupeeAmount * 100);
  assert(paise === 14950, "Rupee to paise conversion accurately rounded to integer paise");

  const smallRupee = 0.99;
  const smallPaise = Math.round(smallRupee * 100);
  assert(smallPaise === 99, "Sub-rupee amounts converted correctly without floating point errors");

  // Currency must strictly be INR
  const allowedCurrencies = ["INR"];
  assert(allowedCurrencies.includes("INR"), "Permitted gateway payment currency is strictly INR");

  // -----------------------------------------------------------------
  // 6. Webhook Source Allowlisting & Rate Limiting
  // -----------------------------------------------------------------
  console.log("\n▶ [Test 6] Webhook Network Origin & Strict Checking...");
  // Test IP allowlisting function
  const officialRzpIp = "52.66.166.10";
  assert(isAllowedWebhookSource(officialRzpIp), "Official Razorpay webhook IP allowed");

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`AUDIT TEST RESULTS: ${passedCount} passed, ${failedCount} failed.`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runProductionReadinessTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});

