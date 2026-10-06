// =============================================================================
// POST /api/discounts/validate
// Customer checkout coupon validation & calculation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitDistributed(`discounts:validate:${ip}`, 15, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many coupon validation requests. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { code, cartSubtotal } = body;

    if (!code?.trim()) {
      return NextResponse.json(
        { valid: false, error: "Please provide a coupon code." },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");
    const subtotal = Number(cartSubtotal) || 0;

    const discount = await db.discount.findUnique({
      where: { code: normalizedCode },
    });

    if (!discount) {
      return NextResponse.json(
        { valid: false, error: "Invalid coupon code." },
        { status: 404 }
      );
    }

    if (!discount.isActive) {
      return NextResponse.json(
        { valid: false, error: "This coupon code is currently disabled." },
        { status: 400 }
      );
    }

    const now = new Date();

    if (discount.startsAt && new Date(discount.startsAt) > now) {
      return NextResponse.json(
        { valid: false, error: "This coupon promotion has not started yet." },
        { status: 400 }
      );
    }

    if (discount.expiresAt && new Date(discount.expiresAt) < now) {
      return NextResponse.json(
        { valid: false, error: "This coupon code has expired." },
        { status: 400 }
      );
    }

    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      return NextResponse.json(
        { valid: false, error: "This coupon code has reached its maximum usage limit." },
        { status: 400 }
      );
    }

    const minAmount = discount.minOrderAmount ? Number(discount.minOrderAmount) : 0;
    if (minAmount > 0 && subtotal < minAmount) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum order amount of ₹${minAmount} required to use this coupon.`,
        },
        { status: 400 }
      );
    }

    // Calculate discount amount
    const val = Number(discount.value);
    let discountAmount = 0;

    if (discount.type === "percentage") {
      discountAmount = Math.round((subtotal * val) / 100);
    } else {
      discountAmount = Math.min(val, subtotal);
    }

    return NextResponse.json({
      valid: true,
      code: discount.code,
      type: discount.type,
      value: val,
      discountAmount,
      message: `Coupon "${discount.code}" applied! You save ₹${discountAmount}.`,
    });
  } catch (error: any) {
    console.error("API /api/discounts/validate error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate coupon." },
      { status: 500 }
    );
  }
}
