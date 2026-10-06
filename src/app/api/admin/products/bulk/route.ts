import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { bulkUpdateProductStatus, deleteAdminProduct } from "@/server/products";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { action, ids, status } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Product IDs array is required." }, { status: 400 });
    }

    if (action === "update_status" && status) {
      const count = await bulkUpdateProductStatus(ids, status);
      return NextResponse.json({ success: true, count });
    }

    if (action === "delete") {
      let count = 0;
      const adminEmail = auth.user?.email || "admin@example.com";
      for (const id of ids) {
        const res = await deleteAdminProduct(id, adminEmail);
        if (res.success) count++;
      }
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json({ error: "Invalid bulk action." }, { status: 400 });
  } catch (error) {
    console.error("API /api/admin/products/bulk error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk product action." },
      { status: 500 }
    );
  }
}
