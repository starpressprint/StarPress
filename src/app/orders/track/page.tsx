"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Search,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Building,
  MapPin,
  ChevronRight,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { WHATSAPP_NUMBER } from "@/lib/data";

interface TrackedItem {
  productName: string;
  quantity: number;
  specs?: any;
  customText?: string;
}

interface TrackedOrder {
  orderNumber: string;
  status: string;
  createdAt: string;
  trackingNumber?: string | null;
  courierPartner?: string | null;
  items: TrackedItem[];
  shippingCity?: string;
  shippingState?: string;
}

const ORDER_STAGES = [
  { key: "PENDING", label: "Order Placed", desc: "Specifications verified & queued" },
  { key: "CONFIRMED", label: "Confirmed", desc: "Pre-press proof approved" },
  { key: "IN_PRODUCTION", label: "In Production", desc: "Printing & bindery finishing" },
  { key: "DISPATCHED", label: "Dispatched", desc: "Handed over to courier partner" },
  { key: "DELIVERED", label: "Delivered", desc: "Delivered to destination" },
];

function getStageIndex(status: string): number {
  const norm = (status || "").toUpperCase();
  if (norm === "DELIVERED") return 4;
  if (norm === "DISPATCHED" || norm === "SHIPPED") return 3;
  if (norm === "IN_PRODUCTION" || norm === "PROCESSING") return 2;
  if (norm === "CONFIRMED") return 1;
  return 0; // PENDING
}

