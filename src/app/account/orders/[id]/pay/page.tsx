"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  RefreshCw,
  MessageCircle,
  HelpCircle,
  Lock,
  Package,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuthSession";

interface OrderDetail {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestEmail: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: number;
  subtotal: number;
  gstAmount: number | null;
  shippingFee: number;
  discountAmount: number;
  shippingAddress: any;
  paymentExpiresAt?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

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

export default function OrderPayRecoveryPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || "";
  const { session, status, isHydrated } = useAuthSession();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // 1. Fetch order details
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    async function fetchOrder() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();

        if (!res.ok || !data.order) {
          throw new Error(data.error || "Order not found");
        }

        if (isMounted) {
          setOrder(data.order);
          if (data.order.paymentStatus === "PAID") {
            setPaymentSuccess(true);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Failed to load order details.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Auth gate
  useEffect(() => {
    if (!isHydrated || status === "loading") return;
    if (status === "unauthenticated" && !session?.user) {
      router.replace(`/login?callbackUrl=/account/orders/${orderId}/pay`);
    }
  }, [isHydrated, status, session, router, orderId]);

  const isExpired = Boolean(
    order?.paymentExpiresAt && new Date() > new Date(order.paymentExpiresAt)
  );

  // 2. Initiate Payment Retry
  const handleInitiatePayment = async () => {
    if (!order) return;
    setErrorMessage(null);
    setStatusNote("Initializing secure gateway session...");
    setIsProcessingPayment(true);

    try {
      // Call retry API
      const retryRes = await fetch("/api/payments/razorpay/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const retryData = await retryRes.json();

      if (!retryRes.ok || !retryData.success) {
        throw new Error(retryData.error || "Failed to prepare payment gateway.");
      }

      // Handle Dev Mock
      if (retryData.isMock) {
        setStatusNote("Processing simulated test payment...");
        const verifyRes = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            razorpay_order_id: retryData.razorpayOrderId,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: "mock_signature",
          }),
        });
        const vData = await verifyRes.json();
        if (vData.success) {
          setPaymentSuccess(true);
          setStatusNote(null);
          return;
        }
        throw new Error(vData.error || "Mock payment verification failed.");
      }

      // Load Razorpay SDK
      setStatusNote("Connecting to Razorpay...");
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        throw new Error("Unable to load Razorpay SDK. Please check your internet connection.");
      }

      const shipping = order.shippingAddress || {};
      const options = {
        key: retryData.keyId,
        amount: retryData.amount,
        currency: retryData.currency || "INR",
        name: "Star Press",
        description: `Print Order #${order.orderNumber}`,
        order_id: retryData.razorpayOrderId,
        prefill: {
          name: shipping.fullName || session?.user?.name || "",
          email: shipping.email || session?.user?.email || "",
          contact: shipping.phone || session?.user?.phone || "",
        },
        theme: {
          color: "#FFCF1B",
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            setStatusNote(null);
            setErrorMessage("Payment window was closed. Your order is reserved — click below to retry.");
          },
        },
        handler: async function (response: any) {
          setStatusNote("Verifying payment capture with server...");
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed. If your account was debited, it will be automatically confirmed shortly.");
            }

