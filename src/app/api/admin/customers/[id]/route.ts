// =============================================================================
// GET & PATCH /api/admin/customers/[id]
// Retrieve full customer profile, lifetime value (LTV), and all order history
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";

function safeIsoDate(val: any): string {
  if (!val || val === "undefined" || val === "null") {
    return new Date().toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const decodedId = decodeURIComponent(params.id);

    // 1. Try to find registered user by id or email
    let user: any = null;
    try {
      user = await db.user.findFirst({
        where: {
          OR: [
            { id: decodedId },
            { email: { equals: decodedId, mode: "insensitive" } },
          ],
        },
        include: { addresses: true },
      });
    } catch {
      user = null;
    }

    const targetEmail = user?.email || (decodedId.includes("@") ? decodedId : null);
    const targetUserId = user?.id || (decodedId.startsWith("usr_") || decodedId.startsWith("c") ? decodedId : null);
    const targetPhone = user?.phone || (!decodedId.includes("@") ? decodedId : null);

    // 2. Fetch all orders matching this customer
    let orders: any[] = [];
    try {
      const orConditions: any[] = [];
      if (targetUserId) orConditions.push({ userId: targetUserId });
      if (targetEmail) orConditions.push({ guestEmail: { equals: targetEmail, mode: "insensitive" } });
      if (targetPhone) orConditions.push({ guestPhone: targetPhone });

      if (orConditions.length > 0) {
        orders = await db.order.findMany({
          where: { OR: orConditions },
          include: { items: true },
          orderBy: { createdAt: "desc" },
        });
      }
    } catch {
      // Fallback to persistentStore
      const allPersisted = persistentStore.getOrders();
      orders = allPersisted.filter((o) => {
        if (targetUserId && o.userId === targetUserId) return true;
        if (targetEmail && o.guestEmail?.toLowerCase() === targetEmail.toLowerCase()) return true;
        if (targetPhone && o.guestPhone === targetPhone) return true;
        return false;
      });
    }

    if (!user && orders.length === 0) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    // 3. Aggregate customer profile details
    const primaryName = user?.name || orders[0]?.guestName || "Customer";
    const primaryEmail = user?.email || orders[0]?.guestEmail || "";
    const primaryPhone = user?.phone || orders[0]?.guestPhone || "";

    // 4. Calculate Financial Metrics (LTV)
    const totalOrders = orders.length;
    const totalSpent = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount || o.total || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    const firstOrderDate = orders[orders.length - 1]?.createdAt || user?.createdAt || null;
    const lastOrderDate = orders[0]?.createdAt || null;

    // 5. Gather unique addresses & GSTIN
    const addresses: any[] = [];
    if (user?.addresses) {
      addresses.push(
        ...user.addresses.map((a: any) => ({
          type: a.isDefault ? "Default Address" : "Saved Address",
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          companyName: a.companyName || null,
          gstin: a.gstin || null,
        }))
      );
    }

    for (const o of orders) {
      if (o.shippingAddress && typeof o.shippingAddress === "object") {
        const sa = o.shippingAddress as any;
        const exists = addresses.some(
          (a) => a.line1 === (sa.addressLine1 || sa.line1) && a.pincode === sa.pincode
        );
        if (!exists) {
          addresses.push({
            type: "Order Shipping Address",
            line1: sa.addressLine1 || sa.line1 || "",
            line2: sa.addressLine2 || sa.line2 || "",
            city: sa.city || "",
            state: sa.state || "",
            pincode: sa.pincode || "",
            companyName: sa.companyName || null,
            gstin: sa.gstin || null,
          });
        }
      }
    }

    // 6. Fetch Internal Staff Notes
    let internalNotes = "";
    try {
      const noteSetting = await db.storeSetting.findUnique({
        where: { key: `customer_notes_${decodedId}` },
      });
      if (noteSetting && noteSetting.value) {
        internalNotes = (noteSetting.value as any).notes || "";
      }
    } catch {}

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: safeIsoDate(o.createdAt),
      itemCount: Array.isArray(o.items)
        ? o.items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0)
        : 1,
      total: Number(o.totalAmount || o.total || 0),
      status: o.status === "DISPATCHED" ? "shipped" : String(o.status || "pending").toLowerCase(),
      paymentStatus: String(o.paymentStatus || "unpaid").toLowerCase(),
      courierPartner: o.courierPartner || null,
      trackingNumber: o.trackingNumber || null,
    }));

    return NextResponse.json({
      success: true,
      customer: {
        id: user?.id || decodedId,
        name: primaryName,
        email: primaryEmail,
        phone: primaryPhone,
        isRegistered: Boolean(user),
        avatar: user?.avatar || null,
        createdAt: safeIsoDate(user?.createdAt || firstOrderDate),
        metrics: {
          totalOrders,
          totalSpent,
          averageOrderValue,
          firstOrderDate,
          lastOrderDate,
        },
        addresses,
        orders: formattedOrders,
        internalNotes,
      },
    });
  } catch (error: any) {
    console.error(`API /api/admin/customers/${params.id} GET error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve customer details." },
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

    const decodedId = decodeURIComponent(params.id);
    const body = await request.json();
    const { internalNotes } = body;

    if (internalNotes !== undefined) {
      try {
        await db.storeSetting.upsert({
          where: { key: `customer_notes_${decodedId}` },
          update: { value: { notes: internalNotes } },
          create: { key: `customer_notes_${decodedId}`, value: { notes: internalNotes } },
        });
      } catch (e) {
        console.warn("Could not save customer notes to db.storeSetting:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`API /api/admin/customers/${params.id} PATCH error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to update customer." },
      { status: 500 }
    );
  }
}
