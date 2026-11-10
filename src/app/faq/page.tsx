"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Truck,
  Printer,
  FileCheck,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  // Category 1: Artwork & Pre-Press Guidelines
  {
    id: "art-1",
    category: "Artwork & Design Files",
    question: "What file formats do you accept for custom printing?",
    answer:
      "We accept vector PDF (.pdf), Adobe Illustrator (.ai), Photoshop (.psd), CorelDraw (.cdr), SVG, and high-resolution uncompressed TIFF or PNG. For maximum sharpness and crisp typography, vector PDF with all fonts converted to curves/outlines is our top recommendation.",
  },
  {
    id: "art-2",
    category: "Artwork & Design Files",
    question: "Why should my files be in CMYK instead of RGB?",
    answer:
      "Computer monitors emit light in RGB (Red, Green, Blue), whereas physical printing presses lay physical pigments in CMYK (Cyan, Magenta, Yellow, Key Black). Colors designed in RGB may appear up to 15% darker or shift in saturation when printed. We recommend designing directly in CMYK (FOGRA39 or Coated GRACoL profile) to guarantee color accuracy.",
  },
  {
    id: "art-3",
    category: "Artwork & Design Files",
    question: "What are bleed and safety margin lines?",
    answer:
      "Bleed is the extra 3mm (0.125 inches) of artwork that extends beyond the actual cut line of your document. Because industrial guillotines cut stacks of hundreds of sheets at once with slight mechanical movement, bleed prevents unsightly white hairline borders. Keep all critical logos, text, and graphics at least 4mm inside the trim line (safe zone).",
  },
  {
    id: "art-4",
    category: "Artwork & Design Files",
    question: "What resolution must my images have?",
    answer:
      "All raster images and photos must be at least 300 DPI (dots per inch) at 100% final physical print size. Images downloaded from WhatsApp or web pages are typically 72 DPI and will look pixelated or blurry when printed on commercial presses.",
  },

  // Category 2: Turnaround & Production Times
  {
    id: "prod-1",
    category: "Production & Turnaround",
    question: "How long does standard printing take?",
    answer:
      "Standard commercial production takes 2 to 4 business days depending on finishing options (e.g. Spot UV, thermal matte lamination, and foiling require 24 hours of curing). Once dispatched, courier transit takes 1 to 4 business days depending on your delivery PIN code.",
  },
  {
    id: "prod-2",
    category: "Production & Turnaround",
    question: "Do you offer 24-hour rush dispatch?",
    answer:
      "Yes! You can select 'Priority 24h Rush' at checkout. For orders approved before our daily 2:00 PM IST cutoff, your job skips to the front of our digital HP Indigo press queue and dispatches within 24 to 48 hours via express air courier.",
  },
  {
    id: "prod-3",
    category: "Production & Turnaround",
    question: "Will I get to see a proof before mass printing starts?",
    answer:
      "Always. For every order with uploaded custom artwork, our human prepress department generates a digital soft proof and sends it via WhatsApp and Email. We only start production after receiving your explicit approval.",
  },

  // Category 3: Pan-India Shipping & Packaging
  {
    id: "ship-1",
    category: "Shipping & Delivery",
    question: "Where do you ship across India?",
    answer:
      "We ship to 26,000+ PIN codes across all Indian states and Union Territories via premier express logistics partners including Blue Dart, Delhivery, and DTDC. Orders above ₹999 qualify for Free Pan-India Standard Shipping.",
  },
  {
    id: "ship-2",
    category: "Shipping & Delivery",
    question: "How do you package sensitive paper goods?",
    answer:
      "We take packaging seriously. All business cards, brochures, and flyers are shrink-wrapped in moisture-proof polypropylene plastic, surrounded with bubble wrap, and packed into heavy 5-ply corrugated shipper boxes with edge corner guards to prevent transit dents.",
  },
  {
    id: "ship-3",
    category: "Shipping & Delivery",
    question: "How do I track my dispatched parcel?",
    answer:
      "The instant your order leaves our Khatima printing hub, you receive an automated SMS and WhatsApp message with your direct courier tracking link and AWB number for live milestone tracking.",
  },

  // Category 4: Payments, GST & Invoicing
  {
    id: "pay-1",
    category: "Payments & GST Invoicing",
    question: "What payment methods are supported?",
    answer:
      "We accept all major UPI applications (Google Pay, PhonePe, Paytm), Credit and Debit Cards (Visa, Mastercard, RuPay), NetBanking from 50+ Indian banks, and Pay-After-Proof Approval for verified business accounts.",
  },
  {
    id: "pay-2",
    category: "Payments & GST Invoicing",
    question: "Can I get a GST tax invoice to claim 18% Input Tax Credit?",
    answer:
      "Yes. During checkout, check the 'I need a GST Invoice for my Business' box and enter your 15-character GSTIN and Registered Company Name. Your official tax invoice containing full HSN codes will be emailed automatically upon dispatch.",
  },

  // Category 5: Quality Guarantee & Reprints
  {
    id: "qual-1",
    category: "Quality & Reprint Guarantee",
    question: "What if there is a printing flaw or cutting defect?",
    answer:
      "We back our print quality with a 100% Free Reprint Guarantee. If your order exhibits printing defects, color banding, cut misalignments, or transit damage, photograph the issue and notify us within 48 hours of delivery. We will rush-reprint and reship your entire order at zero cost.",
  },
  {
    id: "qual-2",
    category: "Quality & Reprint Guarantee",
    question: "Can I request physical paper swatches before placing a large order?",
    answer:
      "Absolutely! Visit our Bulk Orders page or contact our team to request a Free Hardcopy Sample Swatch Kit containing textured paper grades, 300/350/400 GSM boards, velvet soft-touch laminates, and foil swatches.",
  },
];

