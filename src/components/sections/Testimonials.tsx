import React from "react";
import { db } from "@/lib/db";
import StarRating from "@/components/ui/StarRating";
import { MessageSquarePlus, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function Testimonials() {
  let reviews: any[] = [];
  let loadFailed = false;
  try {
    reviews = await db.review.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
        product: { select: { name: true, slug: true } },
      },
    });
  } catch (e) {
    loadFailed = true;
    reviews = [];
  }

  const displayItems = reviews.map((r) => ({
    id: r.id,
    name: r.user?.name || "Customer",
    role: "Customer",
    rating: r.rating,
    quote: r.comment || "",
    productName: r.product?.name,
    productSlug: r.product?.slug,
  }));

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 md:mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3">
              <CheckCircle2 size={13} />
              <span>Customer Feedback</span>
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
              What Our Clients Say
            </h2>
          </div>
          <Link
            href="/shop"
            className="text-xs font-semibold text-brand-yellow hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Explore Catalog & Reviews</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {displayItems.length === 0 && (
          <p className="text-sm text-text-secondary">
            {loadFailed ? "Customer reviews are temporarily unavailable." : "No customer reviews yet."}
          </p>
        )}
        {/* Testimonial Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayItems.slice(0, 3).map((item) => {
            const initial = item.name.charAt(0).toUpperCase();
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between bg-bg-surface rounded-2xl border border-border-subtle p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-black/40"
              >
                <div>
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F5A623] to-[#e08600] text-black font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {initial}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-text-secondary flex items-center gap-1">
                        <span>{item.role}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <StarRating rating={item.rating} showValue={false} />
                  </div>

                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-normal">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>

                {item.productName && item.productSlug && (
                  <div className="mt-5 pt-3 border-t border-border-subtle">
                    <Link
                      href={`/shop/${item.productSlug}`}
                      className="text-[11px] text-slate-400 hover:text-brand-yellow transition-colors truncate block"
                    >
                      Reviewed: <span className="font-medium text-slate-300">{item.productName}</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
