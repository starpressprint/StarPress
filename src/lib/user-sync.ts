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
      where: email ? { OR: [{ id: user.id }, { email }] } : { id: user.id },
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
