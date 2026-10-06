import { NextRequest, NextResponse } from "next/server";
import { trackOrder } from "@/server/orders";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitDistributed(`orders:track:${ip}`, 15, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many tracking lookups. Please wait a moment.");
    }

    const { orderNumber, phoneOrEmail } = await request.json();

    if (!orderNumber || !phoneOrEmail) {
      return NextResponse.json(
        { error: "Both Order Number and Phone/Email are required to track an order." },
        { status: 400 }
      );
    }

    const order = await trackOrder(orderNumber, phoneOrEmail);

    // Defense-in-depth: Non-existent order and contact mismatch return identical status (404) and body
    // Prevents order number enumeration or customer contact probing
    if (!order) {
      return NextResponse.json(
        { error: "No matching order found for this order number and contact information." },
        { status: 404 }
      );
    }

    // Return only minimal tracking summary: status, courier tracking, and line item names + quantities.
    // Strictly omits addresses, customer contact info, billing data, amounts, and internal IDs.
    return NextResponse.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        trackingNumber: order.trackingNumber || null,
        courierPartner: order.courierPartner || null,
        items: (order.items || []).map((i: any) => ({
          productName: i.productName,
          quantity: i.quantity,
        })),
      },
    });
  } catch (error) {
    console.error("API /api/orders/track error:", error);
    return NextResponse.json(
      { error: "Failed to query order tracking status." },
      { status: 500 }
    );
  }
}
