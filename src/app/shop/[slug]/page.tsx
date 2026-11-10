import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import StarRating from "@/components/ui/StarRating";
import ProductGallery from "@/components/shop/ProductGallery";
import ProductConfigurator from "@/components/shop/ProductConfigurator";
import ProductTabs from "@/components/shop/ProductTabs";
import CatalogProductCard from "@/components/shop/CatalogProductCard";
import {
  PRODUCT_SLUG_ALIASES,
  getCategoryRedirect,
} from "@/lib/catalog";
import {
  getLiveCatalogProducts,
  getLiveProductBySlug,
  getLiveProductsByCategory,
} from "@/server/products";

export const revalidate = 300; // 5-minute ISR cache
export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getLiveCatalogProducts();
  return products.map((product: any) => ({
    slug: product.slug,
  }));
}

interface PageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in").replace(/\/$/, "");
  const product = await getLiveProductBySlug(params.slug);
  if (!product) {
    const cat = getCategoryRedirect(params.slug);
    if (cat) {
      return {
        title: "Category Catalog | Star Press",
      };
    }
    return {
      title: "Product Not Found | Star Press",
    };
  }

  return {
    title: `${product.name} — Custom Printing & Pricing`,
    description: `${product.shortDescription} Manufactured at Star Press Khatima, Uttarakhand with quick doorstep delivery.`,
    alternates: {
      canonical: `/shop/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} | Star Press Khatima`,
      description: product.shortDescription,
      url: `/shop/${product.slug}`,
      images: [
        {
          url: product.images[0] || "/images/hero-composition.jpg",
          width: 800,
          height: 600,
          alt: `${product.name} - Star Press Khatima`,
        },
      ],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in").replace(/\/$/, "");

  // If the user entered a category slug in /shop/[slug], redirect to the category filter
  const categoryRedirect = getCategoryRedirect(params.slug);
  if (categoryRedirect) {
    redirect(`/shop?category=${categoryRedirect}`);
  }

  const product = await getLiveProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  // Related products from the same category
  const relatedProducts = (await getLiveProductsByCategory(product.categorySlug))
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  // Structured Data (JSON-LD) for Google Rich Results
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images.length > 0 ? product.images : [`${baseUrl}/images/hero-composition.jpg`],
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "Star Press",
    },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/shop/${product.slug}`,
      priceCurrency: "INR",
      price: product.basePrice,
      availability:
        product.stockQuantity !== undefined && product.stockQuantity <= 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Star Press",
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating || 5,
      reviewCount: product.reviewCount || 1,
      bestRating: 5,
      worstRating: 1,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${baseUrl}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.categoryName,
        item: `${baseUrl}/shop?category=${product.categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.name,
        item: `${baseUrl}/shop/${product.slug}`,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      {/* Google Rich Snippets JSON-LD Scripts */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-6 sm:py-8 md:py-12">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs text-text-muted mb-6 sm:mb-8 overflow-x-auto whitespace-nowrap no-scrollbar overscroll-x-contain py-1"
        >
          <Link href="/" className="hover:text-text-primary transition-colors">
            Home
          </Link>
          <ChevronRight size={13} />
          <Link href="/shop" className="hover:text-text-primary transition-colors">
            Shop
          </Link>
          <ChevronRight size={13} />
          <Link
            href={`/shop?category=${product.categorySlug}`}
            className="hover:text-text-primary transition-colors"
          >
            {product.categoryName}
          </Link>
          <ChevronRight size={13} />
          <span className="text-text-primary font-medium truncate">{product.name}</span>
        </nav>

        {/* 2-Column Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-14 items-start">
          {/* Left Column: Gallery & Title */}
          <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-28">
            <ProductGallery images={product.images} productName={product.name} />

              <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-bg-surface-alt border border-border-subtle text-text-secondary uppercase tracking-wider">
                  {product.categoryName}
                </span>
                <StarRating rating={product.rating} reviewCount={product.reviewCount} />
              </div>

              <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-text-primary uppercase tracking-tight leading-[1.1] break-words">
                {product.name}
              </h1>

              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {product.shortDescription}
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Multi-Attribute Price Configurator */}
          <div className="lg:col-span-6">
            <ProductConfigurator product={product} />
          </div>
        </div>

        {/* Detailed Information Tabs */}
        <ProductTabs product={product} />

        {/* Related Products Recommendation */}
        {relatedProducts.length > 0 && (
          <div className="mt-20 pt-12 border-t border-border-subtle space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-2xl text-text-primary tracking-tight">
                  Related in {product.categoryName}
                </h3>
                <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Customers ordering this item also frequently print these formats.
                </p>
              </div>

              <Link
                href={`/shop?category=${product.categorySlug}`}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                <span>View all category items</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relProduct) => (
                <CatalogProductCard key={relProduct.id} product={relProduct} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
