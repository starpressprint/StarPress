import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;

  // Resolve true public origin from reverse proxy headers (Vercel strips external origin from request.url)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const rawHost = forwardedHost || request.headers.get("host") || "";
  const host = rawHost.toLowerCase().split(":")[0].replace(/^admin\.www\./, "admin.");

  let origin = host
    ? `${forwardedProto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || requestUrl.origin;

  // Safeguard: Never redirect to localhost in production environments
  if (origin.includes("localhost") && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
    origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.starpress.in";
  }

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";
  const errorMsg = searchParams.get("error_description") || searchParams.get("error");

  if (errorMsg) {
    console.error("[Auth Callback] Incoming error param:", errorMsg);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // 1. Handle PKCE authorization code exchange (Google OAuth & standard PKCE)
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Synchronize authenticated user to database to guarantee foreign key integrity
      try {
        const { ensureDbUser } = await import("@/lib/user-sync");
        await ensureDbUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
          phone: data.user.phone || data.user.user_metadata?.phone,
          role: data.user.app_metadata?.role,
          app_metadata: data.user.app_metadata,
          email_confirmed_at: data.user.email_confirmed_at,
        });
      } catch (syncErr) {
        console.warn("[Auth Callback] User sync notice:", syncErr);
      }

      let destination = next;

      if (destination.startsWith("/") && !destination.startsWith("//")) {
        return NextResponse.redirect(`${origin}${destination}`);
      }

      try {
        const destUrl = new URL(destination, origin);
        if (destUrl.origin === origin) {
          return NextResponse.redirect(destUrl.toString());
        }
      } catch {}

      return NextResponse.redirect(`${origin}/`);
    }
    console.error("[Auth Callback] Error exchanging code for session:", error);
  }

  // 2. Handle email verification OTP token_hash flow
  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error && data?.user) {
      try {
        const { ensureDbUser } = await import("@/lib/user-sync");
        await ensureDbUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
          phone: data.user.phone || data.user.user_metadata?.phone,
          role: data.user.app_metadata?.role,
          app_metadata: data.user.app_metadata,
          email_confirmed_at: data.user.email_confirmed_at,
        });
      } catch (syncErr) {
        console.warn("[Auth Callback] User sync notice:", syncErr);
      }

      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
    }
    console.error("[Auth Callback] Error verifying OTP token_hash:", error);
  }

  // If code / OTP exchange fails, return user to login with error
  return NextResponse.redirect(`${origin}/login?error=OAuthCallbackError`);
}
