import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isUserAdmin } from "./is-admin";

export { isUserAdmin };

export async function verifyAdminAccess(request?: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return { authorized: false, status: 401, error: "Unauthorized: Admin session required." };
    }

    const isAdmin = isUserAdmin(user);
    if (isAdmin) {
      return { authorized: true, user };
    }

    return { authorized: false, status: 403, error: "Forbidden: Star Press administrative privileges required." };
  } catch (error) {
    return { authorized: false, status: 500, error: "Internal Server Error during authorization." };
  }
}
