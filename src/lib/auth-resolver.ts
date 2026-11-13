import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/supabase/server";
import { ensureDbUser } from "@/lib/user-sync";

export interface ResolvedUser {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role?: string;
  app_metadata?: any;
  email_confirmed_at?: string | null;
}

/**
 * Centrally resolves the currently authenticated user across:
 * 1. Supabase session cookies
 * 2. NextAuth session cookies (credentials, Google OAuth, etc.)
 * 3. Bearer Authorization header (JWT from client-side Supabase session)
 *
 * Automatically syncs the user to Postgres DB via ensureDbUser.
 */
export async function resolveUser(request?: NextRequest): Promise<ResolvedUser | null> {
  let resolved: ResolvedUser | null = null;

  // Strategy 1: Supabase Server Cookies
  try {
    const supabaseUser = await getSessionUser();
    if (supabaseUser && supabaseUser.id) {
      resolved = {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        name: supabaseUser.name || (supabaseUser.email ? supabaseUser.email.split("@")[0] : "Customer"),
        phone: supabaseUser.phone || null,
        role: supabaseUser.role || "CUSTOMER",
        app_metadata: supabaseUser.app_metadata,
        email_confirmed_at: supabaseUser.email_confirmed_at,
      };
    }
  } catch {}

  // Strategy 2: NextAuth Session Cookies
  if (!resolved) {
    try {
      const nextAuthSession = await getServerSession(authOptions);
      if (nextAuthSession?.user?.email) {
        resolved = {
          id: (nextAuthSession.user as any).id || "",
          email: nextAuthSession.user.email,
          name:
            nextAuthSession.user.name ||
            (nextAuthSession.user.email ? nextAuthSession.user.email.split("@")[0] : "Customer"),
          phone: (nextAuthSession.user as any).phone || null,
          role: (nextAuthSession.user as any).role || "CUSTOMER",
        };
      }
    } catch {}
  }

  // Strategy 3: Bearer Authorization Header
  if (!resolved && request) {
    try {
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
          resolved = {
            id: data.user.id,
            email,
            name:
              data.user.user_metadata?.name ||
              data.user.user_metadata?.full_name ||
              (email ? email.split("@")[0] : "Customer"),
            phone: data.user.phone || data.user.user_metadata?.phone || null,
            role: data.user.app_metadata?.role || "CUSTOMER",
            app_metadata: data.user.app_metadata,
            email_confirmed_at: data.user.email_confirmed_at,
          };
        }
      }
    } catch {}
  }

  // Ensure DB user sync if resolved
  if (resolved) {
    try {
      const dbUser = await ensureDbUser(resolved);
      if (dbUser) resolved = { ...resolved, id: dbUser.id, role: dbUser.role,
        email_confirmed_at: resolved.email_confirmed_at || dbUser.emailVerified?.toISOString() || null };
    } catch (syncErr) {
      console.warn("[resolveUser] Non-fatal DB user sync warning:", syncErr);
    }
  }

  return resolved;
}
