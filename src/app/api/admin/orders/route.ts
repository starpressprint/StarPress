import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listOrders, getOrderStats, createAdminOrder } from "@/server/orders";
import { verifyAdminAccess } from "@/lib/admin/auth-check";

export const dynamic = "force-dynamic";

function safeIsoDate(val: any): string {
  if (!val || val === "undefined" || val === "null") {
    return new Date().toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "all";
    const paymentStatusParam = searchParams.get("paymentStatus") || "all";
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const skip = (page - 1) * limit;

    const result = await listOrders({
      status: statusParam === "all" ? undefined : statusParam,
      paymentStatus: paymentStatusParam === "all" ? undefined : paymentStatusParam,
      search: search || undefined,
      limit,
      skip,
    });

    // Compute dynamic status counts across all real orders
    const stats = await getOrderStats();

    // Safety fallback: if stats.total is 0 but we have orders in result, derive stats immediately
    if (stats.total === 0 && (result.total > 0 || result.orders.length > 0)) {
      stats.total = Math.max(result.total, result.orders.length);
      for (const o of result.orders) {
        const s = String(o.status || "").toLowerCase();
        if (s === "delivered") stats.delivered++;
        else if (s === "shipped" || s === "dispatched") stats.shipped++;
        else if (s === "pending") stats.pending++;
        else if (s === "processing" || s === "confirmed" || s === "in_production") stats.processing++;
        else if (s === "cancelled") stats.cancelled++;
        else if (s === "refunded") stats.refunded++;
      }
    }

    // Format orders for Admin UI
    const formattedOrders = result.orders.map((o: any) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const itemCount = items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
      const subtotal = Number(o.subtotal || 0);
      const tax = Number(o.gstAmount || 0);
      const shipping = Number(o.shippingFee || 0);
      const discount = Number(o.discountAmount || 0);
      const total = Number(o.totalAmount || 0);

      // Extract shipping address display
      let shippingAddrStr = "";
      if (typeof o.shippingAddress === "string") {
        shippingAddrStr = o.shippingAddress;
      } else if (o.shippingAddress) {
        const a = o.shippingAddress;
        shippingAddrStr = [a.addressLine1 || a.line1, a.addressLine2 || a.line2, a.city, a.state, a.pincode]
          .filter(Boolean)
          .join(", ");
      }

      const rawStatus = String(o.status || "pending").toLowerCase();
      let normalizedDisplayStatus = rawStatus;
      if (rawStatus === "dispatched") normalizedDisplayStatus = "shipped";
      else if (rawStatus === "confirmed" || rawStatus === "in_production") normalizedDisplayStatus = "processing";

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.guestName || (o.user ? o.user.name : "Customer"),
        customerEmail: o.guestEmail || (o.user ? o.user.email : ""),
        customerPhone: o.guestPhone || (o.user ? o.user.phone : ""),
        date: safeIsoDate(o.createdAt),
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
        paymentMethod: o.paymentMethod || "ONLINE",
        paymentStatus: (o.paymentStatus || "unpaid").toLowerCase(),
        fulfillmentStatus: (rawStatus === "delivered" || rawStatus === "dispatched" ? "fulfilled" : rawStatus === "in_production" ? "partial" : "unfulfilled"),
        status: normalizedDisplayStatus,
        shippingAddress: shippingAddrStr,
        rawShippingAddress: o.shippingAddress || null,
        billingAddress: o.billingAddress || null,
        paymentId: o.paymentId || (o.transactions && o.transactions[0]?.gatewayPaymentId) || null,
        razorpayOrderId: o.razorpayOrderId || null,
        trackingNumber: o.trackingNumber || null,
        courierPartner: o.courierPartner || null,
        notes: o.notes || null,
      };
    });

    const totalPages = Math.ceil(result.total / limit) || 1;

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      total: result.total,
      totalPages,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("API /api/admin/orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/orders
 * Create a new manual order from admin panel (walk-in, phone, WhatsApp).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    if (!body.customerName || !body.customerPhone || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Customer name, phone number, and at least one item are required." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const result = await createAdminOrder(body, auth.user?.email || "admin@starpress.in", ipAddress);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/account");

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/admin/orders POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create order." },
      { status: 500 }
    );
  }
}
