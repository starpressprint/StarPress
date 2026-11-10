"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  UploadCloud,
  FileCheck,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Clock,
  Printer,
  ShoppingBag,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";

interface CustomProductType {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  image: string;
  sizes: string[];
  finishes: string[];
  minQty: number;
}

const CUSTOM_PRODUCT_TYPES: CustomProductType[] = [
  {
    id: "apparel-tshirt",
    name: "Custom Bio-Washed Cotton T-Shirt",
    category: "Apparel",
    basePrice: 399,
    image: "/images/promo-banner.jpg",
    sizes: ["S (38\")", "M (40\")", "L (42\")", "XL (44\")", "XXL (46\")"],
    finishes: ["DTF Full Color", "Screen Print", "HD Embroidery Badge"],
    minQty: 5,
  },
  {
    id: "merch-mug",
    name: "Custom Glossy Ceramic Mug (11oz)",
    category: "Drinkware",
    basePrice: 199,
    image: "/images/cat-gifts.jpg",
    sizes: ["Standard 11 oz", "Jumbo 15 oz (+₹50)", "Magic Heat Sensitive (+₹100)"],
    finishes: ["Full Sublimation Wrap", "Single Side Logo", "Dual Side Print"],
    minQty: 1,
  },
  {
    id: "signage-banner",
    name: "High-Resolution Vinyl Star Flex Banner",
    category: "Large Format",
    basePrice: 450,
    image: "/images/prod-banner.jpg",
    sizes: ["4 ft × 2 ft", "6 ft × 3 ft (+₹300)", "8 ft × 4 ft (+₹650)", "10 ft × 6 ft (+₹1200)"],
    finishes: ["Heavy Duty Star Flex (340 GSM)", "Blackout Flex (440 GSM)", "Vinyl Sunboard Mount"],
    minQty: 1,
  },
  {
    id: "packaging-box",
    name: "Custom Corrugated Shipping Box",
    category: "Packaging",
    basePrice: 45,
    image: "/images/cat-gifts.jpg",
    sizes: ["Small (8\"×6\"×3\")", "Medium (10\"×8\"×4\")", "Large (12\"×10\"×5\")"],
    finishes: ["Kraft Natural Brown", "White Coated Top", "Full CMYK External Print"],
    minQty: 25,
  },
  {
    id: "labels-diecut",
    name: "Custom Vinyl Die-Cut Stickers",
    category: "Stickers",
    basePrice: 15,
    image: "/images/prod-stickers.jpg",
    sizes: ["2\" × 2\" Round", "3\" × 3\" Custom Shape", "4\" × 4\" Custom Shape"],
    finishes: ["Matte Lamination", "Gloss Vinyl", "Holographic Rainbow Foil"],
    minQty: 50,
  },
  {
    id: "canvas-art",
    name: "Gallery-Wrapped Cotton Canvas Art",
    category: "Digital Art",
    basePrice: 699,
    image: "/images/promo-banner.jpg",
    sizes: ["12\" × 12\" Square", "16\" × 20\" Gallery", "24\" × 36\" Grand Living"],
    finishes: ["Pine Wood Stretcher Frame (0.75\")", "Deep Gallery Frame (1.5\")", "Textured UV Gloss Varnish"],
    minQty: 1,
  },
];