function TrackContent() {
  const searchParams = useSearchParams();
  const { session } = useAuthSession();

  const [orderNumber, setOrderNumber] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize from search query parameters
  useEffect(() => {
    const qOrder = searchParams.get("order");
    const qContact = searchParams.get("contact") || session?.user?.phone || session?.user?.email || "";

    if (qOrder) {
      setOrderNumber(qOrder.trim().toUpperCase());
    }
    if (qContact) {
      setPhoneOrEmail(qContact.trim());
    }

    if (qOrder && qContact) {
      fetchTracking(qOrder.trim().toUpperCase(), qContact.trim());
    }
  }, [searchParams, session]);

  const fetchTracking = async (ordNum: string, contact: string) => {
    if (!ordNum.trim()) {
      setError("Please enter your Order Reference (e.g. SP-2026-XXXX).");
      return;
    }
    if (!contact.trim()) {
      setError("Please enter the Mobile Phone or Email associated with the order.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: ordNum.trim().toUpperCase(),
          phoneOrEmail: contact.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.order) {
        setError(data.error || "No matching order found for this order reference and contact detail.");
        setOrder(null);
      } else {
        setOrder(data.order);
      }
    } catch {
      setError("Unable to connect to tracking service. Please try again.");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(orderNumber, phoneOrEmail);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeStage = order ? getStageIndex(order.status) : 0;
  const isCancelled = order?.status?.toUpperCase() === "CANCELLED";

  const whatsappInquiry = encodeURIComponent(
    `Hi Star Press team! I am checking on the status of Order #${order?.orderNumber || orderNumber}. Please share the latest update.`
  );

  return (
    <div className="max-w-[1000px] w-full mx-auto px-4 xs:px-6 py-8 sm:py-10 md:py-16 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow text-xs font-bold uppercase tracking-wider">
          <Truck size={14} />
          <span>Real-Time Shipment & Press Tracker</span>
        </div>
        <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-4xl text-text-primary uppercase tracking-tight break-words">
          Track Your Print Order
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto">
          Enter your Star Press order number and verified contact details to view live
          press proofing, manufacturing progress, and courier transit.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4 xs:p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-text-secondary uppercase">
                Order Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SP-2026-A1B2"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-primary uppercase font-mono placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-text-secondary uppercase">
                Phone Number or Email *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 9876543210 or name@example.com"
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isLoading || !orderNumber.trim() || !phoneOrEmail.trim()}
            className="w-full justify-center text-xs uppercase font-bold tracking-wider py-3"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-black" />
                <span>Locating Order Dispatch...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Search size={15} />
                <span>Track Order Status</span>
              </span>
            )}
          </Button>
        </form>
      </div>

      {/* Tracking Result View */}
      {order && (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-8 shadow-2xl animate-fadeIn">
          {/* Top Bar with Order Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">Order Reference:</span>
                <span className="font-mono font-black text-brand-yellow text-lg">
                  {order.orderNumber}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(order.orderNumber)}
                  className="text-text-muted hover:text-text-primary p-1 rounded transition-colors"
                  title="Copy Order Number"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="text-xs text-text-muted mt-1">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isCancelled
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  : activeStage === 4
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow"
              }`}>
                <Clock size={13} />
                <span>Status: {isCancelled ? "Cancelled" : ORDER_STAGES[activeStage]?.label || order.status}</span>
              </span>
            </div>
          </div>

          {/* Graphical Amazon-Style Stepper */}
          {!isCancelled ? (
            <div className="py-4">
              <div className="relative">
                {/* Connecting Line */}
                <div className="hidden sm:block absolute top-5 left-10 right-10 h-1 bg-bg-surface-alt -z-0">
                  <div
                    className="h-full bg-brand-yellow transition-all duration-500"
                    style={{ width: `${(activeStage / (ORDER_STAGES.length - 1)) * 100}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2 relative z-10">
                  {ORDER_STAGES.map((stg, idx) => {
                    const isDone = activeStage > idx;
                    const isCurrent = activeStage === idx;

                    return (
                      <div key={stg.key} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                          isDone
                            ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                            : isCurrent
                            ? "bg-brand-yellow text-black ring-4 ring-brand-yellow/20 shadow-lg scale-110"
                            : "bg-bg-surface-alt border border-border-subtle text-text-muted"
                        }`}>
                          {isDone ? <Check size={16} className="stroke-[3]" /> : idx + 1}
                        </div>

                        <div>
                          <div className={`text-xs font-bold uppercase tracking-wider ${
                            isCurrent ? "text-brand-yellow" : isDone ? "text-text-primary" : "text-text-muted"
                          }`}>
                            {stg.label}
                          </div>
                          <div className="text-[11px] text-text-muted hidden sm:block mt-0.5">
                            {stg.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
              This order has been cancelled. Any pre-payments or security deposits have been processed for reversal.
            </div>
          )}

          {/* Courier Dispatch Card (if dispatched or has tracking) */}
          {(order.trackingNumber || order.courierPartner) && (
            <div className="p-5 rounded-2xl bg-bg-surface-alt border border-brand-yellow/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-yellow flex items-center gap-1.5">
                  <Truck size={14} />
                  <span>Courier Partner Handover</span>
                </span>
                <p className="text-sm font-semibold text-text-primary">
                  Carrier: {order.courierPartner || "Bluedart / Delhivery / DTDC Express"}
                </p>
                <div className="text-xs text-text-secondary flex items-center gap-2 font-mono">
                  <span>AWB Number:</span>
                  <strong className="text-text-primary">{order.trackingNumber}</strong>
                </div>
              </div>

              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappInquiry}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-bg-surface hover:bg-border-subtle border border-border-subtle text-text-primary text-xs font-bold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <span>Courier Updates on WhatsApp</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}

          {/* Itemized Packages Breakdown */}
          <div className="space-y-3 pt-2 border-t border-border-subtle">
            <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
              Items in this Shipment ({order.items.length})
            </h3>

            <div className="divide-y divide-border-subtle/60 rounded-xl border border-border-subtle bg-bg-surface-alt overflow-hidden">
              {order.items.map((it, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center text-text-muted shrink-0">
                      <Package size={16} />
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary block">{it.productName}</span>
                      {it.customText && (
                        <span className="text-[11px] text-amber-300 italic block">
                          &ldquo;{it.customText}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-mono font-bold text-brand-yellow shrink-0">
                    Qty: {it.quantity.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Help & Actions Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border-subtle">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappInquiry}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#25D366] hover:underline"
            >
              <MessageCircle size={15} />
              <span>Need help with this order? Chat with Pre-Press Team</span>
            </a>

            <div className="flex items-center gap-4 text-xs">
              <Link href="/shop" className="text-text-secondary hover:text-text-primary transition-colors">
                Return to Shop
              </Link>
              <span className="text-border-subtle">|</span>
              <Link href="/account" className="text-brand-yellow hover:underline font-medium">
                My Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-24 text-center text-xs text-text-secondary flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand-yellow" />
              <span>Loading tracking portal...</span>
            </div>
          }
        >
          <TrackContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
