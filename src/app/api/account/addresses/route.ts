import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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
      const addresses = await db.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      return NextResponse.json({ success: true, addresses });
    } catch (dbErr) {
      return NextResponse.json({ success: true, addresses: [] });
    }
  } catch (error) {
    console.error("API /api/account/addresses GET error:", error);
    return NextResponse.json({ error: "Failed to load addresses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let user = (await getSessionUser()) || (await getServerSession(authOptions))?.user;

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

    const body = await request.json();
    const { label, line1, line2, city, state, pincode, phone, isDefault } = body;

    if (!line1 || !city || !state || !pincode || !phone) {
      return NextResponse.json(
        { error: "Address line 1, city, state, pincode, and phone number are required." },
        { status: 400 }
      );
    }

    try {
      if (isDefault) {
        // Reset any existing default
        await db.address.updateMany({
          where: { userId: user.id },
          data: { isDefault: false },
        });
      }

      const address = await db.address.create({
        data: {
          userId: user.id,
          label: label || "Delivery Address",
          line1: line1.trim(),
          line2: line2?.trim() || null,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          phone: phone.trim(),
          isDefault: Boolean(isDefault),
        },
      });

      return NextResponse.json({ success: true, address }, { status: 201 });
    } catch (dbErr) {
      return NextResponse.json({
        success: true,
        address: {
          id: `addr-${Date.now()}`,
          userId: user.id,
          label: label || "Delivery Address",
          line1,
          line2,
          city,
          state,
          pincode,
          phone,
          isDefault: Boolean(isDefault),
        },
      }, { status: 201 });
    }
  } catch (error) {
    console.error("API /api/account/addresses POST error:", error);
    return NextResponse.json({ error: "Failed to save address." }, { status: 500 });
  }
}
