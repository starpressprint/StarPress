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

    // Authenticate user across Supabase, NextAuth, and Bearer tokens
    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch (authErr) {
      console.warn("[Payments Create-Order] User resolution notice:", authErr);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to initiate payment. Please sign in." },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const key = user ? `payment:create:${user.id}` : `payment:create:${ip}`;
    const rl = await rateLimitDistributed(key, 8, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many payment requests. Please wait before retrying.");
    }

    const { isUserAdmin } = await import("@/lib/admin/is-admin");
    const isAdmin = user ? isUserAdmin(user) : false;

    const razorpayOrder = await createRazorpayOrder({
      orderId,
      sessionUserId: user?.id,
      sessionUserEmail: user?.email,
      isAdmin,
      sessionEmailVerified: Boolean(user?.email_confirmed_at),
    });

    await auditPaymentEvent({
      orderId,
      action: "RAZORPAY_ORDER_CREATED",
      actor: user?.id || "GUEST",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      details: {
        razorpayOrderId: razorpayOrder.razorpayOrderId,
        amount: razorpayOrder.amount,
      },
    });

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrder.razorpayOrderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayOrder.keyId,
      orderNumber: razorpayOrder.orderNumber,
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
