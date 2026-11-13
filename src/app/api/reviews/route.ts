import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUser } from "@/lib/auth-resolver";
import { rateLimitDistributed, rateLimitExceededResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    const where: any = {};
    if (productId) {
      where.productId = productId;
    }

    const reviews = await db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        product: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    const formatted = reviews.map((r) => ({
      id: r.id,
      name: r.user?.name || "Verified Customer",
      role: "Customer",
      rating: r.rating,
      quote: r.comment || "",
      productName: r.product?.name || "Custom Print",
      productSlug: r.product?.slug || "",
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      reviews: formatted,
    });
  } catch (error: any) {
    console.error("API /api/reviews GET error:", error);
    return NextResponse.json({ success: true, reviews: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to leave a review." },
        { status: 401 }
      );
    }

    const rl = await rateLimitDistributed(`reviews:create:${user.id}`, 5, 60);
    if (!rl.success) return rateLimitExceededResponse(rl, "Too many reviews. Please wait.");
    const body = await request.json();
    const { productId, rating, comment } = body;

    const numRating = Number(rating);
    if (typeof productId !== "string" || !productId.trim() || productId.length > 200 || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "Valid productId and rating (1 to 5) are required." },
        { status: 400 }
      );
    }

    // Ensure product exists in DB or find by slug/id
    let dbProd = await db.product.findFirst({
      where: { OR: [{ id: productId }, { slug: productId }] },
    });

    if (!dbProd) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Create review
    const review = await db.review.create({
      data: {
        productId: dbProd.id,
        userId: user.id,
        rating: Math.round(numRating),
        comment: comment ? String(comment).trim().slice(0, 1000) : null,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        name: review.user?.name || "Verified Customer",
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("API /api/reviews POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit review." },
      { status: 500 }
    );
  }
}
