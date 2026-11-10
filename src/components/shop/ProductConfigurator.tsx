"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Check,
  Zap,
  ShieldCheck,
  MessageCircle,
  Truck,
  Sparkles,
  Info,
  ArrowRight,
  Sliders,
  Type,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Boxes,
} from "lucide-react";
import { CatalogProduct } from "@/lib/catalog";
import { calculateProductPrice, formatINR } from "@/lib/pricing";
import { useCart } from "@/context/CartContext";
import { WHATSAPP_NUMBER } from "@/lib/data";
import Button from "@/components/ui/Button";

export interface ProductConfiguratorProps {
  product: CatalogProduct;
}

export default function ProductConfigurator({ product }: ProductConfiguratorProps) {
  const { addItem } = useCart();

  // Initial option selections
  const defaultSize = product.sizeOptions.find((s) => s.default) || product.sizeOptions[0];
  const defaultMaterial = product.materialOptions.find((m) => m.default) || product.materialOptions[0];
  const defaultQtyTier = product.quantityTiers.find((q) => q.default) || product.quantityTiers[0];

  const [sizeId, setSizeId] = useState<string>(defaultSize?.id || "");
  const [materialId, setMaterialId] = useState<string>(defaultMaterial?.id || "");
  const [quantity, setQuantity] = useState<number>(defaultQtyTier?.quantity || 100);

  // Customization fields
  const [customText, setCustomText] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [customInitials, setCustomInitials] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");

  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Maximum characters allowed
  const MAX_CUSTOM_CHARS = 120;
  const freeCharLimit = product.customizationRules?.freeCharLimit || 20;
  const textPricePerChar = product.customizationRules?.textPricePerChar || 2;

  // Dynamic real-time price calculation via pricing engine
  const pricing = useMemo(() => {
    return calculateProductPrice(product, {
      sizeId,
      materialId,
      quantity,
      customText,
    });
  }, [product, sizeId, materialId, quantity, customText]);

  const selectedSize = product.sizeOptions.find((s) => s.id === sizeId);
  const selectedMaterial = product.materialOptions.find((m) => m.id === materialId);

  // Live Inventory Status
  const isTracked = product.trackInventory !== false;
  const availableStock = product.stockQuantity !== undefined ? product.stockQuantity : 5000;
  const lowStockThreshold = product.lowStockThreshold || 25;
  const isOutOfStock = isTracked && availableStock <= 0;
  const isLowStock = isTracked && availableStock > 0 && availableStock <= lowStockThreshold;
  const isQuantityExceeded = isTracked && quantity > availableStock;

  // Validation
  const validateCustomization = () => {
    if (isOutOfStock) {
      setValidationError("This product is currently out of stock.");
      return false;
    }
    if (isQuantityExceeded) {
      setValidationError(
        `Requested quantity (${quantity} units) exceeds available stock (${availableStock} units). Please select up to ${availableStock} units.`
      );
      return false;
    }
    if (customText.length > MAX_CUSTOM_CHARS) {
      setValidationError(`Custom text exceeds maximum limit of ${MAX_CUSTOM_CHARS} characters.`);
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleAddToCart = () => {
    if (!validateCustomization()) return;

    // Generate deterministic ID so same options merge, different options remain distinct
    const customKey = [
      product.id,
      sizeId || "default",
      materialId || "default",
      customText.trim() ? encodeURIComponent(customText.trim()) : "none",
      customName.trim() ? encodeURIComponent(customName.trim()) : "none",
    ].join("-");

    addItem(
      {
        id: customKey,
        productId: product.id,
        productSlug: product.slug,
        name: `${product.name} (${selectedSize?.label || "Standard"})`,
        price: pricing.unitPrice,
        imageSrc: product.images[0] || "/images/hero-composition.jpg",
        href: `/shop/${product.slug}`,
        quantity,
        sizeId,
        sizeLabel: selectedSize?.label,
        materialId,
        materialLabel: selectedMaterial?.label,
        customText: customText.trim() || undefined,
        customizations: {
          personalizedText: customText.trim() || undefined,
          name: customName.trim() || undefined,
          initials: customInitials.trim() || undefined,
          notes: customNotes.trim() || undefined,
        },
        specs: {
          sizeId,
          sizeLabel: selectedSize?.label,
          dimensions: selectedSize?.dimensions,
          materialId,
          materialLabel: selectedMaterial?.label,
          unitPrice: pricing.unitPrice,
          quantity,
          discountPercent: pricing.discountPercent,
          customText: customText.trim() || undefined,
          notes: customNotes.trim() || undefined,
        },
        stockQuantity: product.stockQuantity,
        inStock: product.inStock,
      },
      quantity
    );

    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 3500);
  };

  const whatsappMessage = encodeURIComponent(
    `Hi Star Press, I want a quote for ${product.name}:\n- Size: ${selectedSize?.label || "Standard"}\n- Material: ${selectedMaterial?.label || "Default"}\n- Quantity: ${quantity} units\n${customText ? `- Inscription: "${customText}"\n` : ""}- Total: ${pricing.formattedTotalPrice}`
  );

  return (
    <div className="space-y-8">
      {/* Live Inventory & Availability Status */}
      {isTracked && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            isOutOfStock
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : isLowStock
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          {isOutOfStock ? (
            <XCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          ) : isLowStock ? (
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <div className="font-bold text-sm">
              {isOutOfStock
                ? "Currently Out of Stock"
                : isLowStock
                ? `Only ${availableStock} units left in stock — order soon!`
                : `In Stock (${availableStock.toLocaleString("en-IN")} units available)`}
            </div>
            <p className="mt-0.5 text-text-secondary text-[11px] leading-relaxed">
              {isOutOfStock
                ? "This product is temporarily unavailable for online orders. Contact us on WhatsApp for custom inquiries or backorders."
                : isLowStock
                ? "High order velocity detected. Secure your batch now before queue replenishment."
                : "Pan-India delivery in 2-3 business days. Guaranteed pre-flight digital proof."}
            </p>
          </div>

          {isQuantityExceeded && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                Selected quantity ({quantity.toLocaleString("en-IN")}) exceeds available inventory ({availableStock.toLocaleString("en-IN")} units). Please select a lower quantity tier.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 1. Size Selection */}
      {product.sizeOptions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-yellow/15 text-brand-yellow text-xs font-mono font-bold flex items-center justify-center">
                1
              </span>
              <span>Choose Size & Dimensions</span>
            </label>
            {selectedSize?.dimensions && (
              <span className="text-xs text-slate-400 font-mono">
                {selectedSize.dimensions}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {product.sizeOptions.map((size) => {
              const isSelected = size.id === sizeId;
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSizeId(size.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-bg-surface-alt border-brand-yellow/90 ring-1 ring-brand-yellow/30 text-text-primary font-semibold shadow-sm"
                      : "bg-bg-surface border-border-subtle hover:border-brand-yellow/40 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div>
                    <span className="text-xs sm:text-sm font-medium block">{size.label}</span>
                    {size.dimensions && (
                      <span className="text-[11px] text-text-muted font-mono block mt-0.5">
                        {size.dimensions}
                      </span>
                    )}
                  </div>
                  {size.multiplier > 1 && (
                    <span className="text-[11px] font-mono text-brand-yellow bg-brand-yellow/10 px-1.5 py-0.5 rounded">
                      +{Math.round((size.multiplier - 1) * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Choose Paper Stock & Finish */}
      {product.materialOptions.length > 0 && (
        <div className="space-y-3">
          <label className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-yellow/15 text-brand-yellow text-xs font-mono font-bold flex items-center justify-center">
              2
            </span>
            <span>Choose Paper Stock & Finish</span>
          </label>

          <div className="space-y-2.5">
            {product.materialOptions.map((mat) => {
              const isSelected = mat.id === materialId;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setMaterialId(mat.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-bg-surface-alt border-brand-yellow/90 ring-1 ring-brand-yellow/30 text-text-primary font-semibold shadow-sm"
                      : "bg-bg-surface border-border-subtle hover:border-brand-yellow/40 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-text-primary">
                      {mat.label}
                    </div>
                    {mat.description && (
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {mat.description}
                      </div>
                    )}
                  </div>

                  {mat.extraPricePerUnit > 0 ? (
                    <span className="text-xs font-mono text-brand-yellow bg-brand-yellow/10 px-2 py-0.5 rounded">
                      +₹{mat.extraPricePerUnit}/unit
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-text-muted">Standard</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Quantity Tiers & Bulk Discounts */}
      {product.quantityTiers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-yellow/15 text-brand-yellow text-xs font-mono font-bold flex items-center justify-center">
                3
              </span>
              <span>Select Quantity Slab</span>
            </label>
            <span className="text-xs text-text-secondary">Higher volume = Lower unit cost</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {product.quantityTiers.map((tier) => {
              const isSelected = tier.quantity === quantity;
              return (
                <button
                  key={tier.quantity}
                  type="button"
                  onClick={() => setQuantity(tier.quantity)}
                  className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-bg-surface-alt border-brand-yellow/90 ring-1 ring-brand-yellow/30 text-text-primary scale-[1.02] shadow-sm font-semibold"
                      : "bg-bg-surface border-border-subtle hover:border-brand-yellow/40 text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tier.discountPercent > 0 && (
                    <span className="absolute -top-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white shadow-sm">
                      -{tier.discountPercent}%
                    </span>
                  )}
                  <span className="text-base font-display font-bold text-text-primary mt-1">
                    {tier.quantity.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-text-muted">units</span>
                </button>
              );
            })}
          </div>

          {isQuantityExceeded && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                Selected quantity ({quantity.toLocaleString("en-IN")}) exceeds available inventory ({availableStock.toLocaleString("en-IN")} units). Please select a lower quantity tier.
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. Product Personalization & Custom Details */}
      <div className="space-y-4 p-5 rounded-2xl border border-border-subtle bg-bg-surface">
        <div className="flex items-center justify-between">
          <label className="font-display font-bold text-sm text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} className="text-brand-yellow" />
            <span>Product Personalization & Engraving</span>
          </label>
          <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-text-secondary font-mono">
            Optional
          </span>
        </div>

        {/* Personalized Text / Engraving */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary font-medium">
              Custom Name, Engraving, or Slogan
            </span>
            <span className={`text-[11px] font-mono ${customText.length > MAX_CUSTOM_CHARS ? "text-rose-400 font-bold" : "text-text-muted"}`}>
              {customText.length} / {MAX_CUSTOM_CHARS} chars
            </span>
          </div>

          <input
            type="text"
            maxLength={MAX_CUSTOM_CHARS}
            placeholder="e.g. Rahul Sharma, Apex Corp, or 'Season Greetings 2026'"
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow transition-colors"
          />

          <p className="text-[11px] text-text-muted flex items-center gap-1.5">
            <Info size={12} className="shrink-0 text-brand-yellow" />
            <span>
              First {freeCharLimit} characters free. Additional characters are ₹{textPricePerChar}/char.
            </span>
          </p>
        </div>

        {/* Print Notes / Special Instructions */}
        <div className="space-y-1.5 pt-2 border-t border-border-subtle/60">
          <label className="block text-xs text-text-secondary font-medium">
            Production Instructions / Special Requests
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Center-aligned foil stamp, deliver before Friday, etc."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow transition-colors resize-none"
          />
        </div>

        {validationError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* 5. Customization Summary Card (Amazon-Style Pre-Add Inspection) */}
      <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.04] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-brand-yellow/20">
          <span className="font-display font-bold text-xs uppercase tracking-wider text-brand-yellow flex items-center gap-1.5">
            <Sliders size={13} />
            <span>Your Selected Customization Summary</span>
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
            Ready to Print
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center justify-between sm:justify-start sm:gap-2">
            <span className="text-text-muted">Size:</span>
            <span className="text-text-primary font-medium">
              {selectedSize?.label || "Standard"}
              {selectedSize?.dimensions && ` (${selectedSize.dimensions})`}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-start sm:gap-2">
            <span className="text-text-muted">Paper / Finish:</span>
            <span className="text-text-primary font-medium">
              {selectedMaterial?.label || "Standard"}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-start sm:gap-2">
            <span className="text-text-muted">Quantity:</span>
            <span className="text-brand-yellow font-bold font-mono">
              {quantity.toLocaleString()} units
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-start sm:gap-2">
            <span className="text-text-muted">Personalization:</span>
            <span className="text-text-primary font-medium truncate max-w-[180px]">
              {customText ? `"${customText}"` : "None (Standard Print)"}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Live Pricing Card & Add to Cart */}
      <div className="p-4 xs:p-6 rounded-2xl border border-border-subtle bg-gradient-to-br from-bg-surface via-bg-surface-alt to-bg-surface shadow-2xl space-y-5">
        {/* Unit Price and Total */}
        <div className="flex flex-col xs:flex-row xs:items-end justify-between gap-3 pb-4 border-b border-border-subtle">
          <div>
            <div className="text-xs text-text-muted">Total Estimated Price</div>
            <div className="text-3xl sm:text-4xl font-display font-black text-brand-yellow tracking-tight">
              {pricing.formattedTotalPrice}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Effective unit rate:{" "}
              <span className="font-mono text-text-primary font-semibold">
                {pricing.formattedUnitPrice} / unit
              </span>
            </div>
          </div>

          {pricing.discountAmount > 0 && (
            <div className="text-left xs:text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                <span>Save {formatINR(pricing.discountAmount)}</span>
              </span>
              <div className="text-[11px] text-text-muted mt-1">
                ({pricing.discountPercent}% bulk discount)
              </div>
            </div>
          )}
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            disabled={isOutOfStock || isQuantityExceeded}
            onClick={handleAddToCart}
            className={`w-full !py-3.5 !text-base font-bold shadow-xl shadow-brand-yellow/15 ${
              isOutOfStock || isQuantityExceeded ? "!opacity-50 !cursor-not-allowed" : ""
            }`}
          >
            {isAdded ? (
              <div className="flex items-center gap-2">
                <Check size={18} className="text-black stroke-[3]" />
                <span>Added {quantity} Units to Cart!</span>
              </div>
            ) : isOutOfStock ? (
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-black" />
                <span>Currently Out of Stock</span>
              </div>
            ) : isQuantityExceeded ? (
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-black" />
                <span>Quantity Exceeds Stock ({availableStock.toLocaleString()} Max)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-black stroke-[2.5]" />
                <span>Add {quantity} Units to Cart</span>
              </div>
            )}
          </Button>

          {/* Quick proceed to cart banner if just added */}
          {isAdded && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>Item saved to cart with custom specifications.</span>
              </div>
              <Link
                href="/cart"
                className="font-bold underline text-text-primary hover:text-brand-yellow flex items-center gap-1 shrink-0 ml-2"
              >
                <span>View Cart</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-bold transition-all"
          >
            <MessageCircle size={17} />
            <span>Chat on WhatsApp for Custom Specs</span>
          </a>
        </div>

        {/* Confidence micro-badges */}
        <div className="pt-2 grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-slate-400 shrink-0" />
            <span>Ships in {pricing.estimatedTurnaroundDays} business days</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-slate-400 shrink-0" />
            <span>Free digital PDF proofing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck size={14} className="text-slate-400 shrink-0" />
            <span>Pan-India insured courier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-slate-400 shrink-0" />
            <span>100% Quality Checked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
