// =============================================================================
// POST /api/create-order
// Secure Razorpay Order Creation Endpoint (Delegates to server-authoritative orders)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getRazorpayCredentials, createRazorpayOrder } from "@/server/payments";
import { isUserAdmin } from "@/lib/admin/is-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { keyId, keySecret } = getRazorpayCredentials();

    if (!keyId || !keySecret) {
      console.error("[Razorpay Error] API credentials are not configured on server.");
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server." },
        { status: 500 }
      );
    }

    // Authenticate user across Supabase, NextAuth, and Bearer tokens
    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch {}

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to initiate payment. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.starpressOrderId;

    // Security check: Order ID is required to link payment to server-calculated amount
    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required. Payments must be linked to a valid internal order." },
        { status: 400 }
      );
    }

    const isAdmin = isUserAdmin(user);
    const razorpayOrder = await createRazorpayOrder({
      orderId,
      sessionUserId: user.id,
      sessionUserEmail: user.email,
      isAdmin,
    });

    return NextResponse.json({
      success: true,
      order_id: razorpayOrder.razorpayOrderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: keyId,
      orderNumber: razorpayOrder.orderNumber,
    });
  } catch (error: any) {
    console.error("[Razorpay API] create-order error:", error);
    const statusCode =
      error.statusCode === 401 || error?.error?.description?.includes("Authentication")
        ? 401
        : error.statusCode || 500;
    return NextResponse.json(
      {
        error: error.message || error.description || "Failed to create Razorpay order.",
      },
      { status: statusCode }
    );
  }
}