const CATEGORIES = [
  "All Questions",
  "Artwork & Design Files",
  "Production & Turnaround",
  "Shipping & Delivery",
  "Payments & GST Invoicing",
  "Quality & Reprint Guarantee",
];

export default function FAQPage() {
  const [selectedCategory, setSelectedCategory] = useState("All Questions");
  const [searchQuery, setSearchQuery] = useState("");

  // Respond to anchor navigation like #artwork or #shipping
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#artwork") {
        setSelectedCategory("Artwork & Design Files");
      } else if (hash === "#shipping") {
        setSelectedCategory("Shipping & Delivery");
      }
    }
  }, []);

  const filteredFAQs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCat =
        selectedCategory === "All Questions" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Page Hero */}
        <div className="relative rounded-[28px] border border-border-subtle bg-bg-surface p-5 xs:p-7 sm:p-12 mb-8 sm:mb-10 overflow-hidden shadow-xl text-center">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <HelpCircle size={13} className="text-brand-yellow" />
              <span>Knowledge Base & Pre-Press Help</span>
            </div>

            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl uppercase text-text-primary tracking-tight leading-[1.1] break-words">
              Frequently Asked Questions
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Find instant answers to questions regarding file preparation, CMYK bleeds,
              turnaround schedules, GST invoicing, and our quality guarantee.
            </p>

            {/* Live Search Input */}
            <div className="relative max-w-md mx-auto pt-2">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Search bleed, CMYK, GST, courier, rush..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-bg-surface-alt border border-border-subtle pl-11 pr-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none no-scrollbar overscroll-x-contain">
          {CATEGORIES.map((cat) => {
            const anchorId =
              cat === "Artwork & Design Files"
                ? "artwork"
                : cat === "Shipping & Delivery"
                ? "shipping"
                : undefined;
            return (
              <button
                key={cat}
                id={anchorId}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`scroll-mt-28 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-brand-yellow text-black font-bold shadow-md"
                    : "bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-surface-alt"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* FAQ Accordions List */}
        {filteredFAQs.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-12 text-center space-y-3 my-8">
            <HelpCircle size={36} className="text-text-muted mx-auto" />
            <h3 className="font-display font-bold text-lg text-text-primary">
              No matching answers found
            </h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              We couldn&apos;t find any questions matching &ldquo;{searchQuery}&rdquo;. Try another term
              or chat directly with our prepress team.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All Questions");
              }}
              className="text-xs font-bold text-brand-yellow hover:underline"
            >
              Clear Search Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-16">
            {filteredFAQs.map((faq) => (
              <details
                key={faq.id}
                name="starpress-faq"
                className="group rounded-2xl border border-border-subtle bg-bg-surface transition-colors open:border-border-strong overflow-hidden"
              >
                <summary className="p-6 cursor-pointer list-none flex items-center justify-between gap-4 select-none">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {faq.category}
                    </span>
                    <h2 className="font-display font-bold text-base sm:text-lg text-text-primary group-hover:text-brand-yellow transition-colors">
                      {faq.question}
                    </h2>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-bg-surface-alt border border-border-subtle flex items-center justify-center text-text-secondary group-open:rotate-180 group-open:text-brand-yellow transition-transform duration-200 shrink-0">
                    <ChevronDown size={18} />
                  </div>
                </summary>
                <div className="px-6 pb-6 pt-1 text-sm text-text-secondary leading-relaxed border-t border-border-subtle/50">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        )}

        {/* Still Have Questions? Banner */}
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-display font-black text-xl sm:text-2xl text-text-primary uppercase">
              Still Have Questions on Your Print Job?
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary">
              Our pre-flight artists are standing by to review your design files.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            <a
              href="https://wa.me/917456849955?text=Hi%20Star%20Press,%20I%20have%20a%20technical%20question%20regarding%20file%20specifications."
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#25D366] text-black hover:bg-[#20bd5a] transition-colors text-center"
            >
              Ask on WhatsApp
            </a>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button variant="outline" size="md" className="w-full">
                <span>Submit Ticket</span>
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
