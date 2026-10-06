// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder";

/**
 * Creates a server-side Supabase client bound to Next.js cookies.
 * For use in Server Components, Route Handlers, and Server Actions.
 */
export async function createClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // Handled safely by middleware session refreshing.
        }
      },
    },
  });
}

/**
 * Validates the current authenticated user on the server.
 * Uses auth.getUser() which cryptographically verifies the session with Supabase Auth server.
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (err) {
    console.error("[Supabase Server] Error getting authenticated user:", err);
    return null;
  }
}

import { isUserAdmin } from "@/lib/admin/is-admin";

/**
 * Normalized user session helper for API routes.
 * Maps Supabase user identity to application user contract.
 */
export async function getSessionUser() {
  const supabaseUser = await getAuthenticatedUser();
  if (!supabaseUser) return null;

  const email = supabaseUser.email || "";
  const metadata = supabaseUser.user_metadata || {};
  const appMetadata = supabaseUser.app_metadata || {};

  return {
    id: supabaseUser.id,
    email,
    name: metadata.name || metadata.full_name || (email ? email.split("@")[0] : "Customer"),
    phone: supabaseUser.phone || metadata.phone || null,
    role: isUserAdmin(supabaseUser) ? "ADMIN" : (appMetadata.role || "CUSTOMER"),
    app_metadata: appMetadata,
    email_confirmed_at: supabaseUser.email_confirmed_at,
  };
}

/**
 * Defense-in-depth server authorization check for Admin privileges.
 * NEVER trusts client-side metadata; verifies authoritative isUserAdmin check.
 */
export async function requireAdmin() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { authorized: false, error: "Unauthorized: No active session", user: null };
  }

  if (!isUserAdmin(user)) {
    return { authorized: false, error: "Forbidden: Administrative access required", user };
  }

  return { authorized: true, error: null, user };
}
