// =============================================================================
// POST /api/admin/categories — Create a new category
// GET already exists in route.ts — this file adds POST
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { listAdminCategories } from "@/server/products";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/categories
 * Retrieve all categories with product counts.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
      const categories = await db.category.findMany({
        orderBy: { displayOrder: "asc" },
        include: {
          _count: { select: { products: true } },
        },
      });

      if (categories.length > 0) {
        return NextResponse.json({
          success: true,
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description || "",
            imageUrl: c.imageUrl || null,
            displayOrder: c.displayOrder,
            productCount: c._count.products,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          })),
        });
      }
    } catch {
      // Fallback
    }

    const categories = await listAdminCategories();
    return NextResponse.json({
      success: true,
      categories: categories.map((c: any) => ({
        ...c,
        description: c.description || "",
        imageUrl: c.imageUrl || null,
        displayOrder: c.displayOrder || 0,
        productCount: c.productCount || 0,
      })),
    });
  } catch (error) {
    console.error("API /api/admin/categories GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/categories
 * Create a new category.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { name, slug, description, imageUrl, displayOrder } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required." },
        { status: 400 }
      );
    }

    // Auto-generate slug if not provided
    const categorySlug =
      slug?.trim() ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Check for duplicate
    const existing = await db.category.findFirst({
      where: {
        OR: [{ name: name.trim() }, { slug: categorySlug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name or slug already exists." },
        { status: 409 }
      );
    }

    // Get max display order
    const maxOrder = await db.category.aggregate({
      _max: { displayOrder: true },
    });

    const category = await db.category.create({
      data: {
        name: name.trim(),
        slug: categorySlug,
        description: description?.trim() || null,
        imageUrl: imageUrl || null,
        displayOrder: displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
      },
    });

    // Audit log
    try {
      await db.adminAuditLog.create({
        data: {
          adminEmail: auth.user?.email || "admin@example.com",
          entityType: "category",
          entityId: category.id,
          action: "create",
          changes: { name: category.name, slug: category.slug },
          ipAddress: request.headers.get("x-forwarded-for") || null,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error("API /api/admin/categories POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create category." },
      { status: 500 }
    );
  }
}
