export interface UserForAdminCheck {
  email?: string | null;
  app_metadata?: { role?: string; [key: string]: any } | null;
  role?: string | null;
  email_confirmed_at?: string | null;
  [key: string]: any;
}

export function isUserAdmin(
  user: UserForAdminCheck | null | undefined
): boolean {
  if (!user) return false;

  // (a) Authoritative role in app_metadata
  if (user.app_metadata?.role === "ADMIN") return true;

  // (b) Prisma database role
  if (user.role === "ADMIN") return true;

  // (c) Email in ADMIN_EMAILS environment variable
  const email = (user.email || "").toLowerCase().trim();
  if (email && user.email_confirmed_at) {
    const adminEnv =
      process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
    if (adminEnv) {
      const list = adminEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (list.includes(email)) return true;
    }
  }

  return false;
}
