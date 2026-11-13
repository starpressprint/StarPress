"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";

export interface Slide {
  src: string;
  alt: string;
  badge: string;
  headline: string[];
  highlightIndex: number; // which line to colour with brand-yellow
  sub: string;
  cta: { label: string; href: string };
}

const defaultSlides: Slide[] = [
  {
    src: "/images/Slider/NamePlates.jpeg",
    alt: "LED Name Plates custom printing by Star Press",
    badge: "Illuminated Signage",
    headline: ["LIGHT UP YOUR", "BRAND IDENTITY"],
    highlightIndex: 1,
    sub: "Premium name plates for offices, homes & showrooms. Custom colours, shapes & sizes available.",
    cta: { label: "Explore Name Plates", href: "/shop/name-plates" },
  },
  {
    src: "/images/Slider/NeonBoards.jpeg",
    alt: "Neon Boards custom printing by Star Press",
    badge: "Neon & Glow Signs",
    headline: ["GLOW DIFFERENT,", "GLOW BOLD"],
    highlightIndex: 1,
    sub: "Eye-catching neon boards for cafes, studios & events. Bring vibrant energy to any space.",
    cta: { label: "Explore Neon Boards", href: "/shop/neon-boards" },
  },
  {
    src: "/images/Slider/3dBoards.jpeg",
    alt: "3D Letter Board custom printing by Star Press",
    badge: "Signage & Displays",
    headline: ["STAND OUT WITH", "3D LETTER BOARDS"],
    highlightIndex: 1,
    sub: "Dimensional letters that demand attention. Perfect for retail, events & corporate spaces.",
    cta: { label: "Explore 3D Letter Boards", href: "/shop/3d-letter-board" },
  },
];

const AUTOPLAY_MS = 5000;

interface HeroProps {
  slides?: Slide[];
}

