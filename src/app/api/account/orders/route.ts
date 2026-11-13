import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth-resolver";
import { isOrderOwner } from "@/lib/order-access";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:orders:${user.id}`, 30, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many orders requests.");
    }

    const email = (user.email || "").toLowerCase().trim();
    let dbOrders: any[] = [];

    try {
      const userWhere: any[] = [{ userId: user.id }];
      if (email && user.email_confirmed_at) {
        userWhere.push({ guestEmail: email });
      }

      dbOrders = await (db.order as any).findMany({
        where: {
          OR: userWhere,
        },
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
        },
      });
    } catch (dbErr) {
      // Database query failed
    }

    // Merge persistent store orders
    let localOrders: any[] = [];
    try {
      localOrders = persistentStore.getOrders().filter(
        (o) => isOrderOwner(o, user)
      );
    } catch {}

    const combined = [...dbOrders];
    for (const lo of localOrders) {
      const exists = combined.some(
        (co) =>
          (co.id && lo.id && co.id === lo.id) ||
          (co.orderNumber && lo.orderNumber && co.orderNumber === lo.orderNumber)
      );
      if (!exists) {
        combined.push(lo);
      }
    }

    combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, orders: combined });
  } catch (error) {
    console.error("API /api/account/orders GET error:", error);
    return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
