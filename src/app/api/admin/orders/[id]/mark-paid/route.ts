// =============================================================================
// POST /api/admin/orders/[id]/mark-paid
// Manual "Mark Paid" strictly for PAY_AFTER_PROOF / COD orders with AdminAuditLog
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { getOrderById } from "@/server/orders";
import { db } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const order = await getOrderById(params.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: `Order #${order.orderNumber} is already marked as PAID.` },
        { status: 400 }
      );
    }

    const method = (order.paymentMethod || "").toUpperCase();
    if (method === "ONLINE") {
      return NextResponse.json(
        {
          error: "Online payment orders cannot be manually marked as paid. They must be verified and captured via Razorpay.",
        },
        { status: 400 }
      );
    }

    // Serialize against cancellation and preserve fulfillment progress.
    const updatedOrder = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.paymentMethod?.toUpperCase() === "ONLINE" || current.paymentStatus === "PAID") {
        throw Object.assign(new Error("Order changed. Refresh before recording manual payment."), { statusCode: 409 });
      }
      return tx.order.update({
        where: { id: current.id },
        data: { paymentStatus: "PAID", status: current.status === "PENDING" ? "CONFIRMED" : current.status },
        include: { items: true },
      });
    });

    // Write audit log
    try {
      await db.adminAuditLog.create({
        data: {
          adminEmail: auth.user?.email || "admin@example.com",
          entityType: "order",
          entityId: order.id,
          action: "manual_mark_paid",
          changes: {
            orderNumber: order.orderNumber,
            previousPaymentStatus: order.paymentStatus,
            newPaymentStatus: "PAID",
            paymentMethod: order.paymentMethod,
            totalAmount: Number(order.totalAmount),
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn("Could not write AdminAuditLog for manual mark paid:", auditErr);
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order #${order.orderNumber} successfully marked as PAID.`,
    });
  } catch (error: any) {
    console.error(`API /api/admin/orders/${params.id}/mark-paid error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to mark order as paid." },
      { status: error?.statusCode || 500 }
    );
  }
}
