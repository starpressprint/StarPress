"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  CreditCard,
  FileCheck,
  Sparkles,
  ShoppingBag,
  AlertCircle,
  Loader2,
  RefreshCw,
  Tag,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import { supabase } from "@/lib/supabase/client";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Delhi NCR",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, isLoaded } = useCart();
  const { session, status, isHydrated } = useAuthSession();

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "Delhi NCR",
    pinCode: "",
    notes: "",
    isGstRequired: false,
    companyName: "",
    gstin: "",
    shippingMethod: "standard", // "standard" | "express"
    paymentMethod: "online", // "online" | "cod_proof"
    couponCode: "",
  });

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quote State from Server
  const [serverQuote, setServerQuote] = useState<{
    subtotal: number;
    discount: number;
    gst: number;
    shipping: number;
    grandTotal: number;
    couponApplied?: { code: string; discountAmount: number };
  } | null>(null);

  // Confirmed Order State
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: string;
    orderId: string;
    date: string;
    total: number;
    itemsCount: number;
    shippingMethod: string;
    paymentMethod: string;
    paymentStatus: string;
  } | null>(null);

  const [pollTimeoutReached, setPollTimeoutReached] = useState(false);
  const idempotencyKeyRef = useRef<string>("");

  // Initialize or maintain a stable idempotency key for this checkout attempt
  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  }, []);

  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Autofill checkout details when user is authenticated
  useEffect(() => {
    if (session?.user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || session.user.name || "",
        email: prev.email || session.user.email || "",
        phone: prev.phone || session.user.phone || "",
      }));

      // Fetch saved addresses
      supabase.auth.getSession().then(({ data: sessionData }: any) => {
        const token = sessionData?.session?.access_token;
        fetch("/api/account/addresses", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.addresses && data.addresses.length > 0) {
              setSavedAddresses(data.addresses);
              const defaultAddr = data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
              setSelectedAddressId(defaultAddr.id);
              setIsAddingNewAddress(false);
              setFormData((prev) => ({
                ...prev,
                addressLine1: defaultAddr.line1,
                addressLine2: defaultAddr.line2 || "",
                city: defaultAddr.city,
                state: defaultAddr.state,
                pinCode: defaultAddr.pincode,
              }));
            } else {
              setIsAddingNewAddress(true);
            }
          })
          .catch(() => {
            setIsAddingNewAddress(true);
          });
      });
    } else {
      setIsAddingNewAddress(true);
    }
  }, [session]);

  // Enforce Authentication
  useEffect(() => {
    if (isHydrated && status === "unauthenticated") {
      router.replace("/login?callbackUrl=/checkout");
    }
  }, [isHydrated, status, router]);

  // Fetch Server Quote whenever line items or shipping options change
  useEffect(() => {
    if (!items || items.length === 0) return;

    let cancelled = false;

    async function fetchQuote() {
      try {
        const quotePayload = {
          items: items.map((it) => ({
            productId: (it as any).productId || it.id,
            slug: (it as any).productSlug || it.href?.replace("/shop/", "") || "product",
            quantity: it.quantity,
            sizeId: (it as any).sizeId,
            materialId: (it as any).materialId,
            customText: (it as any).customText,
            artworkUrl: (it as any).artworkUrl,
          })),
          couponCode: formData.couponCode.trim() || undefined,
          shippingMethod: formData.shippingMethod as "standard" | "express",
        };

        const res = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quotePayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.quote) {
            setServerQuote(data.quote);
          }
        }
      } catch {
        // Non-blocking quote fallback
      }
    }

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [items, formData.shippingMethod, formData.couponCode]);

  // Price calculations (prefer server quote, fallback to local standard)
  const gstAmount = serverQuote ? serverQuote.gst : Math.round(subtotal * 0.18);
  const shippingFee = serverQuote
    ? serverQuote.shipping
    : (subtotal >= 999 ? 0 : 99) + (formData.shippingMethod === "express" ? 249 : 0);
  const discountAmount = serverQuote ? serverQuote.discount : 0;
  const grandTotal = serverQuote
    ? serverQuote.grandTotal
    : Math.max(0, subtotal - discountAmount) + gstAmount + shippingFee;

  // Poll order status if online payment was made
  useEffect(() => {
    if (!confirmedOrder || confirmedOrder.paymentStatus === "PAID" || confirmedOrder.paymentMethod !== "ONLINE") {
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s
    const orderIdToPoll = confirmedOrder.id;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/orders/${orderIdToPoll}`);
        if (res.ok) {
          const data = await res.json();
          const pStatus = (data.order?.paymentStatus || "").toUpperCase();
          if (pStatus === "PAID") {
            setConfirmedOrder((prev) => (prev ? { ...prev, paymentStatus: "PAID" } : null));
            clearInterval(interval);
            return;
          }
        }
      } catch {}

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPollTimeoutReached(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [confirmedOrder]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "gstin") {
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase().trim() }));
    } else if (name === "pinCode") {
      setFormData((prev) => ({ ...prev, [name]: value.replace(/\D/g, "").slice(0, 6) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      // 1. Submit Order to server (authoritative quote & persistence)
      setStatusMessage("Registering print order specifications...");

      const payload = {
        userId: session?.user?.id || undefined,
        guestEmail: formData.email,
        guestPhone: formData.phone,
        guestName: formData.fullName,
        shippingAddress: {
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          companyName: formData.companyName,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pinCode,
        },
        billingAddress: formData.isGstRequired
          ? {
              companyName: formData.companyName,
              gstin: formData.gstin,
              addressLine1: formData.addressLine1,
              city: formData.city,
              state: formData.state,
              pincode: formData.pinCode,
            }
          : undefined,
        shippingMethod: formData.shippingMethod,
        couponCode: formData.couponCode.trim() || undefined,
        paymentMethod: formData.paymentMethod === "online" ? "ONLINE" : "PAY_AFTER_PROOF",
        notes: formData.notes,
        items: items.map((it) => ({
          productId: (it as any).productId || it.id,
          productSlug: (it as any).productSlug || it.href?.replace("/shop/", "") || "product",
          quantity: it.quantity,
          sizeId: (it as any).sizeId,
          materialId: (it as any).materialId,
          customText: (it as any).customText,
          artworkUrl: (it as any).artworkUrl,
          previewUrl: it.imageSrc,
        })),
      };

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.order) {
        throw new Error(
          orderData.error || "Failed to create order on server. Please verify your details."
        );
      }

      const placedOrder = orderData.order;

      // 2. Handle Payment Flow
      if (placedOrder.paymentMethod === "PAY_AFTER_PROOF") {
        // Proof flow: immediate confirmation with real DB orderNumber
        clearCart();
        setConfirmedOrder({
          id: placedOrder.id,
          orderId: placedOrder.orderNumber,
          date: new Date(placedOrder.createdAt || Date.now()).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          total: Number(placedOrder.totalAmount),
          itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
          shippingMethod: formData.shippingMethod,
          paymentMethod: "PAY_AFTER_PROOF",
          paymentStatus: "UNPAID",
        });
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Online Razorpay Flow
      setStatusMessage("Initializing secure payment session with Razorpay...");
      const razorpayResponse = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: placedOrder.id }),
      });

      const rzpData = await razorpayResponse.json();
      if (!razorpayResponse.ok || !rzpData.razorpayOrderId) {
        throw new Error(rzpData.error || "Payment gateway unavailable. Please retry or choose Pay After Proof.");
      }

      // Check if dev test mock (non-production only)
      if (rzpData.isMock) {
        setStatusMessage("Completing development test payment simulation...");
        const verifyRes = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: placedOrder.id,
            razorpay_order_id: rzpData.razorpayOrderId,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: "mock_test_signature",
          }),
        });

        const vData = await verifyRes.json();
        if (verifyRes.ok && vData.success) {
          clearCart();
          setConfirmedOrder({
            id: placedOrder.id,
            orderId: placedOrder.orderNumber,
            date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
            total: Number(placedOrder.totalAmount),
            itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
            shippingMethod: formData.shippingMethod,
            paymentMethod: "ONLINE",
            paymentStatus: "PAID",
          });
          setIsSubmitting(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      // Live Razorpay Checkout
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay payment SDK. Please check your network connection.");
      }

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency || "INR",
        name: "Star Press",
        description: `Print Order #${placedOrder.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#FFCF1B",
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
            setStatusMessage(null);
            setCheckoutError(
              "Payment window was closed before completion. Your cart items are preserved — you may retry whenever you are ready."
            );
          },
        },
        handler: async function (response: any) {
          setIsSubmitting(true);
          setStatusMessage("Verifying payment capture with server...");

          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: placedOrder.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const vData = await verifyRes.json();
            if (!verifyRes.ok || !vData.success) {
              throw new Error(
                vData.error || "Payment verification failed. If money was debited, your order will confirm automatically via webhook."
              );
            }

            // Payment verified and captured authoritatively
            clearCart();
            setConfirmedOrder({
              id: placedOrder.id,
              orderId: placedOrder.orderNumber,
              date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
              total: Number(placedOrder.totalAmount),
              itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
              shippingMethod: formData.shippingMethod,
              paymentMethod: "ONLINE",
              paymentStatus: "PAID",
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (vErr: any) {
            console.error("Payment verification error:", vErr);
            setCheckoutError(vErr.message);
          } finally {
            setIsSubmitting(false);
            setStatusMessage(null);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);

      razorpayInstance.on("payment.failed", function (resp: any) {
        setIsSubmitting(false);
        setStatusMessage(null);
        setCheckoutError(
          resp.error?.description || "Payment failed at card/bank network. Please retry with another payment method."
        );
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error("Error during checkout:", err);
      setCheckoutError(err.message || "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base text-text-primary">
        <Header />
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-20 text-center text-text-secondary">
          <div className="inline-block w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin mb-4" />
          <p>Preparing checkout...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isHydrated && status === "unauthenticated") {
    return null;
  }

  // If order was confirmed, display real confirmation screen!
  if (confirmedOrder) {
    const whatsappProofMsg = encodeURIComponent(
      `Hi Star Press team! I just placed Order #${confirmedOrder.orderId} for ₹${confirmedOrder.total.toLocaleString(
        "en-IN"
      )}. Please confirm receipt of my artwork and send the digital pre-press proof.`
    );

    const isPaid = confirmedOrder.paymentStatus === "PAID";

    return (
      <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
        <Header />
        <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-12 md:py-20">
          <div className="rounded-3xl border border-emerald-500/30 bg-bg-surface p-8 sm:p-12 text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                {isPaid ? "Payment Verified • Order Confirmed" : "Order Placed • Pre-Press Proof Required"}
              </div>
              <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
                {isPaid ? "Thank You for Printing with Star Press!" : "Order Queued for Proof Inspection!"}
              </h1>
              <p className="text-sm text-text-secondary max-w-lg mx-auto">
                {isPaid
                  ? "Your payment is verified and your print order is queued directly into our press workflow."
                  : "Your print order has been received. Our pre-flight team will inspect your resolution, bleeds, and color profiles before final printing."}
              </p>
            </div>

            {/* Order Details Receipt Box */}
            <div className="rounded-2xl border border-border-subtle bg-bg-surface-alt p-6 text-left space-y-4 max-w-md mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <span className="text-xs text-text-secondary">Order Reference</span>
                <span className="font-mono font-black text-brand-yellow text-base">
                  {confirmedOrder.orderId}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Order Date</span>
                <span className="text-white font-medium">{confirmedOrder.date}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Payment Status</span>
                <span className={`font-bold uppercase ${isPaid ? "text-emerald-400" : "text-amber-400"}`}>
                  {isPaid ? "PAID (ONLINE)" : "PAY AFTER PROOF (UNPAID)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Production Mode</span>
                <span className="text-emerald-400 font-bold uppercase">
                  {confirmedOrder.shippingMethod === "express"
                    ? "Priority 24h Rush"
                    : "Standard Production"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                <span className="text-xs font-bold text-white uppercase">
                  {isPaid ? "Total Paid" : "Total Payable"}
                </span>
                <span className="font-mono font-black text-lg text-white">
                  ₹{confirmedOrder.total.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Polling / Pending verification notice if online but not yet PAID */}
            {!isPaid && confirmedOrder.paymentMethod === "ONLINE" && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 text-left max-w-md mx-auto flex items-start gap-2.5">
                <RefreshCw size={15} className="animate-spin text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Confirming gateway capture...</p>
                  <p className="text-amber-300/80 mt-0.5">
                    {pollTimeoutReached
                      ? `Payment received; confirmation may take a minute. Track with ${confirmedOrder.orderId}.`
                      : "Awaiting final confirmation from bank gateway. This page updates automatically."}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/917456849955?text=${whatsappProofMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full max-w-md py-3.5 px-6 rounded-xl font-bold text-sm bg-[#25D366] text-black hover:bg-[#20bd5a] transition-colors shadow-lg"
              >
                <span>Verify Pre-Press Proof on WhatsApp</span>
                <Sparkles size={16} />
              </a>

              <div className="flex items-center justify-center gap-4 pt-2">
                <Link
                  href="/shop"
                  className="text-xs text-text-secondary hover:text-brand-yellow transition-colors"
                >
                  Return to Shop Catalog
                </Link>
                <span className="text-border-subtle">|</span>
                <Link
                  href={`/orders/track?order=${encodeURIComponent(confirmedOrder.orderId)}`}
                  className="text-xs text-text-secondary hover:text-white transition-colors"
                >
                  Track Order Live
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If cart is empty
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base text-text-primary">
        <Header />
        <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center mx-auto text-text-muted">
            <ShoppingBag size={30} />
          </div>
          <h1 className="font-display font-black text-2xl text-white uppercase">
            Your Cart is Empty
          </h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Please add print items to your cart before proceeding to checkout.
          </p>
          <Link href="/shop" className="inline-block">
            <Button variant="primary" size="md">
              <span>Browse Products</span>
            </Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-10 md:py-14">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-border-subtle">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Lock size={13} className="text-brand-yellow" />
              <span>256-Bit Encrypted Secure Checkout</span>
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight">
              Checkout & Delivery
            </h1>
          </div>

          <div className="text-xs text-text-muted flex items-center gap-2">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/cart" className="hover:text-white transition-colors">
              Cart
            </Link>
            <span>/</span>
            <span className="text-brand-yellow font-medium">Checkout</span>
          </div>
        </div>

        {/* Global Error Notice */}
        {checkoutError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-200">Checkout Notice</p>
              <p>{checkoutError}</p>
            </div>
          </div>
        )}

        {/* In-Flight Status Notice */}
        {statusMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow text-xs sm:text-sm flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-brand-yellow shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handlePlaceOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Multi-step details */}
            <div className="lg:col-span-8 space-y-8">
              {/* Step 1: Customer Contact */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">
                      Customer Contact Details
                    </h2>
                    <p className="text-xs text-text-secondary">
                      We will send production proof approvals and dispatch tracking here.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      Full Name *
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      Email Address *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="rahul@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="phone"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      Phone Number (WhatsApp) {!session?.user?.phone && "*"}
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      required={!session?.user?.phone}
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Delivery Address */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">
                      Pan-India Delivery Address
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Moisture-proof cardboard packaged parcel dispatch location.
                    </p>
                  </div>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <label className="block text-xs font-semibold text-text-secondary uppercase">
                      Select Delivery Address
                    </label>
                    <div className="space-y-3">
                      {savedAddresses.map((addr: any) => (
                        <div
                          key={addr.id}
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setIsAddingNewAddress(false);
                            setFormData((prev) => ({
                              ...prev,
                              addressLine1: addr.line1,
                              addressLine2: addr.line2 || "",
                              city: addr.city,
                              state: addr.state,
                              pinCode: addr.pincode,
                            }));
                          }}
                          className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                            selectedAddressId === addr.id && !isAddingNewAddress
                              ? "border-brand-yellow bg-brand-yellow/5"
                              : "border-border-subtle bg-bg-surface-alt hover:border-white/30"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-1">
                            <div className="w-4 h-4 rounded-full border border-brand-yellow flex items-center justify-center shrink-0">
                              {selectedAddressId === addr.id && !isAddingNewAddress && (
                                <div className="w-2 h-2 rounded-full bg-brand-yellow" />
                              )}
                            </div>
                            <span className="font-bold text-sm text-white">
                              {addr.label || "Saved Address"}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary pl-7">
                            {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ""}
                            {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                        </div>
                      ))}
                      
                      <div
                        onClick={() => {
                          setSelectedAddressId(null);
                          setIsAddingNewAddress(true);
                          setFormData((prev) => ({
                            ...prev,
                            addressLine1: "",
                            addressLine2: "",
                            city: "",
                            state: "Delhi NCR",
                            pinCode: "",
                          }));
                        }}
                        className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                          isAddingNewAddress
                            ? "border-brand-yellow bg-brand-yellow/5"
                            : "border-border-subtle bg-bg-surface-alt hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full border border-brand-yellow flex items-center justify-center shrink-0">
                            {isAddingNewAddress && (
                              <div className="w-2 h-2 rounded-full bg-brand-yellow" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-white">
                            + Add New Address
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(!savedAddresses.length || isAddingNewAddress) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="addressLine1"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Flat / Building / Office / Premise *
                      </label>
                      <input
                        id="addressLine1"
                        name="addressLine1"
                        type="text"
                        required
                        autoComplete="address-line1"
                        placeholder="e.g. Unit 402, Apex Business Park"
                        value={formData.addressLine1}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="addressLine2"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      Street Address & Area *
                    </label>
                    <input
                      id="addressLine2"
                      name="addressLine2"
                      type="text"
                      required
                      autoComplete="address-line2"
                      placeholder="e.g. MG Road, Near Metro Station"
                      value={formData.addressLine2}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="city"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      City *
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      required
                      autoComplete="address-level2"
                      placeholder="e.g. Mumbai, New Delhi, Bengaluru"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="state"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      State *
                    </label>
                    <select
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-yellow"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st} className="bg-bg-surface text-white">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="pinCode"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      PIN Code (6 Digits) *
                    </label>
                    <input
                      id="pinCode"
                      name="pinCode"
                      type="text"
                      inputMode="numeric"
                      required
                      pattern="^[1-9][0-9]{5}$"
                      maxLength={6}
                      autoComplete="postal-code"
                      placeholder="110001"
                      value={formData.pinCode}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="landmark"
                      className="block text-xs font-semibold text-text-secondary uppercase"
                    >
                      Landmark (Optional)
                    </label>
                    <input
                      id="landmark"
                      name="landmark"
                      type="text"
                      placeholder="Opposite City Mall"
                      value={formData.landmark}
                      onChange={handleInputChange}
                      className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>
                </div>
                )}
              </div>

              {/* Step 3: GST Tax Invoicing (Optional) */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isGstRequired"
                    checked={formData.isGstRequired}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-border-subtle bg-bg-surface-alt text-brand-yellow focus:ring-brand-yellow accent-brand-yellow"
                  />
                  <div>
                    <span className="font-display font-bold text-base text-white">
                      I need a B2B GST Invoice for Input Tax Credit
                    </span>
                    <p className="text-xs text-text-secondary">
                      Enter your Registered Business Name & GSTIN to claim 18% GST credit.
                    </p>
                  </div>
                </label>

                {formData.isGstRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border-subtle">
                    <div className="space-y-1">
                      <label
                        htmlFor="companyName"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Registered Company / Entity Name *
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        required={formData.isGstRequired}
                        placeholder="e.g. Star Enterprises Pvt Ltd"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="gstin"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        15-Character GSTIN *
                      </label>
                      <input
                        id="gstin"
                        name="gstin"
                        type="text"
                        required={formData.isGstRequired}
                        placeholder="07AAAAA0000A1Z5"
                        maxLength={15}
                        value={formData.gstin}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow uppercase font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Dispatch Speed & Production Priority */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">
                      Production & Dispatch Priority
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Choose turnaround speed to match your campaign schedule.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    className={`rounded-xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                      formData.shippingMethod === "standard"
                        ? "border-brand-yellow/90 bg-brand-yellow/[0.08] ring-1 ring-brand-yellow/40"
                        : "border-border-subtle bg-bg-surface-alt hover:border-text-secondary"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">
                          Standard Production
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          Dispatched in 3–5 business days. Free for orders ₹999+.
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="standard"
                        checked={formData.shippingMethod === "standard"}
                        onChange={handleInputChange}
                        className="accent-brand-yellow"
                      />
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-brand-yellow">
                      {subtotal >= 999 ? "FREE" : "₹99"}
                    </div>
                  </label>

                  <label
                    className={`rounded-xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                      formData.shippingMethod === "express"
                        ? "border-brand-yellow/90 bg-brand-yellow/[0.08] ring-1 ring-brand-yellow/40"
                        : "border-border-subtle bg-bg-surface-alt hover:border-text-secondary"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>Priority 24h Rush</span>
                          <span className="text-[10px] bg-white/10 text-slate-200 border border-white/10 px-1.5 py-0.5 rounded font-bold uppercase">
                            Fast
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          Jump to front of press queue. Dispatched in 24–48 hours.
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="express"
                        checked={formData.shippingMethod === "express"}
                        onChange={handleInputChange}
                        className="accent-brand-yellow"
                      />
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-white">
                      +₹249 Priority Fee
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 4: Payment Method */}
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-brand-yellow text-black font-black text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">
                      Payment Preference
                    </h2>
                    <p className="text-xs text-text-secondary">
                      100% secure payment handling and digital receipting.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label
                    className={`rounded-xl border p-4 cursor-pointer flex items-center justify-between transition-all ${
                      formData.paymentMethod === "online"
                        ? "border-brand-yellow/90 bg-brand-yellow/[0.08] ring-1 ring-brand-yellow/40"
                        : "border-border-subtle bg-bg-surface-alt hover:border-text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="text-brand-yellow" size={20} />
                      <div>
                        <div className="font-bold text-white text-sm">
                          Online UPI / Cards / NetBanking (Instant Confirmation via Razorpay)
                        </div>
                        <p className="text-xs text-text-secondary">
                          Google Pay, PhonePe, Paytm, RuPay, Visa, Mastercard, NetBanking.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="online"
                      checked={formData.paymentMethod === "online"}
                      onChange={handleInputChange}
                      className="accent-brand-yellow"
                    />
                  </label>

                  <label
                    className={`rounded-xl border p-4 cursor-pointer flex items-center justify-between transition-all ${
                      formData.paymentMethod === "cod_proof"
                        ? "border-brand-yellow/90 bg-brand-yellow/[0.08] ring-1 ring-brand-yellow/40"
                        : "border-border-subtle bg-bg-surface-alt hover:border-text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="text-brand-yellow" size={20} />
                      <div>
                        <div className="font-bold text-white text-sm">
                          Pay After Pre-Press Proof Approval (COD / Bank Transfer)
                        </div>
                        <p className="text-xs text-text-secondary">
                          Review digital proof via WhatsApp first, then complete payment before dispatch.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod_proof"
                      checked={formData.paymentMethod === "cod_proof"}
                      onChange={handleInputChange}
                      className="accent-brand-yellow"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Summary & Final CTA */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-7 space-y-6 shadow-xl sticky top-24">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">
                    Order Summary
                  </h3>
                  <Link
                    href="/cart"
                    className="text-xs text-brand-yellow hover:underline"
                  >
                    Edit Cart
                  </Link>
                </div>

                {/* Items Mini-list */}
                <div className="max-h-60 overflow-y-auto space-y-3 divide-y divide-border-subtle pr-1">
                  {items.map((it) => (
                    <div key={it.id} className="pt-3 first:pt-0 flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-bg-surface-alt border border-border-subtle shrink-0">
                        <Image
                          src={it.imageSrc}
                          alt={it.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {it.name}
                        </p>
                        <p className="text-[11px] text-text-muted">Qty: {it.quantity}</p>
                      </div>
                      <div className="font-mono text-xs font-bold text-brand-yellow">
                        ₹{(it.price * it.quantity).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Code Input */}
                <div className="pt-2 border-t border-border-subtle">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1.5">
                    Have a Discount Coupon?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. STAR10"
                      value={formData.couponCode}
                      onChange={(e) => setFormData((p) => ({ ...p, couponCode: e.target.value.toUpperCase() }))}
                      className="flex-1 h-9 px-3 rounded-xl bg-bg-surface-alt border border-border-subtle text-xs text-white uppercase font-mono placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                  </div>
                </div>

                {/* Financials */}
                <div className="space-y-2.5 pt-4 border-t border-border-subtle text-xs">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Subtotal</span>
                    <span className="font-mono text-white">
                      ₹{subtotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-400">
                      <span>Discount ({serverQuote?.couponApplied?.code || "Coupon"})</span>
                      <span className="font-mono font-medium">−₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-text-secondary">
                    <span>GST (18%)</span>
                    <span className="font-mono text-white">
                      ₹{gstAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Shipping</span>
                    {shippingFee === 0 ? (
                      <span className="text-emerald-400 font-bold uppercase">
                        FREE
                      </span>
                    ) : (
                      <span className="font-mono text-white">₹{shippingFee}</span>
                    )}
                  </div>

                  {formData.shippingMethod === "express" && (
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Priority 24h Rush</span>
                      <span className="font-mono text-white font-medium">+₹249 Included</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border-subtle flex items-baseline justify-between">
                    <div>
                      <div className="font-display font-black text-base text-white uppercase">
                        Total Payable
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full justify-center text-sm uppercase tracking-wider font-black py-4 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin text-black" size={16} />
                      <span>{statusMessage || "Processing Order..."}</span>
                    </span>
                  ) : formData.paymentMethod === "online" ? (
                    <span>Proceed to Razorpay Payment →</span>
                  ) : (
                    <span>Confirm Order (Pay After Proof)</span>
                  )}
                </Button>

                {/* Micro guarantees */}
                <div className="pt-2 text-[11px] text-text-muted space-y-1.5 border-t border-border-subtle">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={13} className="text-emerald-400/90" />
                    <span>Free Pre-Flight Artwork & Resolution Inspection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={13} className="text-emerald-400/90" />
                    <span>Direct Courier Tracking Link Dispatched via SMS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
