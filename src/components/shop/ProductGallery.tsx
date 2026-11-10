"use client";

import React, { useState } from "react";
import Image from "next/image";

export interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const displayImages = images.length > 0 ? images : ["/images/hero-composition.jpg"];
  const currentImage = displayImages[activeImageIndex] || displayImages[0];

  return (
    <div className="space-y-4">
      {/* Main Large Image Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden bg-bg-surface-alt border border-border-subtle shadow-2xl group">
        <Image
          src={currentImage}
          alt={`${productName} view ${activeImageIndex + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Thumbnails Strip */}
      {displayImages.length > 1 && (
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain">
          {displayImages.map((img, idx) => {
            const isActive = idx === activeImageIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-bg-surface-alt border-2 transition-all shrink-0 ${
                  isActive
                    ? "border-brand-yellow shadow-md shadow-brand-yellow/20 scale-105"
                    : "border-border-subtle hover:border-white/40 opacity-70 hover:opacity-100"
                }`}
              >
                <Image
                  src={img}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
