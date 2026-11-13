import { mergeOrderNotes } from "@/server/order-integrity";
// =============================================================================
// GET & PATCH /api/admin/orders/[id]
// Retrieve full order details and update order metadata (notes, tracking, status)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/server/orders";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

function safeIsoDate(val: any): string {
  if (!val || val === "undefined" || val === "null") {
    return new Date().toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const o = await getOrderById(params.id);
    if (!o) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const items = Array.isArray(o.items) ? o.items : [];
    const itemCount = items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
    const subtotal = Number(o.subtotal || 0);
    const tax = Number(o.gstAmount || 0);
    const shipping = Number(o.shippingFee || 0);
    const discount = Number(o.discountAmount || 0);
    const total = Number(o.totalAmount || 0);

    let shippingAddrStr = "";
    if (typeof o.shippingAddress === "string") {
      shippingAddrStr = o.shippingAddress;
    } else if (o.shippingAddress) {
      const a: any = o.shippingAddress;
      shippingAddrStr = [a.addressLine1 || a.line1, a.addressLine2 || a.line2, a.city, a.state, a.pincode]
        .filter(Boolean)
        .join(", ");
    }

    const anyOrder = o as any;
    const formattedOrder = {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.guestName || (anyOrder.user ? anyOrder.user.name : "Customer"),
      customerEmail: o.guestEmail || (anyOrder.user ? anyOrder.user.email : ""),
      customerPhone: o.guestPhone || (anyOrder.user ? anyOrder.user.phone : ""),
      date: safeIsoDate(anyOrder.createdAt),
      items: items.map((it: any) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        sku: it.productSlug ? `SP-${it.productSlug.substring(0, 8).toUpperCase()}` : "SP-ITEM",
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        total: Number(it.lineTotal || it.unitPrice * it.quantity),
        image: it.previewUrl || it.artworkUrl || "",
        specs: it.specs || null,
        customText: it.customText || null,
        artworkUrl: it.artworkUrl || null,
        previewUrl: it.previewUrl || null,
      })),
      itemCount,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      paymentMethod: o.paymentMethod || "MANUAL_PROOF",
      paymentId: anyOrder.paymentId || null,
      razorpayOrderId: anyOrder.razorpayOrderId || null,
      paymentStatus: (o.paymentStatus || "unpaid").toLowerCase(),
      fulfillmentStatus: (o.status === "DELIVERED" || o.status === "DISPATCHED" ? "fulfilled" : o.status === "IN_PRODUCTION" ? "partial" : "unfulfilled"),
      status: o.status === "DISPATCHED" ? "shipped" : typeof o.status === "string" ? o.status.toLowerCase() : "pending",
      shippingAddress: shippingAddrStr,
      rawShippingAddress: o.shippingAddress,
      billingAddress: o.billingAddress,
      trackingNumber: o.trackingNumber || null,
      courierPartner: o.courierPartner || null,
      notes: o.notes || "",
    };

    return NextResponse.json({
      success: true,
      order: formattedOrder,
    });
  } catch (error) {
    console.error(`API /api/admin/orders/${params.id} GET error:`, error);
    return NextResponse.json(
      { error: "Failed to retrieve order." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { status, trackingNumber, courierPartner, notes, paymentStatus } = body;

    // If status is provided, map to Prisma OrderStatus enum
    if (status) {
      const statusMap: Record<string, OrderStatus> = {
        pending: OrderStatus.PENDING,
        processing: OrderStatus.CONFIRMED,
        confirmed: OrderStatus.CONFIRMED,
        in_production: OrderStatus.IN_PRODUCTION,
        shipped: OrderStatus.DISPATCHED,
        dispatched: OrderStatus.DISPATCHED,
        delivered: OrderStatus.DELIVERED,
        cancelled: OrderStatus.CANCELLED,
        refunded: OrderStatus.CANCELLED,
      };

      const targetStatus = statusMap[status.toLowerCase()];
      if (!targetStatus) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
      const result = await updateOrderStatus(params.id, targetStatus, {
        trackingNumber,
        courierPartner,
        notes,
      });
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Direct DB update for fields like paymentStatus and notes
    try {
      const updateData: any = {};
      if (notes !== undefined) {
        const current = await db.order.findUnique({ where: { id: params.id }, select: { notes: true } });
        updateData.notes = mergeOrderNotes(current?.notes || null, notes);
      }
      if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
      if (courierPartner !== undefined) updateData.courierPartner = courierPartner;
      if (paymentStatus !== undefined) {
        const targetPaymentStatus = paymentStatus.toUpperCase();
        if (targetPaymentStatus === "PAID") {
          const currentOrder = await getOrderById(params.id);
          const method = (currentOrder?.paymentMethod || "").toUpperCase();
          if (method === "ONLINE") {
            const verifiedTx = await db.paymentTransaction.findFirst({
              where: { orderId: params.id, status: "CAPTURED", gateway: "RAZORPAY" },
            });
            if (!verifiedTx || !verifiedTx.gatewayPaymentId || verifiedTx.gatewayPaymentId.startsWith("pay_mock_")) {
              return NextResponse.json(
                {
                  error: "Online payment orders cannot be manually marked as PAID without a verified Razorpay payment capture.",
                },
                { status: 400 }
              );
            }
          }
        }
        updateData.paymentStatus = targetPaymentStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await db.order.update({
          where: { id: params.id },
          data: updateData,
        });
      }
    } catch (error) {
      console.error("Order metadata update failed:", error);
      return NextResponse.json({ error: "Failed to save order changes." }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`API /api/admin/orders/${params.id} PATCH error:`, error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    );
  }
}
