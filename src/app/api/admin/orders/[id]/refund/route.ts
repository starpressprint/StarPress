import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { initiateRefund } from "@/server/refunds";
import { rateLimitDistributed, rateLimitExceededResponse } from "@/lib/rate-limit";
import { isUserAdmin } from "@/lib/admin/is-admin";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const orderId = params.id;
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const isAdmin = isUserAdmin(user);

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden. Admin privileges required to issue refunds." },
        { status: 403 }
      );
    }

    // Rate limit: 3 refunds per minute per admin
    const rl = await rateLimitDistributed(`admin:refund:${user.id}`, 3, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many refund requests. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { amount, reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json(
        { error: "A valid reason is required to issue a refund." },
        { status: 400 }
      );
    }

    // Resolve order and find primary payment transaction
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        transactions: {
          where: { status: "CAPTURED" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const paymentId = order.paymentId || order.transactions[0]?.gatewayPaymentId;

    if (!paymentId) {
      return NextResponse.json(
        { error: "No captured payment found for this order to refund." },
        { status: 400 }
      );
    }

    const result = await initiateRefund({
      orderId: order.id,
      paymentId,
      amount: amount !== undefined ? Number(amount) : undefined,
      reason: reason.trim(),
      initiatedBy: `ADMIN:${user.email || user.id}`,
    });

    return NextResponse.json({
      message: `Refund of ₹${result.amount} initiated successfully.`,
      ...result,
    });
  } catch (error: any) {
    console.error("API /api/admin/orders/[id]/refund error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process refund." },
      { status: 500 }
    );
  }
}
