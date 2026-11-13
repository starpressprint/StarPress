import { isOrderOwner } from "@/lib/order-access";
// =============================================================================
// POST /api/payments/razorpay/verify
// Authoritative Razorpay Payment Verification (HMAC + Gateway REST Verification)
// Strictly enforces genuine payments — Zero mock fallbacks
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  verifyRazorpaySignature,
  recordPaymentSuccess,
  getRazorpayCredentials,
} from "@/server/payments";
import { getOrderById } from "@/server/orders";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { auditPaymentEvent } from "@/server/payment-audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitDistributed(`payment:verify:${ip}`, 10, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many payment verification requests. Please wait before retrying.");
    }

    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "orderId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are all mandatory." },
        { status: 400 }
      );
    }

    // 1. Resolve order from database
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // 2. Strict Defense: Reject any mock order IDs, mock payment IDs, or mock signatures
    if (
      razorpay_order_id.startsWith("order_mock_") ||
      razorpay_payment_id.startsWith("pay_mock_") ||
      razorpay_signature === "mock_signature" ||
      razorpay_signature === "mock_test_signature"
    ) {
      console.warn(`[Payment Security Alert] Mock payment attempt rejected for order ${order.orderNumber}`);
      await auditPaymentEvent({
        orderId: order.id,
        action: "MOCK_PAYMENT_BLOCKED",
        actor: "CLIENT:verify",
        ipAddress: ip,
        details: { razorpay_order_id, razorpay_payment_id },
      });
      return NextResponse.json(
        { error: "Simulated and mock payments are permanently prohibited. Real payment is required." },
        { status: 400 }
      );
    }

    // 3. Defense-in-depth: Verify order ownership
    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch {}

    const { isUserAdmin } = await import("@/lib/admin/is-admin");
    const isAdmin = user ? isUserAdmin(user) : false;

    if (!user) {
      return NextResponse.json({ error: "Please sign in to verify payment." }, { status: 401 });
    }
    const isOwner = isOrderOwner(order, user);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (!(order as any).razorpayOrderId || (order as any).razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Order gateway reference mismatch." }, { status: 400 });
    }

    // 4. Verify Razorpay credentials configured on server
    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      console.error("[Payment Security] Missing Razorpay credentials on server during verification.");
      return NextResponse.json(
        { error: "Payment verification unavailable: Server credentials are not configured." },
        { status: 503 }
      );
    }

    // 5. Cryptographic HMAC verification using RAZORPAY_KEY_SECRET
    const isValidHmac = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidHmac) {
      console.warn(`[Payment Security] Invalid HMAC signature for Order ${order.orderNumber}`);
      await auditPaymentEvent({
        orderId: order.id,
        action: "SIGNATURE_FAILED",
        actor: "CLIENT:verify",
        ipAddress: ip,
        details: { razorpay_order_id, razorpay_payment_id },
      });
      return NextResponse.json(
        { error: "Cryptographic signature mismatch. Payment verification failed." },
        { status: 400 }
      );
    }

    await auditPaymentEvent({
      orderId: order.id,
      action: "SIGNATURE_VERIFIED",
      actor: "CLIENT:verify",
      ipAddress: ip,
      details: { razorpay_order_id, razorpay_payment_id },
    });

    // 6. Authoritative Gateway REST verification: GET https://api.razorpay.com/v1/payments/:id
    const expectedPaise = Math.round(Number(order.totalAmount) * 100);
    let capturedMethod = "ONLINE";

    try {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const rzpRes = await fetch(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          headers: {
            Authorization: `Basic ${basicAuth}`,
          },
        }
      );

      if (!rzpRes.ok) {
        console.error(`[Razorpay REST] Payment lookup failed: ${rzpRes.status}`);
        await auditPaymentEvent({
          orderId: order.id,
          action: "REST_VERIFICATION_FAILED",
          actor: "CLIENT:verify",
          ipAddress: ip,
          details: { statusCode: rzpRes.status },
        });
        return NextResponse.json(
          { error: "Could not verify payment with gateway authority." },
          { status: 502 }
        );
      }

      const paymentData = await rzpRes.json();

      // Validate payment status: must be captured
      if (paymentData.status !== "captured") {
        console.warn(`[Razorpay Verify] Unexpected status "${paymentData.status}" for ${razorpay_payment_id}`);
        await auditPaymentEvent({
          orderId: order.id,
          action: "REST_VERIFICATION_FAILED",
          actor: "CLIENT:verify",
          ipAddress: ip,
          details: { status: paymentData.status },
        });
        return NextResponse.json(
          { error: `Payment is not in captured status (current: ${paymentData.status}).` },
          { status: 400 }
        );
      }

      // Validate amount charged against DB total
      if (paymentData.amount !== expectedPaise) {
        console.error(
          `[Payment Security Alert] Amount mismatch! Gateway charged ${paymentData.amount} paise, DB expected ${expectedPaise} paise.`
        );
        await auditPaymentEvent({
          orderId: order.id,
          action: "AMOUNT_MISMATCH_DETECTED",
          actor: "CLIENT:verify",
          ipAddress: ip,
          details: { expectedPaise, chargedPaise: paymentData.amount },
        });
        return NextResponse.json(
          { error: "Payment amount does not match order total." },
          { status: 400 }
        );
      }

      // Validate currency is INR
      if (paymentData.currency !== "INR") {
        console.error(`[Payment Security Alert] Currency mismatch! Gateway: ${paymentData.currency}, expected INR`);
        return NextResponse.json(
          { error: "Payment currency mismatch." },
          { status: 400 }
        );
      }

      // Validate order_id match
      if (paymentData.order_id !== razorpay_order_id) {
        console.error(
          `[Payment Security Alert] Order ID mismatch! Gateway: ${paymentData.order_id}, client: ${razorpay_order_id}`
        );
        await auditPaymentEvent({
          orderId: order.id,
          action: "REST_VERIFICATION_FAILED",
          actor: "CLIENT:verify",
          ipAddress: ip,
          details: { gatewayOrderId: paymentData.order_id, clientOrderId: razorpay_order_id },
        });
        return NextResponse.json(
          { error: "Gateway order ID mismatch." },
          { status: 400 }
        );
      }

      capturedMethod = paymentData.method || "ONLINE";

      await auditPaymentEvent({
        orderId: order.id,
        action: "REST_VERIFIED",
        actor: "CLIENT:verify",
        ipAddress: ip,
        details: { paymentId: razorpay_payment_id, method: capturedMethod },
      });
    } catch (restErr: any) {
      console.error("[Razorpay REST Verification Error]:", restErr);
      return NextResponse.json(
        { error: "Failed to communicate with Razorpay verification API." },
        { status: 502 }
      );
    }

    // 7. Authoritatively record payment success in DB (idempotent, atomic transaction with row locking)
    const result = await recordPaymentSuccess({
      orderId: order.id,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      signature: razorpay_signature,
      method: capturedMethod,
      amount: Number(order.totalAmount),
      rawPayload: { verifiedVia: "api_verify", at: new Date().toISOString() },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update order payment record." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      paymentStatus: "PAID",
    });
  } catch (error: any) {
    console.error("API /api/payments/razorpay/verify error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal error during payment verification." },
      { status: 500 }
    );
  }
}
