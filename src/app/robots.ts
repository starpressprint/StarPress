import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in").replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: ["/api/", "/admin", "/checkout", "/account", "/order-success", "/auth", "/cart", "/orders/track"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
