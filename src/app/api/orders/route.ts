import { orderInputSchema } from "@/lib/validation/commerce";
import { NextRequest, NextResponse } from "next/server";
import { createOrder, CreateOrderInput } from "@/server/orders";
import { getSessionUser } from "@/lib/supabase/server";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const validation = orderInputSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0]?.message || "Invalid order." }, { status: 400 });
    const body: CreateOrderInput = validation.data;

    if (!body || !body.shippingAddress || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Shipping address and at least one item are required." },
        { status: 400 }
      );
    }

    if (!body.shippingAddress.fullName || !body.shippingAddress.phone || !body.shippingAddress.addressLine1) {
      return NextResponse.json(
        { error: "Full name, phone, and delivery address are mandatory." },
        { status: 400 }
      );
    }

    // Server-side GSTIN validation (H-04)
    if (body.billingAddress && (body.billingAddress as any).gstin) {
      const gstin = ((body.billingAddress as any).gstin || "").trim().toUpperCase();
      const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (gstin && !GSTIN_REGEX.test(gstin)) {
        return NextResponse.json(
          { error: "Invalid GSTIN format. Please enter a valid 15-character GSTIN." },
          { status: 400 }
        );
      }
    }

    // Authenticate user across Supabase, NextAuth, and Bearer tokens
    let user = null;
    try {
      const { resolveUser } = await import("@/lib/auth-resolver");
      user = await resolveUser(request);
    } catch (authErr) {
      console.warn("[Orders API] User resolution notice:", authErr);
    }

    const ip = getClientIp(request);
    const key = user ? `order:create:${user.id}` : `order:create:${ip}`;
    const rl = await rateLimitDistributed(key, 5, 120);
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many order creation requests. Please wait a moment before trying again."
      );
    }

    // Mandatory User Authentication Enforcement: reject unauthenticated or guest requests
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to place an order. Please sign in." },
        { status: 401 }
      );
    }

    body.userId = user.id;
    body.guestEmail = user.email || body.shippingAddress?.email;
    body.guestName = user.name || body.shippingAddress?.fullName || "Valued Customer";

    // Read Idempotency Key from standard headers
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      body.idempotencyKey;

    if (idempotencyKey) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey)) {
        return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400 });
      }
      body.idempotencyKey = idempotencyKey;
    }

    const result = await createOrder(body);

    return NextResponse.json(
      {
        success: true,
        order: result.order,
        isExisting: (result as any).isExisting || false,
      },
      { status: (result as any).isExisting ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("API /api/orders error:", error);
    const status = error?.statusCode || 500;
    return NextResponse.json(
      { error: error?.message || "Failed to process order. Please try again." },
      { status }
    );
  }
}
