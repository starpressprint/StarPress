import { db } from "@/lib/db";
import { UserForAdminCheck } from "@/lib/admin/is-admin";

export interface UserInput extends UserForAdminCheck {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: string;
}

/**
 * Ensures an authenticated user (from Supabase Auth or NextAuth)
 * exists in Prisma PostgreSQL `User` table to guarantee foreign key integrity
 * for orders, addresses, reviews, and profile updates.
 */
export async function ensureDbUser(user: UserInput) {
  if (!user?.id) return null;
  const email = (user.email || "").toLowerCase().trim();

  try {
    // 1. Try finding by ID or Email
    const existing = await db.user.findFirst({
      where: email && user.email_confirmed_at ? { OR: [{ id: user.id }, { email }] } : { id: user.id },
    });

    if (existing) {
      return existing;
    }

    if (!email) {
      return null;
    }

    // 2. Create the user record in Prisma
    // Ensure user-sync NEVER writes role ADMIN based on email.
    // Database role ADMIN is strictly assigned if authoritative app_metadata.role === "ADMIN"
    const isAppAdmin = user.app_metadata?.role === "ADMIN";

    return await db.user.create({
      data: {
        id: user.id,
        email,
        name: user.name || email.split("@")[0] || "Customer",
        phone: user.phone || null,
        role: isAppAdmin ? "ADMIN" : "CUSTOMER",
      },
    });
  } catch (error) {
    console.warn("[ensureDbUser] Notice:", (error as any)?.message);
    return null;
  }
}

/**
 * Authoritatively syncs all registered users from Supabase Auth (`auth.users`)
 * into Prisma PostgreSQL `User` table so that admin panel reflects every account.
 */
export async function syncAllSupabaseUsersToDb(): Promise<number> {
  try {
    const { getAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = getAdminClient();
    let syncedCount = 0;
    for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users) {
      console.warn("[syncAllSupabaseUsersToDb] Supabase admin error:", error);
      throw new Error("User directory sync failed");
    }

    for (const u of data.users) {
      if (!u.email) continue;
      const email = u.email.toLowerCase().trim();
      const name =
        u.user_metadata?.name ||
        u.user_metadata?.full_name ||
        u.user_metadata?.display_name ||
        email.split("@")[0] ||
        "Customer";
      const phone = u.phone || u.user_metadata?.phone || null;
      const isAppAdmin =
        u.app_metadata?.role === "ADMIN";

      await db.user.upsert({
        where: { email },
        update: {
          name,
          phone: phone || undefined,
          // Directory sync must not grant or revoke application privileges.
        },
        create: {
          id: u.id,
          email,
          name,
          phone,
          role: isAppAdmin ? "ADMIN" : "CUSTOMER",
        },
      });
      syncedCount++;
    }

    if (data.users.length < 1000) break;
    }
    return syncedCount;
  } catch (err: any) {
    console.warn("[syncAllSupabaseUsersToDb] Notice:", err?.message);
    return 0;
  }
}

