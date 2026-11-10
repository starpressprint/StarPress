
import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { CatalogProduct } from "@/lib/catalog";
import { getLiveCatalogProducts } from "@/server/products";
import ProductCard from "@/components/ui/ProductCard";

interface BestSellersProps {
  products?: CatalogProduct[];
}

export default async function BestSellers({ products }: BestSellersProps = {}) {
  const allProducts = products || (await getLiveCatalogProducts());
  
  // Sort by rating and review count to get best sellers
  const bestSellers = allProducts
    .sort((a: CatalogProduct, b: CatalogProduct) => ((b.rating || 5) * (b.reviewCount || 1)) - ((a.rating || 5) * (a.reviewCount || 1)))
    .slice(0, 6)
    .map((p: CatalogProduct) => ({
      id: p.id,
      name: p.name,
      href: `/shop/${p.slug}`,
      imageSrc: p.images[0] || "/images/hero-composition.jpg",
      price: p.basePrice,
      rating: p.rating || 4.9,
      reviewCount: p.reviewCount || 10
    }));

  return (
    <section className="py-14 md:py-18 relative">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow text-xs font-bold uppercase tracking-wider">
              <TrendingUp size={13} />
              <span>Customer Favorites</span>
            </div>

            <h2 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-text-primary uppercase tracking-tight">
              Best Selling Products
            </h2>

            <p className="text-xs sm:text-sm text-text-secondary max-w-lg leading-relaxed">
              Our highest-rated commercial prints with verified 2400 DPI fidelity, moisture-proof
              packaging, and rapid Pan-India dispatch.
            </p>
          </div>

          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary transition-colors group shrink-0"
          >
            <span>View Full Shop Catalog</span>
            <ArrowRight
              size={15}
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          </Link>
        </div>

        {/* Smart Compact 3×2 Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {bestSellers.map((product: any) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
