import { profileSchema } from "@/lib/validation/account";
import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth-resolver";
import { strongPasswordSchema } from "@/lib/validation/auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/user-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:profile:get:${user.id}`, 30, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many profile requests.");
    }

    await ensureDbUser(user);

    try {
      const dbUser = await db.user.findFirst({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      if (!dbUser) {
        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
          },
        });
      }

      return NextResponse.json({ success: true, user: dbUser });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/profile GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await resolveUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { rateLimitDistributed, rateLimitExceededResponse } = await import("@/lib/rate-limit");
    const rl = await rateLimitDistributed(`account:profile:patch:${user.id}`, 15, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many profile update requests.");
    }

    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid profile" }, { status: 400 });
    const { name, phone, currentPassword, newPassword } = parsed.data;

    try {
      let existingUser = await db.user.findFirst({
        where: { id: user.id },
      });

      if (!existingUser) {
        existingUser = await ensureDbUser(user);
      }

      if (!existingUser) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      const updateData: { name?: string; phone?: string | null; passwordHash?: string } = {};

      if (name && name.trim().length >= 2) {
        updateData.name = name.trim();
      }

      if (phone !== undefined) {
        updateData.phone = phone ? phone.trim() : null;
      }

      // Password update if requested
      if (newPassword) {
        if (!existingUser.passwordHash) {
          return NextResponse.json({ error: "Use password recovery with your sign-in provider to change your password." }, { status: 400 });
        }
        if (!currentPassword) {
          return NextResponse.json(
            { error: "Current password is required to set a new password." },
            { status: 400 }
          );
        }

        const passwordValidation = strongPasswordSchema.safeParse(newPassword);
        if (!passwordValidation.success) {
          return NextResponse.json(
            { error: passwordValidation.error.issues[0]?.message || "Invalid password." },
            { status: 400 }
          );
        }

        const isMatch = await bcrypt.compare(currentPassword, existingUser.passwordHash || "");
        if (!isMatch) {
          return NextResponse.json(
            { error: "Current password does not match our records." },
            { status: 400 }
          );
        }

        updateData.passwordHash = await bcrypt.hash(newPassword, 12);
      }

      const updated = await db.user.update({
        where: { id: existingUser.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Profile updated successfully.",
        user: updated,
      });
    } catch (dbErr) {
      console.error("Account database operation failed:", dbErr);
      return NextResponse.json({ error: "Account service is temporarily unavailable. Please retry." }, { status: 503 });
    }
  } catch (error) {
    console.error("API /api/account/profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
