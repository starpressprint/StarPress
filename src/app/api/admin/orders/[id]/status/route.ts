import { NextRequest, NextResponse } from "next/server";
import { updateOrderStatus } from "@/server/orders";
import { verifyAdminAccess } from "@/lib/admin/auth-check";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { status, trackingNumber, courierPartner, notes } = await request.json();

    if (!status) {
      return NextResponse.json(
        { error: "Order status is required." },
        { status: 400 }
      );
    }

    const result = await updateOrderStatus(params.id, status, {
      trackingNumber,
      courierPartner,
      notes,
    });

    if (!result.success || !("order" in result)) {
      return NextResponse.json(
        { error: result.error || "Failed to update order status." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error) {
    console.error("API /api/admin/orders/[id]/status error:", error);
    return NextResponse.json(
      { error: "Failed to update order status." },
      { status: 500 }
    );
  }
}
