import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import {
  getAdminProductById,
  updateAdminProduct,
  deleteAdminProduct,
} from "@/server/products";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products/[id]
 * Retrieve single product details.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const product = await getAdminProductById(params.id);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error(`API /api/admin/products/${params.id} GET error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch product details." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/products/[id]
 * Update product fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const result = await updateAdminProduct(
      params.id,
      body,
      auth.user?.email || "admin@example.com",
      ipAddress
    );

    if (result.success && result.product) {
      // Revalidate cache for real-time storefront updates
      revalidatePath("/shop");
      revalidatePath(`/shop/${result.product.slug}`);
      revalidatePath("/categories");
      revalidatePath("/");
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`API /api/admin/products/${params.id} PATCH error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to update product." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Delete product.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const result = await deleteAdminProduct(
      params.id,
      auth.user?.email || "admin@example.com",
      ipAddress
    );

    if (result.success) {
      revalidatePath("/shop");
      revalidatePath("/categories");
      revalidatePath("/");
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`API /api/admin/products/${params.id} DELETE error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete product." },
      { status: 500 }
    );
  }
}
