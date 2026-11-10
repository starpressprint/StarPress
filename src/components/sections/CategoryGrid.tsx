"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Sparkles, Layers, Compass } from "lucide-react";
import { CatalogCategory, CatalogProduct } from "@/lib/catalog";

export interface CategoryGridProps {
  categories: CatalogCategory[];
  products: CatalogProduct[];
}

export default function CategoryGrid({ categories, products }: CategoryGridProps) {
  // Enriched category data with product stats and starting prices
  const enrichedCategories = useMemo(() => {
    return categories.map((cat, idx) => {
      const prods = products.filter((p) => p.categorySlug === cat.slug);
      const minPrice =
        prods.length > 0 ? Math.min(...prods.map((p) => p.basePrice)) : 199;
      const sampleNames = prods.slice(0, 3).map((p) => p.name);

      return {
        ...cat,
        indexNumber: String(idx + 1).padStart(2, "0"),
        productCount: prods.length,
        startingPrice: minPrice,
        sampleProducts: sampleNames,
        href: `/shop?category=${cat.slug}`,
      };
    });
  }, [categories, products]);

  // Desktop active expanded card (default to first category)
  const [activeId, setActiveId] = useState<string>(enrichedCategories[0]?.id || "cat-1");

  return (
    <section className="py-16 md:py-24 relative overflow-hidden bg-bg-base">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 md:mb-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-slate-200/80 dark:border-border-subtle bg-white dark:bg-bg-surface-alt text-slate-700 dark:text-text-secondary text-xs font-semibold uppercase tracking-wider shadow-2xs">
              <Sparkles size={13} className="text-[#F5BA13]" />
              <span>Interactive Collection Rail</span>
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white uppercase tracking-tight">
              Shop by Category
            </h2>

            <p className="text-sm sm:text-base text-slate-500 dark:text-text-secondary max-w-xl leading-relaxed">
              Hover over any print collection to expand full specifications, sample items,
              and live volume tier pricing.
            </p>
          </div>

          <Link
            href="/categories"
            className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-text-secondary hover:text-slate-950 dark:hover:text-white bg-white dark:bg-bg-surface-alt hover:bg-slate-50 dark:hover:bg-border-subtle border border-slate-200/80 dark:border-border-subtle hover:border-[#F5BA13] transition-all group shrink-0 shadow-2xs"
          >
            <span>View All Categories</span>
            <ArrowRight
              size={15}
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          </Link>
        </div>

        {/* 1. DESKTOP ACCORDION COLLECTION RAIL (Hidden on mobile/tablet) */}
        <div
          className="hidden lg:block w-full rounded-[32px] sm:rounded-[36px] border border-slate-200/80 dark:border-border-subtle bg-white dark:bg-bg-surface p-5 sm:p-6 lg:p-7 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-2xl relative overflow-hidden"
          onMouseLeave={() => setActiveId(enrichedCategories[0]?.id || "cat-1")}
        >
          <div className="flex gap-3 xl:gap-3.5 h-[500px] xl:h-[520px] w-full items-stretch">
            {enrichedCategories.map((cat) => {
              const isExpanded = activeId === cat.id;
              const sampleText =
                cat.sampleProducts && cat.sampleProducts.length > 0
                  ? `• ${cat.sampleProducts.join(" • ")}`
                  : `• ${cat.tagline}`;

              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  onMouseEnter={() => setActiveId(cat.id)}
                  onFocus={() => setActiveId(cat.id)}
                  className={`group relative rounded-[24px] overflow-hidden cursor-pointer select-none transition-[flex,transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between ${
                    isExpanded
                      ? "flex-[3.6] min-w-[340px] border-2 border-[#F5BA13] bg-white dark:bg-[#1A1D27] p-3 sm:p-3.5 shadow-sm"
                      : "flex-1 min-w-[65px] max-w-[100px] border border-slate-200/80 dark:border-border-subtle bg-white dark:bg-[#1A1D27] hover:border-slate-300 dark:hover:border-border-strong hover:shadow-2xs"
                  }`}
                  style={{
                    willChange: "flex",
                  }}
                >
                  {isExpanded ? (
                    /* EXPANDED ACTIVE CARD (Matching reference image) */
                    <div className="h-full w-full flex flex-col justify-between animate-fadeIn">
                      {/* Top Inset Image Box */}
                      <div className="relative w-full h-[255px] xl:h-[265px] rounded-[18px] overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={cat.imageUrl}
                          alt={cat.name}
                          fill
                          sizes="(max-width: 1280px) 420px, 480px"
                          quality={85}
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />

                        {/* Top-Left Category Index Badge */}
                        <div className="absolute top-3 left-3 z-10">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#F5BA13] text-slate-950 shadow-xs">
                            {cat.indexNumber}
                          </span>
                        </div>

                        {/* Top-Right Products Count Pill */}
                        <div className="absolute top-3 right-3 z-10">
                          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-1">
                            {cat.productCount} {cat.productCount === 1 ? "Product" : "Products"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom White/Ivory Content Box */}
                      <div className="flex-1 flex flex-col justify-between pt-3.5 pb-1 px-1 sm:px-1.5">
                        <div>
                          {/* Sample Products Tagline Row */}
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-xs font-bold text-[#F5BA13] tracking-wide truncate">
                              {sampleText}
                            </span>
                          </div>

                          {/* Main Title */}
                          <h3 className="font-display font-black text-2xl xl:text-3xl text-slate-900 dark:text-white uppercase tracking-tight leading-tight mt-1">
                            {cat.name}
                          </h3>

                          {/* Tagline / Description */}
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-1 xl:line-clamp-2 mt-1 leading-relaxed">
                            {cat.tagline || cat.description}
                          </p>
                        </div>

                        {/* Starting Price & Explore CTA Row */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 mt-3">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                              Starting from
                            </span>
                            <div className="font-display font-black text-2xl xl:text-3xl text-[#F5BA13] leading-none mt-0.5">
                              ₹{cat.startingPrice.toLocaleString("en-IN")}
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-1 px-4.5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-slate-950 bg-[#F5BA13] hover:bg-[#E5AC0E] active:scale-[0.98] transition-all shadow-xs shrink-0">
                            <span>Explore Line</span>
                            <ArrowUpRight size={15} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* COLLAPSED INACTIVE CARD (Matching reference image) */
                    <div className="relative h-full w-full overflow-hidden flex flex-col justify-between p-3 select-none">
                      {/* Background Image with Bottom Smooth Fade */}
                      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={cat.imageUrl}
                          alt={cat.name}
                          fill
                          sizes="140px"
                          quality={75}
                          className="object-cover object-top opacity-90 transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Soft ivory/white gradient overlay from bottom */}
                        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-[#1A1D27] dark:via-[#1A1D27]/85 dark:to-transparent pointer-events-none" />
                      </div>

                      {/* Top Centered Category Number Badge */}
                      <div className="relative z-10 flex justify-center pt-1">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800 shadow-xs">
                          {cat.indexNumber}
                        </span>
                      </div>

                      {/* Bottom Vertical Label & Vibrant Colored Dot */}
                      <div className="relative z-10 pb-2 flex flex-col items-center justify-end gap-2.5 mt-auto">
                        <span
                          className="font-display font-bold text-[11px] sm:text-xs text-slate-800 dark:text-slate-200 tracking-wider uppercase whitespace-nowrap [writing-mode:vertical-rl] select-none transition-colors group-hover:text-slate-950 dark:group-hover:text-white"
                        >
                          {cat.name}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-125"
                          style={{ backgroundColor: cat.accentColor || "#F5BA13" }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 2. MOBILE & TABLET HORIZONTAL SWIPE RAIL (< lg) */}
        <div className="lg:hidden">
          <div
            className="flex gap-3.5 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory py-4 -mx-4 xs:-mx-6 px-4 xs:px-6 no-scrollbar overscroll-x-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {enrichedCategories.map((cat) => {
              const sampleText =
                cat.sampleProducts && cat.sampleProducts.length > 0
                  ? `• ${cat.sampleProducts.join(" • ")}`
                  : `• ${cat.tagline}`;

              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="relative w-[min(290px,78vw)] sm:w-[320px] h-[460px] shrink-0 snap-center rounded-[24px] border border-slate-200/80 dark:border-border-subtle hover:border-[#F5BA13] bg-white dark:bg-[#1A1D27] p-3.5 flex flex-col justify-between select-none shadow-md active:scale-[0.98] transition-all"
                >
                  {/* Top Inset Image */}
                  <div className="relative w-full h-[240px] rounded-[18px] overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                    <Image
                      src={cat.imageUrl}
                      alt={cat.name}
                      fill
                      sizes="330px"
                      quality={75}
                      className="object-cover"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#F5BA13] text-slate-950 shadow-xs">
                        {cat.indexNumber}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 z-10">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-md text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 shadow-xs">
                        {cat.productCount} {cat.productCount === 1 ? "Product" : "Products"}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Content */}
                  <div className="flex-1 flex flex-col justify-between pt-3 pb-1 px-1">
                    <div>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-xs font-bold text-[#F5BA13] tracking-wide truncate">
                          {sampleText}
                        </span>
                      </div>

                      <h3 className="font-display font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight leading-tight mt-1">
                        {cat.name}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 mt-1 leading-relaxed">
                        {cat.tagline || cat.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                          Starting from
                        </span>
                        <div className="font-display font-black text-xl text-[#F5BA13]">
                          ₹{cat.startingPrice.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold text-slate-950 bg-[#F5BA13]">
                        <span>Explore Line</span>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-slate-400">
            <Compass size={13} className="text-[#F5BA13] animate-pulse" />
            <span>Swipe horizontally to explore all 8 print categories</span>
          </div>
        </div>
      </div>
    </section>
  );
}
