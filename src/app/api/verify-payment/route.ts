import { isOrderOwner } from "@/lib/order-access";
// =============================================================================
// POST /api/verify-payment
// Standard Razorpay Signature Verification Endpoint (HMAC-SHA256 + REST Verification)
// Strictly enforces genuine payments & ownership — Zero mock fallbacks
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRazorpayCredentials, recordPaymentSuccess } from "@/server/payments";
import { isUserAdmin } from "@/lib/admin/is-admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      console.error("[Razorpay Error] Razorpay credentials are not configured on the server.");
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server." },
        { status: 500 }
      );
    }

    // 1. Mandatory user authentication
    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch {}

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to verify payment. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body.order_id || body.razorpay_order_id;
    const paymentId = body.payment_id || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const starpressOrderId = body.starpressOrderId || body.orderId;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: order_id, payment_id, and signature are mandatory." },
        { status: 400 }
      );
    }

    // 2. Strict defense: Reject mock or simulated values
    if (
      String(orderId).startsWith("order_mock_") ||
      String(paymentId).startsWith("pay_mock_") ||
      signature === "mock_signature" ||
      signature === "mock_test_signature"
    ) {
      return NextResponse.json(
        { success: false, error: "Mock payments are prohibited." },
        { status: 400 }
      );
    }

    // 3. Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(generatedSignature, "utf8");
    const actualBuf = Buffer.from(signature, "utf8");

    const isMatch =
      expectedBuf.length === actualBuf.length &&
      crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isMatch) {
      console.warn(`[Razorpay Verification] Signature mismatch for order: ${orderId}`);
      return NextResponse.json(
        { success: false, error: "Payment verification failed: Invalid cryptographic signature." },
        { status: 400 }
      );
    }

    // 4. Resolve Star Press DB order strictly linked to this razorpayOrderId
    const dbOrder = await db.order.findFirst({
      where: {
        razorpayOrderId: orderId,
        ...(starpressOrderId ? { id: starpressOrderId } : {}),
      },
    });

    if (!dbOrder) {
      return NextResponse.json(
        { success: false, error: "Associated order not found for this payment reference." },
        { status: 404 }
      );
    }

    // 5. Ownership verification
    const isAdmin = isUserAdmin(user);
    const isOwner = isOrderOwner(dbOrder, user);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access to order." },
        { status: 403 }
      );
    }

    // 6. Authoritative REST verification with Razorpay to verify exact captured amount
    const expectedPaise = Math.round(Number(dbOrder.totalAmount) * 100);
    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!rzpRes.ok) {
      console.error(`[Razorpay REST] Payment lookup failed with status: ${rzpRes.status}`);
      return NextResponse.json(
        { success: false, error: "Could not verify payment with Razorpay authority." },
        { status: 502 }
      );
    }

    const paymentData = await rzpRes.json();

    if (paymentData.status !== "captured") {
      return NextResponse.json(
        { success: false, error: `Payment is not in captured status (current: ${paymentData.status}).` },
        { status: 400 }
      );
    }

    if (paymentData.amount !== expectedPaise) {
      console.error(
        `[Payment Security Alert] Amount mismatch! Gateway: ${paymentData.amount} paise, Expected: ${expectedPaise} paise.`
      );
      return NextResponse.json(
        { success: false, error: "Payment amount does not match order total." },
        { status: 400 }
      );
    }

    if (paymentData.currency !== "INR") {
      return NextResponse.json(
        { success: false, error: "Payment currency mismatch." },
        { status: 400 }
      );
    }

    if (paymentData.order_id !== orderId) {
      return NextResponse.json(
        { success: false, error: "Gateway order ID mismatch." },
        { status: 400 }
      );
    }

    // 7. Authoritatively record payment success
    {
      const result = await recordPaymentSuccess({
        orderId: dbOrder.id,
        paymentId,
        razorpayOrderId: orderId,
        signature,
        method: paymentData.method || "ONLINE",
        amount: Number(dbOrder.totalAmount),
        rawPayload: { verifiedVia: "/api/verify-payment", at: new Date().toISOString() },
      });
      if (!result.success) {
        return NextResponse.json({ success: false, error: "Payment recording failed. Please retry verification." }, { status: 503 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment signature verified successfully.",
      order_id: orderId,
      payment_id: paymentId,
      orderNumber: dbOrder.orderNumber,
    });
  } catch (error: any) {
    console.error("[Razorpay API] verify-payment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify payment." },
      { status: 500 }
    );
  }
}
