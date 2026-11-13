import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth-resolver";
import { isOrderOwner } from "@/lib/order-access";
import { db } from "@/lib/db";
import { updateOrderStatus } from "@/server/orders";
import { rateLimitDistributed, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const user = await resolveUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const rl = await rateLimitDistributed(`order:cancel:${user.id}`, 5, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many cancellation requests. Please wait a moment.");
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const reason = (body?.reason || "Customer requested cancellation").trim();

    const order = await db.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Verify ownership
    if (!isOrderOwner(order, user)) {
      return NextResponse.json({ error: "Unauthorized to cancel this order." }, { status: 403 });
    }

    // Check cancellation eligibility
    const currentStatus = (order.status || "").toUpperCase();
    if (currentStatus === "CANCELLED") {
      return NextResponse.json({ success: true, message: "Order is already cancelled." });
    }

    if (currentStatus !== "PENDING" && currentStatus !== "CONFIRMED") {
      return NextResponse.json(
        {
          error:
            "This order is already in printing production or has been dispatched. Please contact our support team via WhatsApp for cancellation assistance.",
        },
        { status: 400 }
      );
    }

    // Execute cancellation with atomic inventory restock
    const result = await updateOrderStatus(order.id, "CANCELLED", {
      notes: `[Customer Cancellation] ${reason}`,
      customerCancellation: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to cancel order." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Order cancelled successfully. Any allocated stock has been restored.",
      order: result.order,
    });
  } catch (error: any) {
    console.error("API /api/account/orders/[id]/cancel error:", error);
    return NextResponse.json({ error: error?.message || "Failed to cancel order." }, { status: 500 });
  }
}
