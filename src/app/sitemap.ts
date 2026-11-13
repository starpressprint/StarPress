import { CatalogProduct } from "@/lib/catalog";
import { MetadataRoute } from "next";
import { getLiveCategories, getLiveCatalogProducts } from "@/server/products";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in").replace(/\/$/, "");
  const now = new Date();

  // Core static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/custom-printing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/bulk-orders`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cancellation-refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/shipping-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Category filter pages
  const categories = await getLiveCategories();
  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/shop?category=${cat.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Dynamic product detail pages
  const products = await getLiveCatalogProducts();
  const productRoutes: MetadataRoute.Sitemap = products.map((prod: CatalogProduct) => ({
    url: `${baseUrl}/shop/${prod.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: prod.isFeatured || prod.isBestSeller ? 0.9 : 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
