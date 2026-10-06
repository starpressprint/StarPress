import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { listAdminProducts, createAdminProduct } from "@/server/products";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products
 * List products with search, status filtering, category filtering, and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const stockStatus = searchParams.get("stockStatus") || "ALL";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";

    const result = await listAdminProducts({
      search,
      category,
      status,
      stockStatus,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      products: result.products,
      total: result.total,
      page: result.page,
      limit: result.limit,
      stats: result.stats,
    });
  } catch (error) {
    console.error("API /api/admin/products GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve products." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/products
 * Create a new product.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    if (!body.name || !body.basePrice) {
      return NextResponse.json(
        { error: "Product name and base price are required." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const result = await createAdminProduct(body, auth.user?.email || "admin@example.com", ipAddress);

    if (result.success && result.product) {
      revalidatePath("/shop");
      revalidatePath("/categories");
      revalidatePath("/");
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/admin/products POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create product." },
      { status: 500 }
    );
  }
}
