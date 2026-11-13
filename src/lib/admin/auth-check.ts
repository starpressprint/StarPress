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

    // Read current privileges for every admin request; session roles can be stale.
    const normalizedEmail = (user.email || "").toLowerCase().trim();
    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          ...(user.id ? [{ id: user.id }] : []),
          ...(normalizedEmail && user.email_confirmed_at ? [{ email: normalizedEmail }] : []),
        ],
      },
      select: { id: true, email: true, role: true },
    });

    if (dbUser?.role === "ADMIN") {
      return { authorized: true, user: { ...user, role: "ADMIN" } };
    }

    // Existing database accounts are authoritative, including role revocation.
    // A verified allowlist may only bootstrap an account not yet provisioned.
    if (!dbUser && isUserAdmin({ email: user.email, email_confirmed_at: user.email_confirmed_at })) {
      return { authorized: true, user: { ...user, role: "ADMIN" } };
    }

    return { authorized: false, status: 403, error: "Forbidden: Star Press administrative privileges required." };
  } catch (error) {
    console.error("[verifyAdminAccess] Exception:", error);
    return { authorized: false, status: 503, error: "Authorization service is temporarily unavailable." };
  }
}
