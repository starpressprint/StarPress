import React from "react";
import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Permanent_Marker } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/providers/AppProviders";
import JsonLd from "@/components/seo/JsonLd";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-marker",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.starpress.in"),
  title: {
    default: "Star Press | Best Printing Press in Khatima, Uttarakhand",
    template: "%s | Star Press Khatima",
  },
  description:
    "Star Press (Amoun, Khatima, Uttarakhand) — Premier commercial printing press and custom fabrication hub. Visiting cards, 3D letter boards, LED name plates, neon signs, vinyl banners, stickers, packaging, and corporate merchandise with fast Pan-India delivery.",
  keywords: [
    "Star Press",
    "Star Press Khatima",
    "Star Printing Press Khatima",
    "printing press in Khatima",
    "printing press Khatima Uttarakhand",
    "visiting card printing Khatima",
    "flex banner Khatima",
    "neon board Khatima",
    "3d letter board Khatima",
    "LED name plates Khatima",
    "custom printing Khatima",
    "printing press Udham Singh Nagar",
    "custom printing Uttarakhand",
    "commercial printing India",
    "packaging boxes Khatima",
  ],
  authors: [{ name: "Star Press", url: "https://www.starpress.in" }],
  creator: "Star Press",
  publisher: "Star Press",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/images/Logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/images/Logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.starpress.in",
    siteName: "Star Press Khatima",
    title: "Star Press | Best Printing Press in Khatima, Uttarakhand",
    description:
      "Star Press (Amoun, Khatima) — Top rated printing press for visiting cards, banners, 3D signs, neon boards, LED name plates, and custom printing. Delivery across Uttarakhand & India.",
    images: [
      {
        url: "/images/hero-composition.jpg",
        width: 1200,
        height: 630,
        alt: "Star Press — Best Printing Press in Khatima, Uttarakhand",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Star Press | Best Printing Press in Khatima, Uttarakhand",
    description:
      "Premier custom printing press in Khatima, Uttarakhand. Business cards, flex banners, 3D boards, neon signs, and merchandise.",
    images: ["/images/hero-composition.jpg"],
    creator: "@starpress",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "google-site-verification-token",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${permanentMarker.variable}`}
    >
      <head>
        <JsonLd />
      </head>
      <body className="bg-bg-base text-text-primary font-sans antialiased selection:bg-brand-yellow selection:text-black min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
