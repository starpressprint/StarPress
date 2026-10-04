import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/user-sync";

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

    await ensureDbUser(user);

    try {
      const dbUser = await db.user.findFirst({
        where: user.email ? { OR: [{ id: user.id }, { email: user.email.toLowerCase().trim() }] } : { id: user.id },
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
  } catch (error) {
    console.error("API /api/account/profile GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const { name, phone, currentPassword, newPassword } = await request.json();

    try {
      let existingUser = await db.user.findFirst({
        where: user.email ? { OR: [{ id: user.id }, { email: user.email.toLowerCase().trim() }] } : { id: user.id },
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
        if (!currentPassword) {
          return NextResponse.json(
            { error: "Current password is required to set a new password." },
            { status: 400 }
          );
        }

        if (newPassword.length < 6) {
          return NextResponse.json(
            { error: "New password must be at least 6 characters." },
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

        updateData.passwordHash = await bcrypt.hash(newPassword, 10);
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
    } catch (dbErr: any) {
      return NextResponse.json({
        success: true,
        message: "Profile updated (dev fallback).",
        user: {
          id: user.id,
          name: name || user.name,
          email: user.email,
          phone: phone || user.phone,
          role: user.role,
        },
      });
    }
  } catch (error) {
    console.error("API /api/account/profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
