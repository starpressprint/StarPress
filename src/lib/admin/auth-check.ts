import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { resolveUser } from "@/lib/auth-resolver";
import { isUserAdmin } from "./is-admin";
import { db } from "@/lib/db";

export { isUserAdmin };

export async function verifyAdminAccess(request?: NextRequest) {
  try {
    // 1. Try resolving user with centralized auth-resolver (checks Supabase cookies, NextAuth, and Bearer tokens)
    let user = await resolveUser(request).catch(() => null);

    // 2. Fall back to getAuthenticatedUser directly if resolveUser was inconclusive
    if (!user) {
      const explicitToken = request?.headers?.get("authorization");
      const supabaseUser = await getAuthenticatedUser(explicitToken || undefined).catch(() => null);
      if (supabaseUser) {
        user = {
          id: supabaseUser.id,
          email: supabaseUser.email || "",
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "Admin",
          role: supabaseUser.app_metadata?.role || "CUSTOMER",
          app_metadata: supabaseUser.app_metadata,
          email_confirmed_at: supabaseUser.email_confirmed_at,
        };
      }
    }

    if (!user || (!user.id && !user.email)) {
      return { authorized: false, status: 401, error: "Unauthorized: Admin session required." };
    }

    // 3. Authorization Check
    // (a) First check via isUserAdmin helper (app_metadata or ADMIN_EMAILS)
    if (isUserAdmin(user as any)) {
      return { authorized: true, user };
    }

    // (b) Check PostgreSQL database User table directly for role === 'ADMIN'
    const normalizedEmail = (user.email || "").toLowerCase().trim();
    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          ...(user.id ? [{ id: user.id }] : []),
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
      select: { id: true, email: true, role: true },
    }).catch(() => null);

    if (dbUser?.role === "ADMIN") {
      return { authorized: true, user: { ...user, role: "ADMIN" } };
    }

    // (c) Check ADMIN_EMAILS environment variable
    const adminEnv = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
    if (adminEnv && normalizedEmail) {
      const adminList = adminEnv.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (adminList.includes(normalizedEmail)) {
        return { authorized: true, user: { ...user, role: "ADMIN" } };
      }
    }

    return { authorized: false, status: 403, error: "Forbidden: Star Press administrative privileges required." };
  } catch (error) {
    console.error("[verifyAdminAccess] Exception:", error);
    return { authorized: false, status: 500, error: "Internal Server Error during authorization." };
  }
}
