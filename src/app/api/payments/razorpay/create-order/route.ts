import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder } from "@/server/payments";
import { getSessionUser } from "@/lib/supabase/server";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { auditPaymentEvent } from "@/server/payment-audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    // Require authenticated user
    let user;
    try {
      user = await getSessionUser();
    } catch {}

    const ip = getClientIp(request);
    const key = user ? `payment:create:${user.id}` : `payment:create:${ip}`;
    const rl = await rateLimitDistributed(key, 5, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many payment requests. Please wait before retrying.");
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to initiate payment." },
        { status: 401 }
      );
    }

    const { isUserAdmin } = await import("@/lib/admin/is-admin");
    const isAdmin = isUserAdmin(user);

    const razorpayOrder = await createRazorpayOrder({
      orderId,
      sessionUserId: user.id,
      sessionUserEmail: user.email,
      isAdmin,
    });

    await auditPaymentEvent({
      orderId,
      action: "RAZORPAY_ORDER_CREATED",
      actor: user.id,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      details: {
        razorpayOrderId: razorpayOrder.razorpayOrderId,
        amount: razorpayOrder.amount,
        isMock: razorpayOrder.isMock || false,
      },
    });

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrder.razorpayOrderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayOrder.keyId,
      orderNumber: razorpayOrder.orderNumber,
      isMock: razorpayOrder.isMock || false,
    });
  } catch (error: any) {
    console.error("API /api/payments/razorpay/create-order error:", error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to initialize payment gateway order." },
      { status }
    );
  }
}
