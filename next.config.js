const { execSync } = require("child_process");

if (!process.env.__PRISMA_GEN_DONE) {
  process.env.__PRISMA_GEN_DONE = "1";
  try {
    // Ensure Prisma client is always generated before Next.js builds on Vercel/CI
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/dummy?schema=public";
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch (e) {
    console.warn("Prisma generation notice:", e);
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imfehlnarkbclnplhvuz.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/**",
      },
    ],
  },
  /**
   * Subdomain Multi-Tenancy Architecture (admin.starpress.com):
   * Dynamic subdomain rewrites are processed at the Edge in `src/middleware.ts`.
   * When rewriting hostnames (`admin.starpress.com` -> `/admin/orders`),
   * `NextResponse.rewrite()` strictly preserves URL query parameters (`searchParams`)
   * and copies `@supabase/ssr` chunked session cookies directly to avoid dropped sessions.
   */
  async rewrites() {
    return [
      {
        source: "/images/slider/:path*",
        destination: "/images/Slider/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://api.razorpay.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com https://*.supabase.co wss://*.supabase.co",
              "img-src 'self' data: blob: https://*.supabase.co https://*.razorpay.com https://*.cloudinary.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/payments/razorpay/webhook",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
