"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
  ShoppingBag,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tag,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  CreditCard,
  FileText,
  FileCheck,
  Building,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useCart, CartItem } from "@/context/CartContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import { supabase } from "@/lib/supabase/client";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
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
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="checkout.razorpay.com"]'
    );
    if (existingScript) {
      if ((window as any).Razorpay) return resolve(true);
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

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

  // Active step: 1 (Cart), 2 (Details), 3 (Payment), 4 (Confirmation)
  const [currentStep, setCurrentStep] = useState<2 | 3 | 4>(2);

  // Address Form State
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Uttarakhand");
  const [pincode, setPincode] = useState("");
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  // Delivery & Notes State
  const [deliveryOption, setDeliveryOption] = useState<"standard" | "express">("standard");
  const [orderNotes, setOrderNotes] = useState("");

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod_proof">("online");

  // Optional GSTIN
  const [isGstRequired, setIsGstRequired] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Server Quote & In-Flight State
  const [serverQuote, setServerQuote] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [recoveryOrderId, setRecoveryOrderId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Confirmed Order Result
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

  const idempotencyKeyRef = useRef<string>("");

  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  }, []);

  // Show authentication prompt if unauthenticated when hydrated
  useEffect(() => {
    if (isHydrated && status === "unauthenticated") {
      setShowAuthModal(true);
    }
  }, [isHydrated, status]);

  // Preload Razorpay checkout SDK
  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  // Read URL coupon if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlCoupon = new URLSearchParams(window.location.search).get("coupon");
      if (urlCoupon && urlCoupon.trim()) {
        const clean = urlCoupon.trim().toUpperCase();
        setCouponCode(clean);
        setCouponInput(clean);
        setShowCouponInput(true);
      }
    }
  }, []);

  // Auto-fill user credentials when authenticated
  useEffect(() => {
    if (session?.user) {
      setFullName((prev) => prev || session.user.name || "");
      if (session.user.phone) {
        const raw = session.user.phone.replace("+91", "").trim();
        setPhoneNumber((prev) => prev || raw);
      }
    }
  }, [session]);

  // Fetch saved addresses for authenticated users
  useEffect(() => {
    async function loadAddresses() {
      if (!session?.user) return;
      setAddressLoading(true);
      try {
        let authToken: string | undefined;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          authToken = sessionData?.session?.access_token;
        } catch {}

        const res = await fetch("/api/account/addresses", {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });

        if (res.ok) {
          const data = await res.json();
          if (data.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
            setSavedAddresses(data.addresses);
            const defaultAddr = data.addresses.find((a: SavedAddress) => a.isDefault) || data.addresses[0];
            setSelectedAddressId(defaultAddr.id);
            setAddressLine(defaultAddr.line1 || "");
            setCity(defaultAddr.city || "");
            setState(defaultAddr.state || "Uttarakhand");
            setPincode(defaultAddr.pincode || "");
            if (defaultAddr.phone) {
              setPhoneNumber(defaultAddr.phone.replace("+91", "").trim());
            }
          }
        }
      } catch {}
      setAddressLoading(false);
    }

    loadAddresses();
  }, [session]);

  // Fetch Authoritative Server Quote
  useEffect(() => {
    if (!items || items.length === 0) return;

    let isMounted = true;
    async function fetchQuote() {
      try {
        const quotePayload = {
          items: items.map((it) => ({
            productId: it.productId || it.id,
            slug: it.productSlug || it.href?.replace("/shop/", "") || "product",
            quantity: it.quantity,
            sizeId: it.sizeId,
            materialId: it.materialId,
            customText: it.customText || it.customizations?.personalizedText,
            artworkUrl: it.artworkUrl,
          })),
          couponCode: couponCode.trim() || undefined,
          shippingMethod: deliveryOption,
        };

        const res = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quotePayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.quote) {
            setServerQuote(data.quote);
            if (data.quote.couponApplied) {
              setCouponFeedback({
                type: "success",
                msg: `Coupon "${data.quote.couponApplied.code}" applied: Saved ₹${data.quote.couponApplied.discountAmount}!`,
              });
            } else if (couponCode.trim()) {
              setCouponFeedback({
                type: "error",
                msg: "Coupon code was not applicable to items in your cart.",
              });
            }
          }
        }
      } catch {}
    }

    fetchQuote();
    return () => {
      isMounted = false;
    };
  }, [items, deliveryOption, couponCode]);

  // Exact pricing derived from server quote or calculated fallback
  const standardDeliveryFee = 40;
  const expressDeliveryFee = standardDeliveryFee + 249;
  const isEligibleForFreeShipping = subtotal >= 999;
  const fallbackDelivery = deliveryOption === "express"
    ? (isEligibleForFreeShipping ? 249 : expressDeliveryFee)
    : (isEligibleForFreeShipping ? 0 : standardDeliveryFee);
  const deliveryCharge = serverQuote ? serverQuote.shipping : fallbackDelivery;

  const displaySubtotal = serverQuote ? serverQuote.subtotal : subtotal;
  const gstAmount = serverQuote ? serverQuote.gst : Math.round(displaySubtotal * 0.18);
  const discountAmount = serverQuote ? serverQuote.discount : 0;
  const grandTotal = serverQuote
    ? serverQuote.grandTotal
    : Math.max(0, displaySubtotal - discountAmount) + deliveryCharge + gstAmount;

  // Select Saved Address
  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setAddressLine(addr.line1 || "");
    setCity(addr.city || "");
    setState(addr.state || "Uttarakhand");
    setPincode(addr.pincode || "");
    if (addr.phone) {
      setPhoneNumber(addr.phone.replace("+91", "").trim());
    }
    setShowSavedAddressesModal(false);
  };

  // Coupon application handler
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponFeedback(null);
    if (!couponInput.trim()) return;
    setCouponCode(couponInput.trim().toUpperCase());
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setCouponInput("");
    setCouponFeedback(null);
  };

  // Validate Step 2 (Details)
  const validateDetails = (): boolean => {
    setCheckoutError(null);
    if (!fullName.trim()) {
      setCheckoutError("Please enter your Full Name.");
      return false;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setCheckoutError("Please enter a valid 10-digit mobile number.");
      return false;
    }
    if (!addressLine.trim()) {
      setCheckoutError("Please enter your complete delivery address.");
      return false;
    }
    if (!city.trim()) {
      setCheckoutError("Please enter your city.");
      return false;
    }
    const cleanPin = pincode.replace(/\D/g, "");
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setCheckoutError("Please enter a valid 6-digit Indian PIN code.");
      return false;
    }
    return true;
  };

  // Proceed button click
  const handleProceedClick = () => {
    if (!session?.user) {
      setShowAuthModal(true);
      setCheckoutError("Please sign in or create an account to proceed with checkout.");
      return;
    }
    if (currentStep === 2) {
      if (validateDetails()) {
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (currentStep === 3) {
      handlePlaceOrder();
    }
  };

  // Place Order Action
  const handlePlaceOrder = async () => {
    if (!session?.user) {
      setShowAuthModal(true);
      setCheckoutError("Authentication is mandatory to place an order. Please sign in.");
      return;
    }

    if (!validateDetails()) {
      setCurrentStep(2);
      return;
    }

    setCheckoutError(null);
    setIsSubmitting(true);

    try {
      // Validate session token with Supabase to reject expired sessions
      let authToken: string | undefined;
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session || !sessionData.session.user) {
          setShowAuthModal(true);
          setCheckoutError("Your login session has expired. Please sign in again to complete your order.");
          setIsSubmitting(false);
          return;
        }
        authToken = sessionData.session.access_token;
      } catch {
        setShowAuthModal(true);
        setCheckoutError("Authentication session error. Please sign in again to continue.");
        setIsSubmitting(false);
        return;
      }

      const clientEmail = session.user.email;
      const clientName = fullName.trim() || session.user.name || "Valued Customer";
      const cleanPhone = phoneNumber.replace(/\D/g, "").slice(-10);
      const fullPhone = `+91 ${cleanPhone}`;

      const payload = {
        userId: session.user.id,
        guestEmail: clientEmail,
        guestPhone: fullPhone,
        guestName: clientName,
        shippingAddress: {
          fullName: clientName,
          phone: fullPhone,
          email: clientEmail,
          addressLine1: addressLine.trim(),
          city: city.trim(),
          state: state,
          pincode: pincode.trim(),
        },
        billingAddress: isGstRequired
          ? {
              companyName: companyName.trim() || clientName,
              gstin: gstin.toUpperCase().trim(),
              addressLine1: addressLine.trim(),
              city: city.trim(),
              state: state,
              pincode: pincode.trim(),
            }
          : undefined,
        shippingMethod: deliveryOption,
        couponCode: couponCode.trim() || undefined,
        paymentMethod: paymentMethod === "online" ? "ONLINE" : "PAY_AFTER_PROOF",
        notes: orderNotes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId || it.id,
          productSlug: it.productSlug || it.href?.replace("/shop/", "") || "product",
          quantity: it.quantity,
          sizeId: it.sizeId,
          materialId: it.materialId,
          customText: it.customText || it.customizations?.personalizedText,
          artworkUrl: it.artworkUrl,
          previewUrl: it.imageSrc,
        })),
      };

      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };

      // 1. Create order on server
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.order) {
        if (orderResponse.status === 401) {
          setShowAuthModal(true);
          throw new Error("Authentication required to place an order. Please sign in.");
        }
        throw new Error(
          orderData.error || "Failed to create order on server. Please verify your details."
        );
      }

      const placedOrder = orderData.order;

      // 2. Pay After Proof / Free Order flow
      if (paymentMethod !== "online" || Number(placedOrder.totalAmount) <= 0) {
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
          shippingMethod: deliveryOption,
          paymentMethod: paymentMethod === "online" ? "100%_DISCOUNT" : "PAY_AFTER_PROOF",
          paymentStatus: Number(placedOrder.totalAmount) <= 0 ? "PAID" : "UNPAID",
        });
        setCurrentStep(4);
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // 3. Online Razorpay Payment flow
      const razorpayResponse = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ orderId: placedOrder.id }),
      });

      const rzpData = await razorpayResponse.json();
      if (!razorpayResponse.ok || !rzpData.razorpayOrderId) {
        throw new Error(rzpData.error || "Payment gateway unavailable. Please retry or choose Pay After Proof.");
      }

      const activeKey = rzpData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!activeKey) {
        throw new Error("Razorpay checkout key is missing. Please contact support.");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay payment SDK. Please check your network connection.");
      }

      const options = {
        key: activeKey,
        amount: rzpData.amount,
        currency: rzpData.currency || "INR",
        name: "Star Press",
        description: `Print Order #${placedOrder.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: fullName.trim(),
          email: clientEmail,
          contact: cleanPhone,
        },
        theme: {
          color: "#4F46E5",
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
            setRecoveryOrderId(placedOrder.id);
            setCheckoutError(
              "Payment window was closed before completion. Your order has been preserved — you can retry payment whenever ready."
            );
          },
          escape: true,
          backdropclose: false,
        },
        handler: async function (response: any) {
          setIsSubmitting(true);

          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: authHeaders,
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
                vData.error || "Payment verification failed. If money was debited, your order will confirm automatically shortly."
              );
            }

            clearCart();
            setConfirmedOrder({
              id: placedOrder.id,
              orderId: placedOrder.orderNumber,
              date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
              total: Number(placedOrder.totalAmount),
              itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
              shippingMethod: deliveryOption,
              paymentMethod: "ONLINE",
              paymentStatus: "PAID",
            });
            setCurrentStep(4);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (vErr: any) {
            console.error("Payment verification error:", vErr);
            setRecoveryOrderId(placedOrder.id);
            setCheckoutError(vErr.message);
          } finally {
            setIsSubmitting(false);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", function (resp: any) {
        setIsSubmitting(false);
        setRecoveryOrderId(placedOrder.id);
        setCheckoutError(
          resp.error?.description || "Payment failed at card/bank network. Please retry or choose Pay After Proof."
        );
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error("Error during checkout:", err);
      const rawMsg = err.message || "An unexpected error occurred. Please try again.";
      let userFriendlyMsg = rawMsg;
      if (rawMsg.includes("401") || rawMsg.includes("Authentication required") || rawMsg.includes("sign in")) {
        setShowAuthModal(true);
        userFriendlyMsg = "Please sign in or create an account to complete your order.";
      } else if (rawMsg.includes("Insufficient stock") || rawMsg.includes("out of stock")) {
        userFriendlyMsg = `${rawMsg} Please adjust your cart quantity to available inventory.`;
      }
      setCheckoutError(userFriendlyMsg);
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !isHydrated || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <Header />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-28 text-center">
          <Loader2 size={36} className="animate-spin text-brand-indigo mx-auto mb-4" />
          <p className="text-sm font-medium text-text-secondary">Verifying secure checkout session...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Empty cart view
  if (items.length === 0 && !confirmedOrder) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <Header />
        <main className="flex-1 max-w-[600px] w-full mx-auto px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center mx-auto mb-5 shadow-sm">
            <ShoppingBag size={28} />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Your Shopping Cart is Empty</h1>
          <p className="text-sm text-text-secondary mb-8">
            Add custom visiting cards, illuminated name plates, neon boards, or marketing prints to get started.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-indigo hover:bg-brand-indigo/90 text-white font-semibold text-sm transition-all shadow-md shadow-brand-indigo/20"
          >
            <span>Explore Custom Prints</span>
            <ArrowRight size={16} />
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base relative text-text-primary selection:bg-brand-indigo selection:text-white">
      <Header />

      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Step 4: Confirmed Order View */}
        {currentStep === 4 && confirmedOrder ? (
          <div className="max-w-[760px] mx-auto space-y-6">
            {/* Top Stepper for Confirmation */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Order Confirmed!</h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Thank you for your business. Your order is registered and in production.
              </p>
              <div className="flex items-center justify-center gap-3 sm:gap-6 mt-6 max-w-[480px] mx-auto text-xs">
                <div className="flex items-center gap-2 font-medium text-brand-indigo">
                  <span className="w-7 h-7 rounded-full bg-brand-indigo text-white flex items-center justify-center font-bold text-xs">✓</span>
                  <span>Cart</span>
                </div>
                <div className="h-0.5 bg-brand-indigo flex-1" />
                <div className="flex items-center gap-2 font-medium text-brand-indigo">
                  <span className="w-7 h-7 rounded-full bg-brand-indigo text-white flex items-center justify-center font-bold text-xs">✓</span>
                  <span>Details</span>
                </div>
                <div className="h-0.5 bg-brand-indigo flex-1" />
                <div className="flex items-center gap-2 font-medium text-brand-indigo">
                  <span className="w-7 h-7 rounded-full bg-brand-indigo text-white flex items-center justify-center font-bold text-xs">✓</span>
                  <span>Payment</span>
                </div>
                <div className="h-0.5 bg-brand-indigo flex-1" />
                <div className="flex items-center gap-2 font-bold text-text-primary">
                  <span className="w-7 h-7 rounded-full bg-brand-indigo text-white flex items-center justify-center font-bold text-xs ring-4 ring-brand-indigo/20">4</span>
                  <span>Confirmation</span>
                </div>
              </div>
            </div>

            {/* Confirmed Details Card */}
            <div className="bg-bg-surface rounded-3xl p-6 sm:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.04)] border border-border-subtle text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-brand-indigo/10 text-brand-indigo text-xs font-bold font-mono tracking-wide mb-2">
                  Order #{confirmedOrder.orderId}
                </span>
                <h2 className="text-xl font-bold text-text-primary">Order Placed Successfully</h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-[480px] mx-auto">
                  A confirmation summary has been registered for {fullName}. Our pre-press specialists are preparing your digital production proof.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-bg-surface-alt text-left border border-border-subtle text-xs">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Date</span>
                  <span className="font-semibold text-text-primary">{confirmedOrder.date}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Total</span>
                  <span className="font-semibold text-text-primary">₹{confirmedOrder.total.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Payment</span>
                  <span className="font-semibold text-text-primary">
                    {confirmedOrder.paymentMethod === "PAY_AFTER_PROOF" ? "Pay After Proof" : "Online Paid"}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Delivery</span>
                  <span className="font-semibold text-text-primary capitalize">
                    {confirmedOrder.shippingMethod === "express" ? "Express (1-3 days)" : "Standard (3-7 days)"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href={`/orders/track?orderId=${confirmedOrder.orderId}`}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-indigo hover:bg-brand-indigo/90 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-brand-indigo/20"
                >
                  Track Order Live →
                </Link>
                <Link
                  href="/shop"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-bg-surface-alt hover:bg-border-subtle text-text-secondary font-semibold text-xs sm:text-sm transition-all border border-border-subtle"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header Title & Subtitle */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                Checkout & Delivery
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Complete your order in a few simple steps
              </p>

              {/* Progress Stepper */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6 max-w-[460px] mx-auto text-xs">
                {/* Step 1: Cart */}
                <Link href="/cart" className="flex items-center gap-1.5 font-medium text-brand-indigo hover:underline">
                  <span className="w-7 h-7 rounded-full bg-brand-indigo text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-brand-indigo/20">
                    1
                  </span>
                  <span className="hidden sm:inline">Cart</span>
                </Link>

                <div className="h-0.5 bg-brand-indigo flex-1 max-w-[60px]" />

                {/* Step 2: Details */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center gap-1.5 font-semibold transition-colors ${
                    currentStep === 2 ? "text-text-primary" : "text-brand-indigo"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      currentStep === 2
                        ? "bg-brand-indigo text-white ring-4 ring-brand-indigo/20"
                        : "bg-brand-indigo text-white"
                    }`}
                  >
                    2
                  </span>
                  <span className={currentStep === 2 ? "font-bold text-text-primary" : ""}>Details</span>
                </button>

                <div className={`h-0.5 flex-1 max-w-[60px] transition-colors ${
                  currentStep >= 3 ? "bg-brand-indigo" : "bg-border-subtle"
                }`} />

                {/* Step 3: Payment */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateDetails()) setCurrentStep(3);
                  }}
                  className={`flex items-center gap-1.5 transition-colors ${
                    currentStep === 3 ? "font-bold text-text-primary" : "text-text-muted"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      currentStep === 3
                        ? "bg-brand-indigo text-white ring-4 ring-brand-indigo/20"
                        : "bg-bg-surface-alt border border-border-subtle text-text-muted"
                    }`}
                  >
                    3
                  </span>
                  <span>Payment</span>
                </button>

                <div className="h-0.5 bg-border-subtle flex-1 max-w-[60px]" />

                {/* Step 4: Confirmation */}
                <div className="flex items-center gap-1.5 text-text-muted">
                  <span className="w-7 h-7 rounded-full bg-bg-surface-alt border border-border-subtle text-text-muted flex items-center justify-center font-bold text-xs">
                    4
                  </span>
                  <span className="hidden sm:inline">Confirmation</span>
                </div>
              </div>
            </div>

            {/* Unauthenticated Alert Banner */}
            {status === "unauthenticated" && (
              <div className="mb-6 p-4.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <Lock size={19} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 dark:text-amber-200">Sign In Required to Place Order</p>
                    <p className="text-text-secondary mt-0.5">
                      Orders require a Star Press account. Your cart items are preserved and will remain intact.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/login?callbackUrl=/checkout")}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  Sign In to Continue →
                </button>
              </div>
            )}

            {/* Error Banner */}
            {checkoutError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-700 dark:text-rose-300">Checkout Notice</p>
                    <p>{checkoutError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod("cod_proof");
                      setCurrentStep(3);
                      setCheckoutError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-bg-surface hover:bg-bg-surface-alt text-text-primary text-xs font-semibold border border-rose-500/30 shadow-2xs transition-colors"
                  >
                    Select Pay After Proof
                  </button>
                  {recoveryOrderId && (
                    <Link
                      href={`/account/orders/${recoveryOrderId}/pay`}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-indigo hover:bg-brand-indigo/90 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      Retry Payment Securely →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Main 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* LEFT COLUMN: Delivery Details & Delivery Options */}
              <div className="lg:col-span-7 space-y-6">
                {currentStep === 2 ? (
                  <>
                    {/* 1. Delivery Details Card */}
                    <div className="bg-bg-surface rounded-3xl p-4 xs:p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)] border border-border-subtle space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
                            <Truck size={19} />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-text-primary leading-tight">
                              Delivery Details
                            </h2>
                            <p className="text-xs text-text-secondary mt-0.5">
                              Where should we deliver your order?
                            </p>
                          </div>
                        </div>

                        {savedAddresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowSavedAddressesModal(true)}
                            className="text-xs font-semibold text-brand-indigo hover:underline shrink-0"
                          >
                            Saved Addresses ({savedAddresses.length})
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Row 1: Full Name & Phone Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Full Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="e.g. Prince Saxena"
                              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              Phone Number <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center h-11 rounded-xl border border-border-subtle bg-bg-surface-alt focus-within:border-brand-indigo focus-within:ring-2 focus-within:ring-brand-indigo/20 transition-all overflow-hidden">
                              <div className="flex items-center gap-1.5 px-3 bg-bg-surface border-r border-border-subtle text-xs font-semibold text-text-secondary select-none">
                                <span>🇮🇳</span>
                                <ChevronDown size={13} className="text-text-muted" />
                                <span>+91</span>
                              </div>
                              <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                placeholder="98765 43210"
                                className="w-full h-full px-3.5 bg-transparent text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Address */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-text-secondary">
                            Address <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={addressLine}
                            onChange={(e) => setAddressLine(e.target.value)}
                            placeholder="House / Flat / Building / Street"
                            className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                          />
                        </div>

                        {/* Row 3: City, State, PIN Code (3 columns) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              City <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="Enter city"
                              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              State <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                className="w-full h-11 px-3.5 pr-8 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary appearance-none focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all cursor-pointer"
                              >
                                {INDIAN_STATES.map((st) => (
                                  <option key={st} value={st} className="bg-bg-surface text-text-primary">
                                    {st}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary">
                              PIN Code <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={pincode}
                              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder="Enter PIN code"
                              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                            />
                          </div>
                        </div>

                        {/* Save Address Checkbox */}
                        <div className="pt-1">
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={saveAddressForFuture}
                              onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                              className="w-4 h-4 rounded text-brand-indigo focus:ring-brand-indigo border-border-subtle bg-bg-surface-alt"
                            />
                            <span className="text-xs text-text-secondary font-medium">
                              Save this address for future orders
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 2. Delivery Options Card */}
                    <div className="bg-bg-surface rounded-3xl p-4 xs:p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)] border border-border-subtle space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
                          <Truck size={19} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-text-primary leading-tight">
                            Delivery Options
                          </h2>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Choose a delivery option that works for you
                          </p>
                        </div>
                      </div>

                      {/* 2 Option Cards side-by-side */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Standard Delivery */}
                        <div
                          onClick={() => setDeliveryOption("standard")}
                          className={`relative p-5 rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-between ${
                            deliveryOption === "standard"
                              ? "border-brand-indigo bg-brand-indigo/5 shadow-xs"
                              : "border-border-subtle hover:border-border-strong bg-bg-surface"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  deliveryOption === "standard"
                                    ? "border-brand-indigo bg-brand-indigo/10"
                                    : "border-border-strong bg-transparent"
                                }`}
                              >
                                {deliveryOption === "standard" && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-brand-indigo" />
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-primary leading-tight">
                                Standard Delivery
                              </p>
                              <p className="text-xs text-text-secondary mt-0.5">3–7 business days</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-text-primary">
                            {displaySubtotal >= 999 ? "FREE" : `₹${standardDeliveryFee}`}
                          </span>
                        </div>

                        {/* Express Delivery */}
                        <div
                          onClick={() => setDeliveryOption("express")}
                          className={`relative p-5 rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-between ${
                            deliveryOption === "express"
                              ? "border-brand-indigo bg-brand-indigo/5 shadow-xs"
                              : "border-border-subtle hover:border-border-strong bg-bg-surface"
                          }`}
                        >
                          <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-[10px] font-bold text-brand-indigo">
                            Recommended
                          </span>
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  deliveryOption === "express"
                                    ? "border-brand-indigo bg-brand-indigo/10"
                                    : "border-border-strong bg-transparent"
                                }`}
                              >
                                {deliveryOption === "express" && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-brand-indigo" />
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-primary leading-tight">
                                Express Delivery
                              </p>
                              <p className="text-xs text-text-secondary mt-0.5">1–3 business days</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-text-primary">
                            {displaySubtotal >= 999 ? "₹249" : `₹${expressDeliveryFee}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Order Notes Card */}
                    <div className="bg-bg-surface rounded-3xl p-4 xs:p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)] border border-border-subtle space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-text-primary leading-tight">
                            Order Notes <span className="text-xs font-normal text-text-muted">(Optional)</span>
                          </h2>
                        </div>
                      </div>

                      <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Any special instructions for your order..."
                        rows={2}
                        className="w-full p-3.5 rounded-2xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all resize-none"
                      />
                    </div>
                  </>
                ) : (
                  /* Step 3: Payment Method Selection */
                  <div className="bg-bg-surface rounded-3xl p-4 xs:p-6 sm:p-8 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)] border border-border-subtle space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
                          <CreditCard size={19} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-text-primary leading-tight">
                            Select Payment Method
                          </h2>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Deliver to {fullName} • {city}, {pincode}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs font-semibold text-brand-indigo hover:underline"
                      >
                        Edit Details
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Option 1: Online Payment */}
                      <div
                        onClick={() => setPaymentMethod("online")}
                        className={`p-5 rounded-2xl cursor-pointer border-2 transition-all ${
                          paymentMethod === "online"
                            ? "border-brand-indigo bg-brand-indigo/5 shadow-xs"
                            : "border-border-subtle hover:border-border-strong bg-bg-surface"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  paymentMethod === "online"
                                    ? "border-brand-indigo bg-brand-indigo/10"
                                    : "border-border-strong bg-transparent"
                                }`}
                              >
                                {paymentMethod === "online" && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-brand-indigo" />
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-text-primary">
                                  Online Payment (UPI, Cards, NetBanking)
                                </p>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                  FASTEST
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary mt-1">
                                Instant automated gateway payment via Google Pay, PhonePe, Paytm, RuPay, Visa, Mastercard, and NetBanking.
                              </p>
                            </div>
                          </div>
                          <Lock size={18} className="text-brand-indigo shrink-0 mt-0.5" />
                        </div>
                      </div>

                      {/* Option 2: Pay After Proof (Approval / COD) */}
                      <div
                        onClick={() => setPaymentMethod("cod_proof")}
                        className={`p-5 rounded-2xl cursor-pointer border-2 transition-all ${
                          paymentMethod === "cod_proof"
                            ? "border-brand-indigo bg-brand-indigo/5 shadow-xs"
                            : "border-border-subtle hover:border-border-strong bg-bg-surface"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  paymentMethod === "cod_proof"
                                    ? "border-brand-indigo bg-brand-indigo/10"
                                    : "border-border-strong bg-transparent"
                                }`}
                              >
                                {paymentMethod === "cod_proof" && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-brand-indigo" />
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-text-primary">
                                  Pay After Digital Proof Approval
                                </p>
                                <span className="px-2 py-0.5 rounded-md bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold">
                                  ZERO RISK
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary mt-1">
                                Our design team sends your final print proof on WhatsApp before printing starts. Pay securely upon your full approval.
                              </p>
                            </div>
                          </div>
                          <FileCheck size={18} className="text-text-muted shrink-0 mt-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* B2B GSTIN Toggle */}
                    <div className="pt-4 border-t border-border-subtle">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isGstRequired}
                          onChange={(e) => setIsGstRequired(e.target.checked)}
                          className="w-4 h-4 rounded text-brand-indigo focus:ring-brand-indigo border-border-subtle bg-bg-surface-alt"
                        />
                        <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                          <Building size={14} className="text-text-muted" />
                          I need a GST invoice for my business
                        </span>
                      </label>

                      {isGstRequired && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border-subtle">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-text-secondary">Company Legal Name</label>
                            <input
                              type="text"
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              placeholder="e.g. Star Press Pvt Ltd"
                              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-text-secondary">15-Digit GSTIN</label>
                            <input
                              type="text"
                              value={gstin}
                              onChange={(e) => setGstin(e.target.value.toUpperCase())}
                              placeholder="07AAAAA0000A1Z5"
                              maxLength={15}
                              className="w-full h-11 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs sm:text-sm font-mono uppercase text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Order Summary & Trust Badges */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
                {/* 1. Order Summary Card */}
                <div className="bg-bg-surface rounded-3xl p-4 xs:p-6 sm:p-7 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)] border border-border-subtle space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center shrink-0">
                        <ShoppingBag size={17} />
                      </div>
                      <h2 className="text-base font-bold text-text-primary">Order Summary</h2>
                    </div>
                    <Link
                      href="/cart"
                      className="text-xs font-semibold text-brand-indigo hover:underline"
                    >
                      Edit Cart
                    </Link>
                  </div>

                  {/* Cart Items List */}
                  <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                    {items.map((item, idx) => {
                      const sizeLabel = item.specs?.sizeLabel || (item.sizeId ? `Size: ${item.sizeId}` : null);
                      const materialLabel = item.specs?.materialLabel || (item.materialId ? item.materialId : null);
                      const customText = item.customText || item.customizations?.personalizedText;

                      return (
                        <div key={item.id || idx} className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-bg-surface-alt border border-border-subtle shrink-0">
                              <Image
                                src={item.imageSrc || "/images/placeholder.png"}
                                alt={item.name || "Custom Print"}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-bold text-text-primary leading-tight truncate">
                                {item.name || "Custom Print"}
                              </p>
                              {customText && (
                                <p className="text-[11px] text-text-secondary font-medium truncate max-w-[160px]">
                                  {customText}
                                </p>
                              )}
                              {sizeLabel && (
                                <p className="text-[11px] text-text-secondary">{sizeLabel}</p>
                              )}
                              {materialLabel && (
                                <p className="text-[11px] text-text-secondary">{materialLabel}</p>
                              )}
                              <div className="flex items-center gap-2 pt-0.5">
                                <p className="text-[11px] text-text-secondary">Qty: {item.quantity}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  ● In Stock
                                </span>
                              </div>
                            </div>
                          </div>

                          <span className="text-xs sm:text-sm font-bold text-text-primary shrink-0">
                            ₹{(Number(item.price) * item.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Promo Code Input Toggle */}
                  <div className="pt-2">
                    {!showCouponInput && !couponCode ? (
                      <button
                        type="button"
                        onClick={() => setShowCouponInput(true)}
                        className="text-xs font-semibold text-brand-indigo hover:underline flex items-center gap-1.5"
                      >
                        <Tag size={13} />
                        <span>Have a promo code?</span>
                      </button>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            placeholder="PROMO CODE"
                            className="flex-1 h-10 px-3.5 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs font-mono uppercase text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 transition-all"
                          />
                          <button
                            type="submit"
                            className="h-10 px-4 rounded-xl bg-brand-yellow text-brand-dark font-bold text-xs hover:brightness-105 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                        {couponFeedback && (
                          <p
                            className={`text-[11px] font-medium ${
                              couponFeedback.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                            }`}
                          >
                            {couponFeedback.msg}
                          </p>
                        )}
                        {couponCode && (
                          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                            <span>Code {couponCode} active</span>
                            <button
                              type="button"
                              onClick={handleRemoveCoupon}
                              className="text-text-muted hover:text-text-primary font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </form>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="pt-3 border-t border-border-subtle space-y-2 text-xs">
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Subtotal</span>
                      <span className="font-semibold text-text-primary">
                        ₹{displaySubtotal.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Delivery Charge</span>
                      <span className="font-semibold text-text-primary">
                        {deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge.toLocaleString("en-IN")}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Tax (GST)</span>
                      <span className="font-semibold text-text-primary">
                        ₹{gstAmount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount Savings</span>
                        <span className="font-semibold">-₹{discountAmount.toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                      <span className="text-sm font-bold text-text-primary">Total Amount</span>
                      <span className="text-xl font-extrabold text-text-primary">
                        ₹{grandTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Primary Call to Action Button */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleProceedClick}
                      className="w-full h-12 rounded-2xl bg-brand-indigo hover:bg-brand-indigo/90 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-brand-indigo/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 size={22} className="animate-spin text-white" />
                      ) : (
                        <span>
                          {currentStep === 2
                            ? "Proceed to Payment →"
                            : paymentMethod === "online"
                            ? `Place Order & Pay ₹${grandTotal.toLocaleString("en-IN")}`
                            : `Confirm Order (Pay After Proof)`}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                      <Lock size={12} className="text-text-muted" />
                      <span>Secure payment powered by Razorpay</span>
                    </div>
                  </div>
                </div>

                {/* 2. Trust Badges Card */}
                <div className="bg-bg-surface rounded-3xl p-5 border border-border-subtle shadow-[0_4px_25px_-5px_rgba(0,0,0,0.04)]">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Badge 1 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-tight">Secure Payments</p>
                        <p className="text-[11px] text-text-muted mt-0.5">100% safe & encrypted</p>
                      </div>
                    </div>

                    {/* Badge 2 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Truck size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-tight">Fast Delivery</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Pan India shipping</p>
                      </div>
                    </div>

                    {/* Badge 3 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-tight">Premium Quality</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Custom prints with care</p>
                      </div>
                    </div>

                    {/* Badge 4 */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <RotateCcw size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary leading-tight">Easy Returns</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Hassle free support</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />

      {/* Saved Addresses Modal */}
      {showSavedAddressesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-border-subtle max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-text-primary">Select Delivery Address</h3>
              <button
                type="button"
                onClick={() => setShowSavedAddressesModal(false)}
                className="w-8 h-8 rounded-full bg-bg-surface-alt text-text-secondary hover:text-text-primary flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {savedAddresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedAddressId === addr.id
                      ? "border-2 border-brand-indigo bg-brand-indigo/5"
                      : "border-border-subtle hover:border-border-strong bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{addr.line1}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                  <p className="text-xs text-text-muted mt-1">Phone: {addr.phone}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clean Submission Overlay (No raw background process text) */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-bg-surface rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl border border-border-subtle animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-brand-indigo/10 text-brand-indigo flex items-center justify-center mx-auto">
              <Loader2 size={36} className="animate-spin text-brand-indigo" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Processing Your Order Securely
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Verifying inventory and registering your order. Please do not close or reload this window...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Required Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl border border-border-subtle text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-brand-indigo/10 text-brand-indigo flex items-center justify-center mx-auto shadow-inner">
              <Lock size={30} className="text-brand-indigo" />
            </div>

            <div>
              <h3 className="font-display font-bold text-xl sm:text-2xl text-text-primary">
                Sign In to Complete Order
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary mt-2">
                User authentication is mandatory before placing an order. Your cart items ({items.reduce((acc, it) => acc + it.quantity, 0)} units, ₹{grandTotal.toLocaleString("en-IN")}) have been securely preserved.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-bg-surface-alt border border-border-subtle flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-text-secondary">
                <ShoppingBag size={15} className="text-brand-indigo" />
                <span>Cart Status</span>
              </div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} />
                Preserved & Safe
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => router.push("/login?callbackUrl=/checkout")}
                className="w-full h-12 rounded-xl bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-indigo/25 transition-all cursor-pointer"
              >
                <span>Sign In to Continue Checkout</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => router.push("/register?callbackUrl=/checkout")}
                className="w-full h-11 rounded-xl bg-bg-surface-alt hover:bg-border-subtle text-text-primary font-semibold text-xs transition-colors border border-border-subtle cursor-pointer"
              >
                Create New Star Press Account
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-text-muted hover:text-text-primary pt-1 font-medium transition-colors cursor-pointer"
              >
                Review Cart & Delivery Details First
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}