            setPaymentSuccess(true);
            setStatusNote(null);
          } catch (err: any) {
            setErrorMessage(err.message || "Payment verification failed. Please contact support.");
          } finally {
            setIsProcessingPayment(false);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        setIsProcessingPayment(false);
        setStatusNote(null);
        const desc = resp.error?.description || "Payment failed at issuing bank.";
        setErrorMessage(`Transaction declined: ${desc}. Please try another card, UPI, or netbanking.`);
      });

      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
      setIsProcessingPayment(false);
      setStatusNote(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-10 md:py-14 space-y-8">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/account?tab=orders"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Orders</span>
          </Link>
          <span className="text-xs text-text-muted">Instant Payment Recovery</span>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="rounded-3xl border border-border-subtle bg-bg-surface p-12 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-text-muted">Retrieving order details and security token...</p>
          </div>
        ) : !order ? (
          <div className="rounded-3xl border border-border-subtle bg-bg-surface p-10 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="font-display font-black text-xl text-white">Order Not Found</h2>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              We could not find this order. It may have been deleted or the link is incorrect.
            </p>
            <Button variant="primary" size="md" href="/account?tab=orders">
              Return to Orders
            </Button>
          </div>
        ) : paymentSuccess ? (
          /* Payment Success State */
          <div className="rounded-3xl border border-emerald-500/30 bg-bg-surface p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Payment Confirmed
              </span>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white mt-3">
                Payment Successful!
              </h1>
              <p className="text-xs text-text-secondary max-w-md mx-auto mt-2">
                Order <strong className="text-white font-mono">#{order.orderNumber}</strong> has been marked as PAID and routed directly to print production.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-border-subtle bg-bg-surface-alt max-w-sm mx-auto text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Amount Paid:</span>
                <span className="font-mono font-bold text-brand-yellow">₹{Number(order.totalAmount).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Payment Method:</span>
                <span className="font-bold text-white">Razorpay Online</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="md" href="/account?tab=orders">
                View in Order History
              </Button>
              <Button variant="secondary" size="md" href="/shop">
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : isExpired ? (
          /* Expired State */
          <div className="rounded-3xl border border-red-500/30 bg-bg-surface p-8 sm:p-12 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Clock size={36} />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
                Payment Window Expired
              </span>
              <h1 className="font-display font-black text-2xl text-white mt-3">
                Order Payment Expired
              </h1>
              <p className="text-xs text-text-secondary max-w-md mx-auto mt-2">
                The 24-hour payment window for order <strong className="text-white font-mono">#{order.orderNumber}</strong> has expired. Unpaid orders are automatically cancelled to release production queue slots.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="primary" size="md" href="/shop">
                Place New Order
              </Button>
              <Button variant="secondary" size="md" href="/contact">
                Contact Support
              </Button>
            </div>
          </div>
        ) : (
          /* Ready to Pay / Recovery View */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-3xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-display font-black text-xl text-white">
                      Complete Payment
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Payment Pending
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Order <strong className="font-mono text-white">#{order.orderNumber}</strong> • Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-text-muted uppercase block">Amount Due</span>
                  <span className="font-mono font-black text-2xl text-brand-yellow">
                    ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Status or Error Alerts */}
              {errorMessage && (
                <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-200">Payment Could Not Be Completed</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {statusNote && (
                <div className="p-4 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/10 text-xs text-brand-yellow flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>{statusNote}</span>
                </div>
              )}

              {/* Order Items Summary */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Items in this order ({order.items.length})
                </span>
                <div className="space-y-2 rounded-2xl border border-border-subtle bg-bg-surface-alt p-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">
                        {item.productName} × <strong className="text-white font-mono">{item.quantity}</strong>
                      </span>
                      <span className="font-mono text-white">
                        ₹{Number(item.lineTotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border-subtle/80 flex justify-between text-xs text-text-muted">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">₹{Number(order.subtotal).toLocaleString("en-IN")}</span>
                  </div>
                  {order.gstAmount && (
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>GST (18%):</span>
                      <span className="font-mono text-white">₹{Number(order.gstAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(order.shippingFee) > 0 && (
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Shipping Fee:</span>
                      <span className="font-mono text-white">₹{Number(order.shippingFee).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{Number(order.discountAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleInitiatePayment}
                  disabled={isProcessingPayment}
                  className="w-full py-4 px-6 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-black font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-brand-yellow/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessingPayment ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Processing Gateway Session...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      <span>Pay ₹{Number(order.totalAmount).toLocaleString("en-IN")} via Razorpay</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-6 text-[11px] text-text-muted pt-2">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    256-bit SSL Bank Encryption
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Lock size={12} className="text-brand-yellow" />
                    UPI, Cards, Netbanking, Wallets
                  </span>
                </div>
              </div>
            </div>

            {/* Assistance & Fallback */}
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-brand-yellow" />
                  Having trouble paying?
                </span>
                <p className="text-[11px] text-text-secondary">
                  If your bank debited the amount or you encounter payment gateway issues, message our priority support team on WhatsApp.
                </p>
              </div>

              <a
                href={`https://wa.me/919999999999?text=Hi%2C%20I%20need%20help%20completing%20payment%20for%20Star%20Press%20Order%20%23${order.orderNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl border border-border-subtle bg-bg-surface-alt hover:border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
              >
                <MessageCircle size={14} />
                <span>WhatsApp Support</span>
              </a>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
