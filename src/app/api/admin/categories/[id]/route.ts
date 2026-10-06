// =============================================================================
// PATCH/DELETE /api/admin/categories/[id]
// Update or delete a single category
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { db } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/categories/[id]
 * Update category fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.slug !== undefined) updateData.slug = body.slug.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
    if (body.displayOrder !== undefined)
      updateData.displayOrder = body.displayOrder;

    const category = await db.category.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: { select: { products: true } },
      },
    });

    // Audit log
    try {
      await db.adminAuditLog.create({
        data: {
          adminEmail: auth.user?.email || "admin@example.com",
          entityType: "category",
          entityId: params.id,
          action: "update",
          changes: updateData,
          ipAddress: request.headers.get("x-forwarded-for") || null,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder,
        productCount: category._count.products,
      },
    });
  } catch (error: any) {
    console.error(
      `API /api/admin/categories/${params.id} PATCH error:`,
      error
    );
    return NextResponse.json(
      { error: error?.message || "Failed to update category." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Delete a category. Products in this category must be reassigned first.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Check if category has products
    const category = await db.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 }
      );
    }

    if (category._count.products > 0) {
      // Get or create "Uncategorized" fallback
      const fallback = await db.category.upsert({
        where: { slug: "uncategorized" },
        update: {},
        create: {
          name: "Uncategorized",
          slug: "uncategorized",
          description: "Products without a specific category",
          displayOrder: 999,
        },
      });

      // Move products to fallback category
      await db.product.updateMany({
        where: { categoryId: params.id },
        data: { categoryId: fallback.id },
      });
    }

    await db.category.delete({ where: { id: params.id } });

    // Audit log
    try {
      await db.adminAuditLog.create({
        data: {
          adminEmail: auth.user?.email || "admin@example.com",
          entityType: "category",
          entityId: params.id,
          action: "delete",
          changes: { name: category.name, slug: category.slug },
          ipAddress: request.headers.get("x-forwarded-for") || null,
        },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(
      `API /api/admin/categories/${params.id} DELETE error:`,
      error
    );
    return NextResponse.json(
      { error: error?.message || "Failed to delete category." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/categories/[id]/reorder
 * Update display orders for all categories.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { orders } = body; // Array of { id, displayOrder }

    if (!Array.isArray(orders)) {
      return NextResponse.json(
        { error: "Expected array of { id, displayOrder }." },
        { status: 400 }
      );
    }

    // Batch update display orders
    await Promise.all(
      orders.map((item: { id: string; displayOrder: number }) =>
        db.category.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API /api/admin/categories reorder error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reorder categories." },
      { status: 500 }
    );
  }
}
