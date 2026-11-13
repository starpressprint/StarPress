import { isOrderOwner } from "@/lib/order-access";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/supabase/server";
import { createRazorpayOrder } from "@/server/payments";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { auditPaymentEvent } from "@/server/payment-audit";
import { isUserAdmin } from "@/lib/admin/is-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required to retry payment." },
        { status: 400 }
      );
    }

    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch (authErr) {
      console.warn("[Payments Retry] User resolution notice:", authErr);
    }

    const ip = getClientIp(request);
    const key = user ? `payment:retry:${user.id}` : `payment:retry:${ip}`;
    const rl = await rateLimitDistributed(key, 5, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many payment retry requests. Please wait a moment before trying again."
      );
    }

    if (!user) return NextResponse.json({ error: "Authentication required to retry payment." }, { status: 401 });

    // Fetch order from database
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // Guard 1: Verify Ownership
    const isAdmin = user ? isUserAdmin(user) : false;

    const isOwner = isOrderOwner(order, user);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // Guard 2: Already Paid
    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          error: "This order has already been paid.",
          isPaid: true,
          orderNumber: order.orderNumber,
        },
        { status: 400 }
      );
    }

    // Guard 3: Order Cancelled
    if (order.status === "CANCELLED") {
      return NextResponse.json(
        {
          error: "This order has been cancelled and cannot be paid.",
          isCancelled: true,
        },
        { status: 400 }
      );
    }

    // Guard 4: Order Expired
    if (order.paymentExpiresAt && new Date() > order.paymentExpiresAt) {
      return NextResponse.json(
        {
          error: "This order's payment window has expired. Please create a new order.",
          isExpired: true,
        },
        { status: 410 }
      );
    }

    // Audit log retry initiation
    await auditPaymentEvent({
      orderId: order.id,
      action: "PAYMENT_RETRY_INITIATED",
      actor: user?.id || "GUEST",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
      details: {
        orderNumber: order.orderNumber,
        amount: Number(order.totalAmount),
        previousRazorpayOrderId: order.razorpayOrderId,
      },
    });

    // Create or refresh Razorpay Order (derives amount strictly from DB order.totalAmount)
    const razorpayOrder = await createRazorpayOrder({
      orderId: order.id,
      sessionUserId: user?.id,
      sessionUserEmail: user?.email,
      sessionEmailVerified: Boolean(user?.email_confirmed_at),
      isAdmin,
    });

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrder.razorpayOrderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayOrder.keyId,
      orderNumber: razorpayOrder.orderNumber,
      orderId: order.id,
    });
  } catch (error: any) {
    console.error("API /api/payments/razorpay/retry error:", error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to initiate payment retry." },
      { status }
    );
  }
}