export default function CustomPrintingPage() {
  const { addItem } = useCart();

  const [selectedProduct, setSelectedProduct] = useState<CustomProductType>(
    CUSTOM_PRODUCT_TYPES[0]
  );
  const [selectedSize, setSelectedSize] = useState<string>(CUSTOM_PRODUCT_TYPES[0].sizes[0]);
  const [selectedFinish, setSelectedFinish] = useState<string>(
    CUSTOM_PRODUCT_TYPES[0].finishes[0]
  );
  const [quantity, setQuantity] = useState<number>(CUSTOM_PRODUCT_TYPES[0].minQty);
  const [needDesignHelp, setNeedDesignHelp] = useState(false);
  const [notes, setNotes] = useState("");

  // Upload simulation state
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    type: string;
    previewUrl?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  // When product type changes, reset selections
  const handleProductChange = (prod: CustomProductType) => {
    setSelectedProduct(prod);
    setSelectedSize(prod.sizes[0]);
    setSelectedFinish(prod.finishes[0]);
    setQuantity(Math.max(prod.minQty, 1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setTimeout(() => {
      const isImg = file.type.startsWith("image/");
      setUploadedFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: file.type || "Design File",
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      });
      setIsUploading(false);
    }, 600);
  };

  const handleRemoveFile = () => {
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
  };

  // Pricing calculation
  const unitPrice = useMemo(() => {
    let price = selectedProduct.basePrice;
    // finish add-on
    if (selectedFinish.includes("+₹")) {
      const match = selectedFinish.match(/\+₹(\d+)/);
      if (match) price += parseInt(match[1], 10);
    }
    // size add-on
    if (selectedSize.includes("+₹")) {
      const match = selectedSize.match(/\+₹(\d+)/);
      if (match) price += parseInt(match[1], 10);
    }
    // Volume discount
    if (quantity >= 500) price *= 0.65;
    else if (quantity >= 100) price *= 0.75;
    else if (quantity >= 25) price *= 0.85;

    return Math.round(price);
  }, [selectedProduct, selectedSize, selectedFinish, quantity]);

  const subtotal = unitPrice * quantity;
  const designHelpFee = needDesignHelp ? 299 : 0;
  const totalPrice = subtotal + designHelpFee;
  const effectiveUnitPrice = Math.max(1, Math.round(totalPrice / quantity));

  const handleAddToCart = () => {
    addItem(
      {
        id: `custom-${selectedProduct.id}-${Date.now()}`,
        name: `${selectedProduct.name} [${selectedSize}, ${selectedFinish}]${needDesignHelp ? " + Design Service" : ""}`,
        price: effectiveUnitPrice,
        imageSrc: selectedProduct.image,
        href: "/custom-printing",
      },
      quantity
    );

    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2500);
  };

  const whatsappInquiryUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Hi Star Press! I am configuring a custom print job:\n- Product: ${selectedProduct.name}\n- Specs: ${selectedSize} | ${selectedFinish}\n- Quantity: ${quantity} units\n- Total Quote: ₹${totalPrice.toLocaleString("en-IN")}\n- Artwork: ${uploadedFile ? uploadedFile.name : "Will share on chat"}`
    );
    return `https://wa.me/917456849955?text=${text}`;
  }, [selectedProduct, selectedSize, selectedFinish, quantity, totalPrice, uploadedFile]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Page Hero Banner */}
        <div className="relative rounded-3xl border border-border-subtle bg-bg-surface p-5 xs:p-7 sm:p-12 mb-8 sm:mb-12 overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={13} className="text-brand-yellow" />
              <span>Bespoke Pre-Press & Fabrication Studio</span>
            </div>

            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl uppercase text-text-primary tracking-tight leading-[1.1] break-words">
              Custom Printing Studio
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Upload your print-ready artwork or let our design specialists assist you.
              Choose custom materials, finishes, and quantities with instant live quotes
              and pre-flight file checks.
            </p>
          </div>
        </div>

        {/* 2-Column Studio Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Interactive Product & Spec Builder */}
          <div className="lg:col-span-8 space-y-10">
            {/* 1. Choose Product Line */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Select Product Type</span>
                </h2>
                <span className="text-xs text-text-muted">
                  6 Custom Categories Available
                </span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {CUSTOM_PRODUCT_TYPES.map((prod) => {
                  const isSelected = selectedProduct.id === prod.id;

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleProductChange(prod)}
                      className={`text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 group ${
                        isSelected
                          ? "border-brand-yellow/90 bg-brand-yellow/[0.08] shadow-md shadow-black/40 ring-1 ring-brand-yellow/30"
                          : "border-border-subtle bg-bg-surface hover:border-white/20 hover:bg-bg-surface-alt"
                      }`}
                    >
                      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-bg-surface-alt border border-border-subtle">
                        <Image
                          src={prod.image}
                          alt={prod.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider block mb-0.5">
                          {prod.category}
                        </span>
                        <div className="text-xs sm:text-sm font-bold text-text-primary line-clamp-1 group-hover:text-brand-yellow transition-colors">
                          {prod.name}
                        </div>
                        <div className="text-xs text-text-muted font-mono mt-1">
                          From ₹{prod.basePrice}/unit
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Configure Sizes & Materials */}
            <div className="space-y-6 rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8">
              <h2 className="font-display font-bold text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <span>Configure Specifications</span>
              </h2>

              {/* Size Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Select Dimensions / Size
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {selectedProduct.sizes.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`px-3 py-2.5 rounded-xl border text-xs text-center transition-all ${
                        selectedSize === sz
                          ? "border-brand-yellow/90 bg-brand-yellow/[0.08] text-text-primary font-semibold ring-1 ring-brand-yellow/40 shadow-sm"
                          : "border-border-subtle bg-bg-surface-alt text-text-secondary hover:border-brand-yellow/40 hover:text-text-primary font-medium"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Material / Finish Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Printing Technology / Material Finish
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {selectedProduct.finishes.map((fn) => (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => setSelectedFinish(fn)}
                      className={`px-3 py-2.5 rounded-xl border text-xs text-center transition-all ${
                        selectedFinish === fn
                          ? "border-brand-yellow/90 bg-brand-yellow/[0.08] text-text-primary font-semibold ring-1 ring-brand-yellow/40 shadow-sm"
                          : "border-border-subtle bg-bg-surface-alt text-text-secondary hover:border-brand-yellow/40 hover:text-text-primary font-medium"
                      }`}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Slider / Tiers */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="qty-slider"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider"
                  >
                    Quantity Units (Tiered Bulk Discounts)
                  </label>
                  <span className="text-xs font-mono font-bold text-brand-yellow">
                    {quantity} units
                  </span>
                </div>

                <input
                  id="qty-slider"
                  type="range"
                  min={selectedProduct.minQty}
                  max={1000}
                  step={selectedProduct.minQty >= 25 ? 25 : 5}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-yellow cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>Min: {selectedProduct.minQty}</span>
                  <span>100 units (-25%)</span>
                  <span>500+ units (-35% Wholesale)</span>
                </div>
              </div>
            </div>

            {/* 3. Drag & Drop Artwork Upload */}
            <div className="space-y-4 rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8">
              <h2 className="font-display font-bold text-lg text-text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center">
                  3
                </span>
                <span>Upload Artwork File</span>
              </h2>

              {uploadedFile ? (
                /* Uploaded File Pill */
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {uploadedFile.previewUrl ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-emerald-500/30">
                        <Image
                          src={uploadedFile.previewUrl}
                          alt="Uploaded artwork preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileCheck size={20} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-text-primary truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {uploadedFile.size} • Ready for Pre-Flight Inspection
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-2 text-text-muted hover:text-red-400 rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                /* Dropzone */
                <label className="relative border-2 border-dashed border-border-subtle hover:border-brand-yellow/50 bg-bg-surface-alt rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group">
                  <input
                    type="file"
                    accept=".pdf,.ai,.psd,.cdr,.svg,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center text-text-secondary group-hover:text-brand-yellow group-hover:scale-105 transition-all mb-3">
                    <UploadCloud size={28} />
                  </div>
                  <div className="font-bold text-text-primary text-sm mb-1">
                    {isUploading ? "Inspecting File..." : "Click or Drag & Drop Print File"}
                  </div>
                  <p className="text-xs text-text-secondary max-w-sm">
                    Accepted formats: PDF, AI, PSD, CDR, SVG, or high-res PNG (up to 50MB).
                  </p>
                  <span className="text-[10px] text-text-muted mt-2">
                    Must be 300 DPI with CMYK color profile & 3mm bleed.
                  </span>
                </label>
              )}

              {/* Optional Pre-press Assistance */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-4 rounded-xl border border-border-subtle bg-bg-surface-alt cursor-pointer hover:border-brand-yellow/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={needDesignHelp}
                    onChange={(e) => setNeedDesignHelp(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-border-subtle bg-bg-surface text-brand-yellow focus:ring-brand-yellow accent-brand-yellow"
                  />
                  <div>
                    <div className="font-bold text-text-primary text-xs sm:text-sm flex items-center gap-2">
                      <span>Add Pre-Press Design Proofing & File Fix (+₹299)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-brand-yellow/10 text-brand-yellow font-bold uppercase">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      A Star Press pre-press artist will calibrate RGB to CMYK, check safe margins,
                      fix bleeds, and send a high-res 3D proof on WhatsApp before printing.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Quote & Cart Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-7 space-y-6 shadow-xl sticky top-24">
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
                    Live Calculation
                  </span>
                  <h3 className="font-display font-black text-xl text-text-primary uppercase tracking-tight">
                    Custom Quote
                  </h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow flex items-center justify-center">
                  <Printer size={18} />
                </div>
              </div>

              {/* Configured Item Preview */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-text-secondary">
                  <span>Product</span>
                  <span className="text-text-primary font-bold text-right max-w-[180px] truncate">
                    {selectedProduct.name}
                  </span>
                </div>

                <div className="flex items-center justify-between text-text-secondary">
                  <span>Size / Dimension</span>
                  <span className="text-text-primary font-mono">{selectedSize}</span>
                </div>

                <div className="flex items-center justify-between text-text-secondary">
                  <span>Print Finish</span>
                  <span className="text-text-primary font-medium text-right max-w-[180px] truncate">
                    {selectedFinish}
                  </span>
                </div>

                <div className="flex items-center justify-between text-text-secondary">
                  <span>Quantity Units</span>
                  <span className="text-text-primary font-mono font-bold">{quantity}</span>
                </div>

                <div className="flex items-center justify-between text-text-secondary">
                  <span>Unit Effective Price</span>
                  <span className="text-text-primary font-mono">
                    ₹{unitPrice.toLocaleString("en-IN")}
                  </span>
                </div>

                {needDesignHelp && (
                  <div className="flex items-center justify-between text-brand-yellow">
                    <span>Pre-Press Proofing Help</span>
                    <span className="font-mono">+₹299</span>
                  </div>
                )}

                <div className="pt-4 border-t border-border-subtle flex items-baseline justify-between">
                  <div>
                    <div className="font-display font-black text-base text-text-primary uppercase">
                      Total Estimate
                    </div>
                    <span className="text-[10px] text-text-muted">
                      Excl. standard 18% GST
                    </span>
                  </div>
                  <div className="font-mono font-black text-2xl text-brand-yellow">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleAddToCart}
                  className="w-full justify-center text-sm font-bold uppercase tracking-wider"
                >
                  {isAddedToCart ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span>Added to Cart!</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShoppingBag size={16} />
                      <span>Add Custom Job to Cart</span>
                    </span>
                  )}
                </Button>

                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <span>Chat & Send Artwork on WhatsApp</span>
                  <ArrowRight size={14} />
                </a>
              </div>

              {/* Guarantees */}
              <div className="pt-3 border-t border-border-subtle space-y-2.5 text-xs text-text-secondary">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={14} className="text-emerald-400/90 shrink-0" />
                  <span>Color match accuracy within 3ΔE tolerance</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock size={14} className="text-emerald-400/90 shrink-0" />
                  <span>Digital 3D soft proof within 4 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
