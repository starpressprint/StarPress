"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Truck,
  Sparkles,
  Tag,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Edit3,
  Check,
  X,
  Lock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useCart, CartItem } from "@/context/CartContext";
import { useAuthSession } from "@/hooks/useAuthSession";

const FREE_SHIPPING_THRESHOLD = 999;
const STANDARD_SHIPPING_FEE = 40;

export default function CartPage() {
  const {
    items,
    updateQuantity,
    updateCustomization,
    removeItem,
    clearCart,
    subtotal,
    isLoaded,
  } = useCart();
  const { status, isHydrated } = useAuthSession();

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    type: string;
    value: number;
    discountAmount: number;
  } | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");

  // State for editing customization inline in cart
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const startEditing = (item: CartItem) => {
    setEditingItemId(item.id);
    setEditText(item.customText || item.customizations?.personalizedText || "");
    setEditNotes(item.customizations?.notes || "");
  };

  const saveEditing = (id: string) => {
    updateCustomization(id, {
      customText: editText.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    setEditingItemId(null);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
  };

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError("");
    setPromoSuccess("");

    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    setIsApplyingPromo(true);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, cartSubtotal: subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPromoError(data.error || "Invalid coupon code.");
        setAppliedPromo(null);
      } else {
        setAppliedPromo({
          code: data.code,
          type: data.type,
          value: data.value,
          discountAmount: data.discountAmount,
        });
        setPromoSuccess(data.message || `Coupon "${data.code}" applied!`);
      }
    } catch {
      setPromoError("Failed to validate coupon code. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoSuccess("");
    setPromoError("");
  };

  // Dynamic calculations supporting percentage and fixed discounts
  const discountAmount = appliedPromo
    ? appliedPromo.type === "percentage"
      ? Math.round((subtotal * appliedPromo.value) / 100)
      : Math.min(appliedPromo.value, subtotal)
    : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const isFreeShipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingFee = discountedSubtotal > 0 && !isFreeShipping ? STANDARD_SHIPPING_FEE : 0;
  const gstAmount = Math.round(discountedSubtotal * 0.18);
  const grandTotal = discountedSubtotal + gstAmount + shippingFee;

  const amountNeededForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - discountedSubtotal
  );
  const freeShippingProgress = Math.min(
    100,
    Math.round((discountedSubtotal / FREE_SHIPPING_THRESHOLD) * 100)
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-border-subtle">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">
              <ShoppingBag size={13} className="text-brand-yellow" />
              <span>Review Your Custom Print Order</span>
            </div>
            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-text-primary uppercase tracking-tight break-words">
              Shopping Cart ({items.reduce((acc, it) => acc + it.quantity, 0)} units)
            </h1>
          </div>

          <div className="text-xs text-text-muted flex items-center gap-2">
            <Link href="/" className="hover:text-text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-text-primary transition-colors">
              Shop
            </Link>
            <span>/</span>
            <span className="text-brand-yellow font-medium">Cart</span>
          </div>
        </div>

        {!isLoaded ? (
          <div className="py-20 text-center text-text-secondary">
            <div className="inline-block w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading your cart...</p>
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="relative rounded-3xl border border-border-subtle bg-bg-surface p-12 sm:p-20 text-center max-w-2xl mx-auto overflow-hidden shadow-xl my-6">
            <div className="relative z-10 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-bg-surface-alt border border-border-subtle flex items-center justify-center mx-auto text-brand-yellow shadow-inner">
                <ShoppingBag size={38} />
              </div>
              <div>
                <h2 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase mb-2">
                  Your Cart Is Empty
                </h2>
                <p className="text-sm text-text-secondary max-w-md mx-auto">
                  Looks like you haven&apos;t added any print products yet. Explore our
                  commercial catalog or launch a custom printing inquiry.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Link href="/shop" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full">
                    <span>Explore Shop Catalog</span>
                    <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link href="/custom-printing" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full">
                    <span>Custom Printing</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Active Cart Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-6">
              {/* Shipping Status */}
              {isFreeShipping ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-300">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="font-medium">
                      Complimentary Pan-India Standard Delivery applied!
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
                    Free Shipping
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="flex items-center gap-2 text-text-secondary">
                      <Truck size={15} className="text-brand-yellow shrink-0" />
                      <span>
                        Add{" "}
                        <strong className="text-text-primary font-semibold">
                          ₹{amountNeededForFreeShipping}
                        </strong>{" "}
                        more to qualify for{" "}
                        <span className="text-text-primary font-medium">Free Shipping</span>
                      </span>
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      ₹{discountedSubtotal} / ₹{FREE_SHIPPING_THRESHOLD}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-bg-surface-alt overflow-hidden">
                    <div
                      className="h-full bg-brand-yellow rounded-full transition-all duration-300"
                      style={{ width: `${freeShippingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Items Card List */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface divide-y divide-border-subtle overflow-hidden">
                {items.map((item) => {
                  const itemTotal = item.price * item.quantity;
                  const isEditing = editingItemId === item.id;
                  const hasCustomization = Boolean(
                    item.customText ||
                    item.customizations?.personalizedText ||
                    item.customizations?.notes
                  );

                  return (
                    <div
                      key={item.id}
                      className="p-4 xs:p-5 sm:p-6 space-y-4 transition-colors hover:bg-white/[0.01]"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                        {/* Product Thumbnail & Details */}
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <Link
                            href={item.href}
                            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-bg-surface-alt border border-border-subtle shrink-0 group mt-1"
                          >
                            <Image
                              src={item.imageSrc}
                              alt={item.name}
                              fill
                              sizes="96px"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </Link>

                          <div className="min-w-0 space-y-1.5 flex-1">
                            <Link
                              href={item.href}
                              className="font-display font-bold text-base sm:text-lg text-text-primary hover:text-brand-yellow transition-colors line-clamp-1"
                            >
                              {item.name}
                            </Link>

                            {/* Variant Chips */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {item.sizeLabel && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-bg-surface-alt border border-border-subtle px-2 py-0.5 rounded text-text-secondary">
                                  <span>Size:</span>
                                  <strong className="text-text-primary">{item.sizeLabel}</strong>
                                </span>
                              )}

                              {item.materialLabel && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-bg-surface-alt border border-border-subtle px-2 py-0.5 rounded text-text-secondary">
                                  <span>Material:</span>
                                  <strong className="text-text-primary">{item.materialLabel}</strong>
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                                <Sparkles size={10} />
                                <span>Digital Proof Included</span>
                              </span>

                              {/* Stock Badge */}
                              {item.stockQuantity !== undefined && item.stockQuantity <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                                  Out of Stock
                                </span>
                              ) : item.stockQuantity !== undefined && item.stockQuantity <= 25 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                                  Only {item.stockQuantity} left
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                                  In Stock {item.stockQuantity ? `(${item.stockQuantity.toLocaleString("en-IN")})` : "(Ready)"}
                                </span>
                              )}
                            </div>

                            {/* Inscription Display */}
                            {(item.customText || item.customizations?.personalizedText) && (
                              <div className="text-xs text-amber-300/90 bg-amber-500/[0.08] border border-amber-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-2 max-w-full">
                                <span className="font-semibold text-amber-400 shrink-0">Personalization:</span>
                                <span className="truncate italic">
                                  &ldquo;{item.customText || item.customizations?.personalizedText}&rdquo;
                                </span>
                              </div>
                            )}

                            {/* Production Notes Display */}
                            {item.customizations?.notes && (
                              <div className="text-xs text-text-muted flex items-start gap-1.5">
                                <span className="font-medium text-text-secondary shrink-0">Note:</span>
                                <span className="truncate">{item.customizations.notes}</span>
                              </div>
                            )}

                            {/* Unit Price info */}
                            <div className="text-xs text-text-secondary pt-1">
                              Unit Rate:{" "}
                              <span className="text-text-primary font-mono font-medium">
                                ₹{item.price.toLocaleString("en-IN")}
                              </span>{" "}
                              / unit
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper & Subtotal */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 xs:gap-4 sm:gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                          {/* Quantity Counter */}
                          {(() => {
                            const maxStock = item.stockQuantity !== undefined ? item.stockQuantity : 5000;
                            const isAtMax = item.quantity >= maxStock;
                            return (
                              <div className="flex items-center border border-border-subtle rounded-xl bg-bg-surface-alt shrink-0">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-l-xl transition-colors active:scale-90"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-10 sm:w-12 text-center font-mono font-bold text-xs sm:text-sm text-text-primary select-none">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  disabled={isAtMax}
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className={`w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center text-text-secondary rounded-r-xl transition-colors ${
                                    isAtMax
                                      ? "opacity-30 cursor-not-allowed"
                                      : "hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-90"
                                  }`}
                                  aria-label="Increase quantity"
                                  title={isAtMax ? `Max available stock reached (${maxStock})` : "Increase quantity"}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            );
                          })()}

                          {/* Line Subtotal */}
                          <div className="text-right min-w-[70px] sm:min-w-[90px]">
                            <div className="font-mono font-bold text-sm sm:text-lg text-brand-yellow">
                              ₹{itemTotal.toLocaleString("en-IN")}
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-text-muted">Subtotal</span>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="w-9 h-9 sm:w-9 sm:h-9 flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                            aria-label={`Remove ${item.name}`}
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Customization Editor Accordion */}
                      {isEditing ? (
                        <div className="p-4 rounded-xl bg-bg-surface-alt border border-brand-yellow/30 space-y-3 mt-3 animate-fadeIn">
                          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-yellow">
                            <span>Edit Custom Personalization & Notes</span>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="text-text-muted hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-text-secondary uppercase font-semibold">
                              Personalized Text / Engraving:
                            </label>
                            <input
                              type="text"
                              maxLength={120}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              placeholder="e.g. Rahul Sharma, Slogan, etc."
                              className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-yellow"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-text-secondary uppercase font-semibold">
                              Special Instructions / Notes:
                            </label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="e.g. Center-aligned, priority packaging"
                              className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-yellow"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => saveEditing(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-brand-yellow text-black font-bold text-xs flex items-center gap-1.5 hover:bg-yellow-400 transition-colors"
                            >
                              <Check size={14} />
                              <span>Update Specifications</span>
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="px-3 py-1.5 rounded-lg bg-bg-surface-alt text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-xs text-text-muted pt-1">
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-brand-yellow transition-colors font-medium"
                          >
                            <Edit3 size={13} />
                            <span>
                              {hasCustomization
                                ? "Edit Personalization / Notes"
                                : "+ Add Personalization / Note"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons below Items */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-brand-yellow transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Continue Shopping Catalog</span>
                </Link>

                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors"
                >
                  Clear Entire Cart
                </button>
              </div>
            </div>

            {/* Right Column: Order Summary & Checkout */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-7 space-y-6 shadow-xl sticky top-24">
                <h2 className="font-display font-black text-xl text-text-primary uppercase tracking-tight">
                  Order Summary
                </h2>

                {/* Promo Code Form */}
                <div>
                  <form onSubmit={handleApplyPromo} className="space-y-2">
                    <label
                      htmlFor="promo-input"
                      className="block text-xs font-semibold text-text-secondary uppercase tracking-wider"
                    >
                      Have a Coupon / Promo Code?
                    </label>

                    {appliedPromo ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={15} />
                          <span>
                            Code <strong>{appliedPromo.code}</strong> applied (
                            {appliedPromo.type === "percentage"
                              ? `-${appliedPromo.value}%`
                              : `-₹${appliedPromo.value}`}
                            )
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={removePromo}
                          className="text-text-muted hover:text-text-primary transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            id="promo-input"
                            type="text"
                            placeholder="e.g. STAR10"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow font-mono uppercase"
                          />
                          <Tag
                            size={14}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={isApplyingPromo || !promoCode.trim()}
                          className="shrink-0 text-xs"
                        >
                          {isApplyingPromo ? "Applying..." : "Apply"}
                        </Button>
                      </div>
                    )}

                    {promoError && (
                      <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle size={12} />
                        <span>{promoError}</span>
                      </p>
                    )}

                    {promoSuccess && !appliedPromo && (
                      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} />
                        <span>{promoSuccess}</span>
                      </p>
                    )}
                  </form>
                </div>

                {/* Financial Summary */}
                <div className="space-y-3 pt-4 border-t border-border-subtle text-xs">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>
                      Items Subtotal ({items.reduce((acc, it) => acc + it.quantity, 0)} units)
                    </span>
                    <span className="font-mono font-medium text-text-primary">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {appliedPromo && discountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-400 font-medium">
                      <span>Promo Discount ({appliedPromo.code})</span>
                      <span className="font-mono">
                        −₹{discountAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Pan-India Delivery</span>
                    {isFreeShipping ? (
                      <span className="font-bold text-emerald-400 uppercase">
                        FREE
                      </span>
                    ) : (
                      <span className="font-mono text-text-primary">
                        ₹{STANDARD_SHIPPING_FEE}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Estimated GST (18%)</span>
                    <span className="font-mono text-text-primary">
                      ₹{gstAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-border-subtle flex items-baseline justify-between">
                    <div>
                      <div className="font-display font-black text-base text-text-primary uppercase">
                        Estimated Total
                      </div>
                      <span className="text-[10px] text-text-muted">
                        All inclusive (Taxes & Shipping)
                      </span>
                    </div>
                    <div className="font-mono font-black text-2xl text-brand-yellow">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Proceed to Checkout CTA */}
                <div className="space-y-3 pt-2">
                  {(() => {
                    const hasOutOfStock = items.some(
                      (it) => it.stockQuantity !== undefined && (it.stockQuantity <= 0 || it.quantity > it.stockQuantity)
                    );
                    if (hasOutOfStock) {
                      return (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>Some items exceed available stock. Please reduce quantity to proceed.</span>
                          </div>
                          <Button
                            variant="primary"
                            size="lg"
                            disabled
                            className="w-full justify-center !py-4 font-black uppercase tracking-wider text-sm opacity-50 cursor-not-allowed"
                          >
                            <span>Resolve Stock to Checkout</span>
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <Link
                        href={`/checkout${appliedPromo ? `?coupon=${encodeURIComponent(appliedPromo.code)}` : ""}`}
                        className="block w-full"
                      >
                        <Button
                          variant="primary"
                          size="lg"
                          className="w-full justify-center !py-4 font-black uppercase tracking-wider text-sm shadow-xl shadow-brand-yellow/15"
                        >
                          <span>Proceed to Checkout</span>
                          <ArrowRight size={17} />
                        </Button>
                      </Link>
                    );
                  })()}

                  <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
                    <Lock size={12} className="text-emerald-400" />
                    <span>256-Bit Encrypted Razorpay Checkout</span>
                  </div>
                </div>

                {/* Assurance Badges */}
                <div className="pt-4 border-t border-border-subtle space-y-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-brand-yellow shrink-0" />
                    <span>Free digital PDF proof before printing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-brand-yellow shrink-0" />
                    <span>Moisture-proof secure cardboard packaging</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
