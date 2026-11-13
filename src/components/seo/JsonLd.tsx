import React from "react";

export default function JsonLd() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in").replace(/\/$/, "");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": "Star Press",
        "url": baseUrl,
        "logo": {
          "@type": "ImageObject",
          "url": `${baseUrl}/images/hero-composition.jpg`,
          "width": 1200,
          "height": 630,
        },
        "description":
          "Star Press is a premier custom printing service in Khatima, Uttarakhand specializing in business cards, flyers, banners, stickers, packaging, 3D letter signs, and corporate merchandise.",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+91-74568-49955",
          "contactType": "customer service",
          "areaServed": "IN",
          "availableLanguage": ["English", "Hindi"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        "url": baseUrl,
        "name": "Star Press",
        "description": "Turning Ideas Into Print — High Quality Custom Printing Khatima",
        "publisher": {
          "@id": `${baseUrl}/#organization`,
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${baseUrl}/shop?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": ["LocalBusiness", "PrintShop"],
        "@id": `${baseUrl}/#localbusiness`,
        "name": "Star Press",
        "alternateName": [
          "Star Press Khatima",
          "Star Printing Press Khatima",
          "Star Press Print Hub",
          "Star Press Amoun"
        ],
        "image": `${baseUrl}/images/hero-composition.jpg`,
        "logo": `${baseUrl}/images/Logo.png`,
        "url": baseUrl,
        "telephone": "+91-74568-49955",
        "email": "starpress.print@gmail.com",
        "priceRange": "₹₹",
        "currenciesAccepted": "INR",
        "paymentAccepted": "Cash, UPI, Credit Card, Debit Card, Net Banking",
        "hasMap": "https://maps.google.com/?q=Amoun,+Khatima,+Uttarakhand",
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 28.9197,
          "longitude": 79.9723
        },
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Amoun",
          "addressLocality": "Khatima",
          "addressRegion": "Uttarakhand",
          "postalCode": "262308",
          "addressCountry": "IN"
        },
        "areaServed": [
          {
            "@type": "City",
            "name": "Khatima"
          },
          {
            "@type": "City",
            "name": "Tanakpur"
          },
          {
            "@type": "City",
            "name": "Sitarganj"
          },
          {
            "@type": "City",
            "name": "Banbasa"
          },
          {
            "@type": "AdministrativeArea",
            "name": "Udham Singh Nagar"
          },
          {
            "@type": "AdministrativeArea",
            "name": "Champawat"
          },
          {
            "@type": "AdministrativeArea",
            "name": "Uttarakhand"
          },
          {
            "@type": "Country",
            "name": "India"
          }
        ],
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday"
            ],
            "opens": "09:00",
            "closes": "20:00"
          }
        ]
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}
