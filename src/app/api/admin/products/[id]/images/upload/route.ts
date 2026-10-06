import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";
import { getAdminProductById } from "@/server/products";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/products/[id]/images/upload
 * Handle image upload for a product.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication session required." },
        { status: 401 }
      );
    }

    const { isUserAdmin } = await import("@/lib/admin/auth-check");
    const isAdmin = isUserAdmin(user);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Star Press administrative privileges required." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const altText = (formData.get("altText") as string) || "Product Image";
    const isPrimary = formData.get("isPrimary") === "true";

    const newImages: any[] = [];

    if (!files || files.length === 0) {
      const directUrl = formData.get("imageUrl") as string;
      if (directUrl) {
        newImages.push({
          id: `img-${Date.now()}`,
          url: directUrl,
          altText,
          isPrimary,
          position: 0,
        });
      } else {
        return NextResponse.json(
          { error: "No image file or URL provided." },
          { status: 400 }
        );
      }
    } else {
      const { verifyImageMagicBytes } = await import("@/lib/supabase/storage");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: 5 MB` },
            { status: 400 }
          );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Verify magic bytes
        const magic = verifyImageMagicBytes(buffer);
        if (!magic.valid || !magic.mimeType) {
          return NextResponse.json(
            { error: magic.error || "Magic byte verification failed: invalid image format." },
            { status: 400 }
          );
        }

        const mimeType = magic.mimeType;
        const base64Data = `data:${mimeType};base64,${buffer.toString("base64")}`;

        newImages.push({
          id: `img-${Date.now()}-${i}`,
          url: base64Data,
          altText: `${altText} ${i + 1}`,
          fileSize: file.size,
          isPrimary: i === 0 && isPrimary,
          position: i,
        });
      }
    }

    // Try Prisma DB create if possible
    for (const img of newImages) {
      try {
        await db.productImage.create({
          data: {
            productId: params.id,
            url: img.url,
            altText: img.altText,
            isPrimary: img.isPrimary,
            position: img.position,
          },
        });
      } catch {}
    }

    // Always persist to persistentStore so images show up everywhere immediately
    const existing = await getAdminProductById(params.id);
    const existingImages = existing?.images || [];
    const allImages = [...existingImages, ...newImages];

    persistentStore.saveProductOverride(params.id, { images: allImages });
    if (existing?.slug) {
      persistentStore.saveProductOverride(existing.slug, { images: allImages });
    }

    // Also update custom product if this was a custom product
    const custom = persistentStore.getCustomProducts().find((c) => c.id === params.id || c.slug === params.id);
    if (custom) {
      persistentStore.saveCustomProduct({ ...custom, images: allImages });
    }

    return NextResponse.json({
      success: true,
      images: newImages,
    });
  } catch (error: any) {
    console.error("API image upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image." },
      { status: 500 }
    );
  }
}
