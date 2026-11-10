import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";
import { syncAllSupabaseUsersToDb } from "@/lib/user-sync";

function safeIsoDate(val: any): string {
  if (!val || val === "undefined" || val === "null") {
    return new Date().toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const filter = searchParams.get("filter") || "all"; // 'all' | 'with_orders' | 'no_orders'
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    // 1. Authoritatively sync any new/existing Supabase Auth users to Prisma User table
    try {
      await syncAllSupabaseUsersToDb();
    } catch (e) {
      console.warn("[API /api/admin/customers] Sync notice:", e);
    }

    // 2. Fetch real orders (from Prisma or persistentStore)
    let orders: any[] = [];
    try {
      orders = await db.order.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch {
      orders = persistentStore.getOrders();
    }

    // 3. Fetch registered users from PostgreSQL
    let users: any[] = [];
    try {
      users = await db.user.findMany({
        include: { addresses: true },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      users = [];
    }

    // 4. Build customer aggregation map by email
    const customerMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      phone: string;
      totalOrders: number;
      totalSpent: number;
      lastOrderDate: string | null;
      status: "active" | "inactive";
      createdAt: string;
      address: string;
      avatar: string | null;
      role?: string;
    }>();

    // Add ALL registered users first (even if they have 0 orders yet)
    for (const u of users) {
      const defaultAddr = u.addresses?.find((a: any) => a.isDefault) || u.addresses?.[0];
      const addrStr = defaultAddr
        ? [defaultAddr.line1, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(", ")
        : "";
      customerMap.set(u.email.toLowerCase(), {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
        status: "active",
        createdAt: safeIsoDate(u.createdAt),
        address: addrStr,
        avatar: null,
        role: u.role,
      });
    }

    // Aggregate orders onto registered accounts or add guest accounts
    for (const o of orders) {
      const email = (o.guestEmail || o.user?.email || "").toLowerCase().trim();
      if (!email) continue;

      let entry = customerMap.get(email);
      let addrStr = "";
      if (typeof o.shippingAddress === "string") {
        addrStr = o.shippingAddress;
      } else if (o.shippingAddress) {
        const a = o.shippingAddress;
        addrStr = [a.addressLine1 || a.line1, a.city, a.state, a.pincode].filter(Boolean).join(", ");
      }

      const orderTotal = Number(o.totalAmount || 0);
      const orderDate = safeIsoDate(o.createdAt);

      if (!entry) {
        entry = {
          id: `cust_${Buffer.from(email).toString("hex").substring(0, 8)}`,
          name: o.guestName || "Customer",
          email,
          phone: o.guestPhone || "",
          totalOrders: 1,
          totalSpent: orderTotal,
          lastOrderDate: orderDate,
          status: "active",
          createdAt: orderDate,
          address: addrStr,
          avatar: null,
          role: "GUEST",
        };
        customerMap.set(email, entry);
      } else {
        entry.totalOrders += 1;
        entry.totalSpent += orderTotal;
        if (!entry.lastOrderDate || new Date(orderDate) > new Date(entry.lastOrderDate)) {
          entry.lastOrderDate = orderDate;
        }
        if (!entry.phone && o.guestPhone) entry.phone = o.guestPhone;
        if (!entry.address && addrStr) entry.address = addrStr;
      }
    }

    let customers = Array.from(customerMap.values());

    // Compute stats
    const stats = {
      total: customers.length,
      withOrders: customers.filter((c) => c.totalOrders > 0).length,
      noOrders: customers.filter((c) => c.totalOrders === 0).length,
    };

    // Apply tab filter
    if (filter === "with_orders") {
      customers = customers.filter((c) => c.totalOrders > 0);
    } else if (filter === "no_orders") {
      customers = customers.filter((c) => c.totalOrders === 0);
    }

    // Apply search filter
    if (search) {
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.phone.includes(search)
      );
    }

    // Sort: users with orders first (by totalSpent desc), then registered users by createdAt desc
    customers.sort((a, b) => {
      if (a.totalOrders > 0 && b.totalOrders > 0) {
        return b.totalSpent - a.totalSpent;
      }
      if (a.totalOrders > 0 && b.totalOrders === 0) return -1;
      if (a.totalOrders === 0 && b.totalOrders > 0) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = customers.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const paged = customers.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      customers: paged,
      stats,
      total,
      totalPages,
      page,
      limit,
    });
  } catch (error) {
    console.error("API /api/admin/customers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers." },
      { status: 500 }
    );
  }
}
