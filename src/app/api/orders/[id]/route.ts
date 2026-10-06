import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/server/orders";
import { getSessionUser } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/admin/is-admin";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ip = getClientIp(request);
    const user = await getSessionUser();

    const rateLimitKey = user ? `orders:detail:${user.id}` : `orders:detail:${ip}`;
    const rl = await rateLimitDistributed(rateLimitKey, 30, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many requests. Please wait a moment.");
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const order = await getOrderById(params.id);

    // Defense-in-depth: Return 404 for non-existent orders OR unauthorized access to another user's order
    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const isOwner =
      order.userId === user.id ||
      (order.guestEmail && user.email && order.guestEmail.toLowerCase().trim() === user.email.toLowerCase().trim());
    const isAdmin = isUserAdmin(user) || user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("API /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order details." },
      { status: 500 }
    );
  }
}
