import { addressSchema, addressUpdateSchema } from "@/lib/validation/account";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/user-sync";

export const dynamic = "force-dynamic";

import { resolveUser } from "@/lib/auth-resolver";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:addresses:get:${user.id}`, 30, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many address requests.");
    }

    await ensureDbUser(user);

    try {
      const addresses = await db.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      return NextResponse.json({ success: true, addresses });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/addresses GET error:", error);
    return NextResponse.json({ error: "Failed to load addresses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:addresses:post:${user.id}`, 15, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many address creation requests.");
    }

    await ensureDbUser(user);

    const parsed = addressSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid address" }, { status: 400 });
    const body = parsed.data;
    const { label, line1, line2, city, state, pincode, phone, isDefault } = body;

    const trimmedLine1 = (line1 || "").trim();
    const trimmedCity = (city || "").trim();
    const trimmedState = (state || "").trim();
    const trimmedPincode = (pincode || "").replace(/\D/g, "").slice(0, 6);
    const trimmedPhone = (phone || "").replace(/[^\d+]/g, "").slice(0, 15);

    if (!trimmedLine1 || !trimmedCity || !trimmedState || !trimmedPincode || !trimmedPhone) {
      return NextResponse.json(
        { error: "Address line 1, city, state, PIN code, and phone number are required." },
        { status: 400 }
      );
    }

    if (!/^[1-9][0-9]{5}$/.test(trimmedPincode)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit Indian PIN code." },
        { status: 400 }
      );
    }

    try {
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        // Check if user already has addresses; if this is the first address, make it default automatically
        const existingCount = await tx.address.count({ where: { userId: user.id } });
        const makeDefault = Boolean(isDefault) || existingCount === 0;

        if (makeDefault) {
          await tx.address.updateMany({
            where: { userId: user.id },
            data: { isDefault: false },
          });
        }

        const address = await tx.address.create({
          data: {
            userId: user.id,
            label: (label || "").trim() || "Delivery Address",
            line1: trimmedLine1,
            line2: line2?.trim() || null,
            city: trimmedCity,
            state: trimmedState,
            pincode: trimmedPincode,
            phone: trimmedPhone,
            isDefault: makeDefault,
          },
        });

        return NextResponse.json({ success: true, address }, { status: 201 });
      });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/addresses POST error:", error);
    return NextResponse.json({ error: "Failed to save address." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:addresses:put:${user.id}`, 20, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many address update requests.");
    }

    await ensureDbUser(user);

    const parsed = addressUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid address" }, { status: 400 });
    const body = parsed.data;
    const { id, label, line1, line2, city, state, pincode, phone, isDefault } = body;

    if (!id) {
      return NextResponse.json({ error: "Address ID is required for update." }, { status: 400 });
    }

    const trimmedLine1 = (line1 || "").trim();
    const trimmedCity = (city || "").trim();
    const trimmedState = (state || "").trim();
    const trimmedPincode = (pincode || "").replace(/\D/g, "").slice(0, 6);
    const trimmedPhone = (phone || "").replace(/[^\d+]/g, "").slice(0, 15);

    if (!trimmedLine1 || !trimmedCity || !trimmedState || !trimmedPincode || !trimmedPhone) {
      return NextResponse.json(
        { error: "Address line 1, city, state, PIN code, and phone number are required." },
        { status: 400 }
      );
    }

    if (!/^[1-9][0-9]{5}$/.test(trimmedPincode)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit Indian PIN code." },
        { status: 400 }
      );
    }

    try {
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        const existing = await tx.address.findFirst({
          where: { id, userId: user.id },
        });

        if (!existing) {
          return NextResponse.json({ error: "Address not found or unauthorized." }, { status: 404 });
        }

        if (isDefault) {
          await tx.address.updateMany({
            where: { userId: user.id },
            data: { isDefault: false },
          });
        }

        const updated = await tx.address.update({
          where: { id },
          data: {
            label: (label || "").trim() || "Delivery Address",
            line1: trimmedLine1,
            line2: line2?.trim() || null,
            city: trimmedCity,
            state: trimmedState,
            pincode: trimmedPincode,
            phone: trimmedPhone,
            ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
          },
        });

        return NextResponse.json({ success: true, address: updated });
      });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/addresses PUT error:", error);
    return NextResponse.json({ error: "Failed to update address." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:addresses:delete:${user.id}`, 20, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many address deletion requests.");
    }

    let id = request.nextUrl.searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {}
    }

    if (typeof id !== "string" || !id || id.length > 128) {
      return NextResponse.json({ error: "Address ID is required for deletion." }, { status: 400 });
    }

    try {
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        const existing = await tx.address.findFirst({
          where: { id, userId: user.id },
        });

        if (!existing) {
          return NextResponse.json({ error: "Address not found or unauthorized." }, { status: 404 });
        }

        await tx.address.delete({
          where: { id },
        });

        // If the deleted address was the default, set another address as default if one exists
        if (existing.isDefault) {
          const remaining = await tx.address.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
          });
          if (remaining) {
            await tx.address.update({
              where: { id: remaining.id },
              data: { isDefault: true },
            });
          }
        }

        return NextResponse.json({ success: true, message: "Address deleted successfully." });
      });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/addresses DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete address." }, { status: 500 });
  }
}