export default function Hero({ slides: propSlides }: HeroProps) {
  // Normalize and sanitize slide data to prevent any runtime crashes or broken image states
  const rawSlides = propSlides && propSlides.length > 0 ? propSlides : defaultSlides;
  const validSlides = rawSlides
    .filter((s) => s && typeof s === 'object')
    .map((s, idx) => {
      const normalizedSrc = s.src
        ? s.src.replace(/^\/images\/slider\//i, '/images/Slider/')
        : defaultSlides[idx % defaultSlides.length]?.src || '/images/Slider/NamePlates.jpeg';

      const headlineArray = Array.isArray(s.headline)
        ? s.headline
        : typeof s.headline === 'string'
        ? [s.headline]
        : ['PREMIUM', 'PRINTING'];

      return {
        src: normalizedSrc,
        alt: s.alt || 'Star Press Printing Banner',
        badge: s.badge || 'Featured Products',
        headline: headlineArray,
        highlightIndex: typeof s.highlightIndex === 'number' ? s.highlightIndex : 1,
        sub: typeof s.sub === 'string' ? s.sub : 'Premium commercial printing delivered with perfection.',
        cta: s.cta && s.cta.label && s.cta.href ? s.cta : { label: 'Explore Products', href: '/shop' },
      };
    });

  const slides = validSlides.length > 0 ? validSlides : defaultSlides;
  const [current, setCurrent] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  // Touch swipe support for native mobile feel
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Navigate to next slide
  const handleNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  // Navigate to previous slide
  const handlePrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Directly select slide on dot click
  const handleSelect = useCallback((index: number) => {
    setCurrent((prev) => {
      if (index === prev) return prev;
      return index;
    });
  }, []);

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  // Continuous uninterrupted autoplay
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);

    return () => clearTimeout(timer);
  }, [current, slides.length]);

  const slide = slides[current];

  return (
    <>
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroProgressFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .hs-content    { animation: heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .hs-content-d1 { animation-delay: 0.03s; }
        .hs-content-d2 { animation-delay: 0.08s; }
        .hs-content-d3 { animation-delay: 0.14s; }
        .hs-content-d4 { animation-delay: 0.20s; }
        .hs-progress-active {
          animation: heroProgressFill ${AUTOPLAY_MS}ms linear forwards;
        }
      `}</style>

      <section
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full overflow-hidden select-none min-h-[580px] xs:min-h-[620px] sm:min-h-[680px] lg:min-h-[85vh] lg:max-h-[860px] flex items-center"
      >
        {/* ── Background Slide Images (Smooth crossfade & scale) ── */}
        {slides.map((s, index) => {
          const isActive = index === current;
          return (
            <div
              key={`${s.src}-${index}`}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <div
                className={`relative w-full h-full transform transition-transform duration-1000 ease-out ${
                  isActive ? "scale-100" : "scale-105"
                }`}
              >
                {!failedImages[index] ? (
                  <Image
                    src={s.src}
                    alt={s.alt}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover object-center"
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [index]: true }));
                    }}
                  />
                ) : (
                  <Image
                    src={defaultSlides[index % defaultSlides.length]?.src || "/images/Slider/NamePlates.jpeg"}
                    alt={s.alt}
                    fill
                    sizes="100vw"
                    className="object-cover object-center"
                  />
                )}
              </div>

              {/* Mobile vertical vignette for text legibility */}
              <div
                className="absolute inset-0 md:hidden"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(10,10,15,0.65) 0%, rgba(10,10,15,0.4) 40%, rgba(10,10,15,0.85) 100%)",
                }}
              />

              {/* Desktop left-focused subtle dark gradient so the product image remains the hero */}
              <div
                className="hidden md:block absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(10,10,15,0.82) 0%, rgba(10,10,15,0.62) 34%, rgba(10,10,15,0.2) 62%, transparent 100%)",
                }}
              />

              {/* Top subtle vignette for header bar readability */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(10,10,15,0.65) 0%, transparent 22%)",
                }}
              />

              {/* Bottom vignette blending seamlessly into the next page section */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(0deg, #0B0C10 0%, rgba(11,12,16,0.6) 12%, transparent 30%)",
                }}
              />
            </div>
          );
        })}

        {/* ── Simple, Clean, Left-Aligned Hero Content Block ── */}
        <div className="relative z-20 w-full max-w-[1400px] mx-auto px-4 xs:px-6 sm:px-10 lg:px-16 xl:px-20 pt-24 pb-20 sm:pt-28 sm:pb-24 lg:pt-32 lg:pb-28">
          <div key={`content-${current}`} className="max-w-[560px] w-full">
            {/* Small Category Label (clean text, no heavy borders or icons) */}
            <div className="hs-content hs-content-d1 text-xs sm:text-[13px] font-semibold tracking-wider uppercase text-brand-yellow mb-2.5 sm:mb-3">
              {slide.badge}
            </div>

            {/* 1–2 Line Strong Headline (Clear, readable, properly proportioned) */}
            <h1 className="hs-content hs-content-d2 font-display font-extrabold text-2xl xs:text-3xl sm:text-5xl lg:text-[50px] leading-[1.12] tracking-tight uppercase mb-3.5 sm:mb-4 text-white break-words">
              {slide.headline.map((line, i) => (
                <span
                  key={i}
                  className={`block ${
                    i === slide.highlightIndex
                      ? "text-brand-yellow"
                      : "text-white"
                  }`}
                >
                  {line}
                </span>
              ))}
            </h1>

            {/* Short Supporting Sentence */}
            <p className="hs-content hs-content-d3 text-sm sm:text-base text-slate-200/90 leading-relaxed mb-6 sm:mb-8 max-w-lg">
              {slide.sub.replace(/\n/g, " ")}
            </p>

            {/* One Primary CTA Button */}
            <div className="hs-content hs-content-d4">
              <Button
                variant="primary"
                size="md"
                href={slide.cta.href}
                className="inline-flex items-center gap-2 rounded-full !px-6 sm:!px-7 !py-3 !text-sm font-bold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-all shadow-md"
              >
                <span>{slide.cta.label}</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Minimal Navigation Arrows ── */}
        <button
          onClick={handlePrev}
          aria-label="Previous slide"
          className="hidden md:flex absolute left-4 lg:left-7 top-1/2 -translate-y-1/2 z-30 items-center justify-center w-10 h-10 rounded-full bg-black/30 hover:bg-black/60 border border-white/10 text-white/80 hover:text-white transition-all duration-200 backdrop-blur-sm cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={handleNext}
          aria-label="Next slide"
          className="hidden md:flex absolute right-4 lg:right-7 top-1/2 -translate-y-1/2 z-30 items-center justify-center w-10 h-10 rounded-full bg-black/30 hover:bg-black/60 border border-white/10 text-white/80 hover:text-white transition-all duration-200 backdrop-blur-sm cursor-pointer"
        >
          <ChevronRight size={20} />
        </button>

        {/* ── Subtle Bottom Pagination ── */}
        <div className="absolute bottom-5 sm:bottom-7 inset-x-0 z-30 flex items-center justify-between px-4 xs:px-6 sm:px-10 lg:px-16 xl:px-20 max-w-[1400px] mx-auto pointer-events-none">
          {/* Subtle Dots */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                className="relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
              >
                {i === current ? (
                  <span className="relative block w-7 sm:w-9 h-1.5 rounded-full bg-white/25 overflow-hidden">
                    <span
                      key={`bar-${current}`}
                      className="absolute inset-y-0 left-0 bg-brand-yellow rounded-full hs-progress-active"
                    />
                  </span>
                ) : (
                  <span className="block w-2 h-1.5 rounded-full bg-white/30 hover:bg-white/60 transition-colors duration-200" />
                )}
              </button>
            ))}
          </div>

          {/* Minimal Slide Counter */}
          <div className="pointer-events-auto text-[11px] sm:text-xs text-white/60 font-mono tabular-nums px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 select-none">
            {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </div>
        </div>
      </section>
    </>
  );
}
