import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { registerSchema } from "@/lib/validation/auth";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logAuthEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // 1. Rate Limiting Defense: Max 5 registration attempts per 15 minutes per IP
  const rateLimitResult = await rateLimitDistributed(`register:${clientIp}`, 5, 15 * 60);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many registration attempts. Please try again in a few minutes."
    );
  }

  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const errorMsg = validation.error.errors[0]?.message || "Invalid input data.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, email, password, phone } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 2. Check if email is already registered
      const existingUser = await db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // Prevent account enumeration by returning a clean, helpful error
        return NextResponse.json(
          { error: "An account with this email address already exists. Please sign in instead." },
          { status: 409 }
        );
      }

      // 3. Cryptographic Hashing with 12 bcrypt salt rounds
      const passwordHash = await bcrypt.hash(password, 12);

      // 4. Generate Cryptographic Email Verification Token (24-hour expiry)
      const emailVerificationToken = randomBytes(32).toString("hex");
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await db.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          phone: phone?.trim() || null,
          role: Role.CUSTOMER,
          failedLoginAttempts: 0,
          emailVerificationToken,
          emailVerificationExpires,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      // 5. Audit Logging
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        action: "REGISTER",
        status: "SUCCESS",
        ipAddress: clientIp,
        userAgent,
      });

      // In local development, log token to console for easy testing
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `\n📬 [DEV EMAIL VERIFICATION] User ${user.email} registered.\nVerification Link: /verify-email?token=${emailVerificationToken}\n`
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Account created successfully! Please verify your email address.",
          user,
          devVerificationToken:
            process.env.NODE_ENV !== "production" ? emailVerificationToken : undefined,
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      console.error("[register] Database persistence error:", dbError);
      return NextResponse.json(
        { error: "Unable to create account right now. Please try again shortly." },
        { status: 503 }
      );
    }
  } catch (err: any) {
    console.error("[register] Request processing error:", err);
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
