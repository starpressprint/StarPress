import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let user = (await getSessionUser()) || (await getServerSession(authOptions))?.user;

    // Fallback to Bearer token if cookies are missing (client-side local storage auth)
    if (!user) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { createServerClient } = await import("@supabase/ssr");
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder",
          { cookies: { getAll: () => [], setAll: () => {} } }
        );
        const { data } = await supabase.auth.getUser(token);
        if (data?.user) {
          const email = data.user.email || "";
          user = {
            id: data.user.id,
            email,
            name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || email.split("@")[0] || "Customer",
            phone: data.user.phone || data.user.user_metadata?.phone || null,
            role: data.user.app_metadata?.role || data.user.user_metadata?.role || "CUSTOMER"
          };
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const email = (user.email || "").toLowerCase().trim();
    let dbOrders: any[] = [];

    try {
      const userWhere: any[] = [{ userId: user.id }];
      if (email) {
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
        (o) =>
          o.userId === user.id ||
          (email && o.guestEmail?.toLowerCase().trim() === email)
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
