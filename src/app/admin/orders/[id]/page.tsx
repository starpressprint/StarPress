'use client';

// =============================================================================
// /admin/orders/[id] — Full Order Detail & Fulfillment Page for StarPress
// Features: Order summary, timeline, item specs, courier tracking, GST invoice print
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Printer, Truck, CheckCircle2, Clock,
  Package, User, Mail, Phone, MapPin, CreditCard,
  Calendar, ExternalLink, Save, FileText, AlertCircle,
  Loader2, Check, Copy, ShieldAlert, RotateCcw,
  MessageCircle, Send, X
} from 'lucide-react';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import { showToast } from '@/components/admin/ui/Toast';
import { orderService } from '@/lib/admin/services';
import type { AdminOrder, OrderStatus } from '@/lib/admin/types';
import {
  getOrderNotificationText,
  buildWhatsAppClickUrl,
  OrderNotificationType,
} from '@/lib/notifications/order-messages';

const COURIER_OPTIONS = [
  'Shiprocket',
  'BlueDart',
  'Delhivery',
  'DTDC',
  'India Post',
  'Ekart',
  'Shadowfax',
  'Hand Delivery / Local Pickup',
];

const ORDER_STEPS = [
  { key: 'pending', label: 'Order Placed', desc: 'Customer completed order checkout' },
  { key: 'processing', label: 'In Production', desc: 'Pre-press proof & printing underway' },
  { key: 'shipped', label: 'Dispatched', desc: 'Handed over to courier partner' },
  { key: 'delivered', label: 'Delivered', desc: 'Successfully received by customer' },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states for updates
  const [status, setStatus] = useState<string>('pending');
  const [courierPartner, setCourierPartner] = useState<string>('Shiprocket');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const handleManualMarkPaid = async () => {
    if (!order) return;
    if (!window.confirm(`Mark Order #${order.orderNumber} as PAID? This audit action is logged.`)) return;

    setIsMarkingPaid(true);
    try {
      const res = await orderService.markOrderPaid(order.id);
      if (res.success) {
        showToast(res.message || `Order #${order.orderNumber} marked as PAID`);
        loadOrder();
      } else {
        showToast(res.message || 'Failed to mark order as paid', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error marking order as paid', 'error');
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Notification Modal States
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyType, setNotifyType] = useState<OrderNotificationType>('shipped');
  const [notifyChannel, setNotifyChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySending, setNotifySending] = useState(false);

  const openNotificationModal = (channel: 'whatsapp' | 'email', type: OrderNotificationType) => {
    if (!order) return;
    setNotifyChannel(channel);
    setNotifyType(type);
    const text = getOrderNotificationText(type, {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      total: order.total,
      status: status || order.status,
      courierPartner: courierPartner || order.courierPartner,
      trackingNumber: trackingNumber || order.trackingNumber,
    });
    setNotifyMessage(text);
    setNotifyModalOpen(true);
  };

  const handleSendNotification = async () => {
    if (notifyChannel === 'whatsapp') {
      if (!order?.customerPhone) {
        showToast('No customer phone number recorded for this order', 'error');
        return;
      }
      const url = buildWhatsAppClickUrl(order.customerPhone, notifyMessage);
      window.open(url, '_blank');
      setNotifyModalOpen(false);
      showToast('WhatsApp chat window opened', 'success');
      return;
    }

    // Email dispatch
    setNotifySending(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          type: notifyType,
          customMessage: notifyMessage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.sent
            ? 'Customer update email dispatched successfully'
            : 'Email notification logged in order records',
          'success'
        );
        setNotifyModalOpen(false);
      } else {
        showToast(data.error || 'Failed to dispatch email', 'error');
      }
    } catch {
      showToast('Error sending customer notification', 'error');
    } finally {
      setNotifySending(false);
    }
  };

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
        setStatus(data.order.status || 'pending');
        setCourierPartner(data.order.courierPartner || 'Shiprocket');
        setTrackingNumber(data.order.trackingNumber || '');
        setInternalNotes(data.order.notes || '');
      } else {
        showToast(data.error || 'Order not found', 'error');
      }
    } catch {
      showToast('Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleSaveFulfillment = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          courierPartner,
          trackingNumber,
          notes: internalNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Order details and fulfillment updated', 'success');
        loadOrder();
      } else {
        showToast(data.error || 'Failed to update order', 'error');
      }
    } catch {
      showToast('Error saving updates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyOrderNumber = () => {
    if (order?.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Order number copied to clipboard', 'info');
    }
  };

  // Determine current timeline progress index
  const getStepIndex = (st: string) => {
    const s = st.toLowerCase();
    if (s === 'delivered') return 3;
    if (s === 'shipped' || s === 'dispatched') return 2;
    if (s === 'processing' || s === 'confirmed' || s === 'in_production') return 1;
    return 0;
  };

  const currentStepIndex = getStepIndex(status);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-text-muted gap-3">
        <Loader2 size={32} className="animate-spin text-brand-yellow" />
        <p className="text-sm">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle size={48} className="mx-auto text-red-400" />
        <h2 className="text-xl font-bold text-white">Order Not Found</h2>
        <p className="text-sm text-text-muted">
          The requested order could not be located in StarPress database.
        </p>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.1] text-xs font-semibold"
        >
          <ArrowLeft size={14} /> Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Non-print Header & Action Bar */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/[0.06] border border-border-subtle transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {order.orderNumber}
              </h1>
              <button
                onClick={copyOrderNumber}
                className="text-text-muted hover:text-white p-1"
                title="Copy order number"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <StatusBadge status={order.status} />
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                order.paymentStatus === 'paid'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
              <Calendar size={13} />
              Placed on {new Date(order.date).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.paymentStatus !== 'paid' && order.paymentMethod === 'PAY_AFTER_PROOF' && (
            <button
              onClick={handleManualMarkPaid}
              disabled={isMarkingPaid}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors disabled:opacity-50"
              title="Confirm payment received offline (audit logged)"
            >
              {isMarkingPaid ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Mark as Paid
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-border-subtle transition-colors"
          >
            <Printer size={15} />
            Print GST Invoice
          </button>
          <button
            onClick={handleSaveFulfillment}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Workflow Progress Timeline (Hidden on Print) */}
      <div className="print:hidden bg-card border border-border-subtle rounded-xl p-5">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
          Order Production & Fulfillment Workflow
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
          {ORDER_STEPS.map((step, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.key}
                onClick={() => setStatus(step.key)}
                className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-brand-yellow/10 border-brand-yellow/50 text-white'
                    : isCompleted
                    ? 'bg-emerald-500/[0.06] border-emerald-500/30 text-white'
                    : 'bg-white/[0.02] border-border-subtle text-text-muted hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Step {idx + 1}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <Clock size={16} className="opacity-40" />
                  )}
                </div>
                <p className="font-semibold text-sm text-white">{step.label}</p>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Items & Financials | Right Customer & Fulfillment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table */}
          <div className="bg-card border border-border-subtle rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
              <span>Order Items ({order.itemCount} items)</span>
              <span className="text-xs text-text-muted font-normal">
                Curated for custom print production
              </span>
            </h3>

            <div className="divide-y divide-border-subtle">
              {order.items.map((it: any) => (
                <div key={it.id} className="py-4 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-white/[0.04] border border-border-subtle overflow-hidden shrink-0 flex items-center justify-center">
                    {it.image ? (
                      <img src={it.image} alt={it.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={24} className="text-text-muted/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{it.productName}</p>
                    <p className="text-xs text-text-muted mt-0.5 font-mono">{it.sku}</p>

                    {/* Custom specifications / artwork */}
                    {it.specs && (
                      <div className="mt-2 text-xs bg-white/[0.03] p-2.5 rounded-lg border border-border-subtle space-y-1">
                        {Object.entries(it.specs).map(([key, val]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-text-muted capitalize">{key}:</span>
                            <span className="text-text-secondary font-medium">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {it.customText && (
                      <p className="text-xs text-text-secondary mt-1.5 bg-brand-yellow/5 p-2 rounded border border-brand-yellow/10">
                        <span className="font-medium text-brand-yellow">Custom Text:</span> {it.customText}
                      </p>
                    )}

                    {it.artworkUrl && (
                      <div className="mt-2">
                        <a
                          href={it.artworkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-brand-yellow hover:underline"
                        >
                          <ExternalLink size={13} />
                          Download Customer Artwork File
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">
                      ₹{new Intl.NumberFormat('en-IN').format(it.total)}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      ₹{new Intl.NumberFormat('en-IN').format(it.unitPrice)} × {it.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="mt-4 pt-4 border-t border-border-subtle space-y-2 text-xs">
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span>₹{new Intl.NumberFormat('en-IN').format(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>GST (18% Goods & Services Tax)</span>
                <span>₹{new Intl.NumberFormat('en-IN').format(order.tax)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Shipping & Handling</span>
                <span>{order.shipping > 0 ? `₹${new Intl.NumberFormat('en-IN').format(order.shipping)}` : 'FREE'}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount Applied</span>
                  <span>-₹{new Intl.NumberFormat('en-IN').format(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-border-subtle">
                <span>Total Amount Paid</span>
                <span className="text-brand-yellow text-base">₹{new Intl.NumberFormat('en-IN').format(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Internal Notes Card */}
          <div className="print:hidden bg-card border border-border-subtle rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <FileText size={16} className="text-brand-yellow" />
              Internal Production Notes
            </h3>
            <p className="text-xs text-text-muted mb-3">
              Visible only to StarPress staff. Include pre-press instructions, paper stock details, or courier references.
            </p>
            <textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="e.g. 350 GSM Matte Lamination approved. Ship with waterproof corner guards."
              className="w-full bg-white/[0.04] border border-border-subtle rounded-lg p-3 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow/50 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Right Column (1 Col): Customer & Dispatch */}
        <div className="space-y-6">
          {/* Dispatch & Fulfillment Card */}
          <div className="print:hidden bg-card border border-border-subtle rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Truck size={16} className="text-brand-yellow" />
              Dispatch & Fulfillment
            </h3>

            {/* Status Selector */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white/[0.04] border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-yellow/50 cursor-pointer"
              >
                <option value="pending" className="bg-[#0F1420]">Pending</option>
                <option value="processing" className="bg-[#0F1420]">In Production / Processing</option>
                <option value="shipped" className="bg-[#0F1420]">Dispatched / Shipped</option>
                <option value="delivered" className="bg-[#0F1420]">Delivered</option>
                <option value="cancelled" className="bg-[#0F1420]">Cancelled</option>
              </select>
            </div>

            {/* Courier Partner */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Courier Partner
              </label>
              <select
                value={courierPartner}
                onChange={(e) => setCourierPartner(e.target.value)}
                className="w-full bg-white/[0.04] border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-yellow/50 cursor-pointer"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#0F1420]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Tracking Number */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                AWB / Tracking Number
              </label>
              <input
                type="text"
                placeholder="e.g. 14325890423"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full bg-white/[0.04] border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow/50 font-mono"
              />
            </div>

            <button
              onClick={handleSaveFulfillment}
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Update Fulfillment
            </button>
          </div>

          {/* Customer Details */}
          <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <User size={16} className="text-brand-yellow" />
                Customer Information
              </h3>
              <Link
                href={`/admin/customers/${encodeURIComponent(order.customerEmail || order.userId || order.customerPhone || 'customer')}`}
                className="text-xs text-brand-yellow hover:underline flex items-center gap-1 font-medium"
              >
                Profile & LTV <ExternalLink size={12} />
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5 text-white font-medium">
                <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-text-secondary shrink-0">
                  <User size={14} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{order.customerName}</p>
                  <p className="text-text-muted text-[11px]">Direct Customer</p>
                </div>
              </div>

              {order.customerEmail && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail size={14} className="text-text-muted shrink-0" />
                  <a href={`mailto:${order.customerEmail}`} className="hover:text-white transition-colors truncate">
                    {order.customerEmail}
                  </a>
                </div>
              )}

              {order.customerPhone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone size={14} className="text-text-muted shrink-0" />
                  <a href={`tel:${order.customerPhone}`} className="hover:text-white transition-colors">
                    {order.customerPhone}
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin size={13} className="text-brand-yellow" />
                Shipping Destination
              </p>
              <p className="text-xs text-text-secondary leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-border-subtle">
                {order.shippingAddress || 'No address provided'}
              </p>
            </div>

            <div className="pt-3 border-t border-border-subtle">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={13} className="text-brand-yellow" />
                  Payment Method
                </p>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                  order.paymentStatus === 'paid'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
              <p className="text-xs text-text-secondary uppercase font-mono">
                {order.paymentMethod || 'Online Gateway / Razorpay'}
              </p>
              {order.paymentStatus !== 'paid' && order.paymentMethod === 'PAY_AFTER_PROOF' && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[11px] text-amber-300 mb-2">
                    Pay-after-proof awaiting offline payment verification.
                  </p>
                  <button
                    onClick={handleManualMarkPaid}
                    disabled={isMarkingPaid}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {isMarkingPaid ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Confirm Offline Payment
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Customer Notifications & WhatsApp Automation */}
          <div className="print:hidden bg-card border border-border-subtle rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageCircle size={16} className="text-[#25D366]" />
                Customer Alerts & WhatsApp
              </h3>
              <span className="text-[10px] uppercase font-bold text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full border border-[#25D366]/20">
                Automated
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Trigger instant order status updates directly to customer’s WhatsApp or registered email address.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => openNotificationModal('whatsapp', 'shipped')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle text-xs text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#25D366]/20 text-[#25D366] flex items-center justify-center">
                    <Truck size={13} />
                  </div>
                  <span className="font-medium">WhatsApp: Dispatched + AWB Tracking</span>
                </div>
                <ExternalLink size={13} className="text-text-muted group-hover:text-white" />
              </button>

              <button
                onClick={() => openNotificationModal('whatsapp', 'in_production')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle text-xs text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Clock size={13} />
                  </div>
                  <span className="font-medium">WhatsApp: In Production Alert</span>
                </div>
                <ExternalLink size={13} className="text-text-muted group-hover:text-white" />
              </button>

              <button
                onClick={() => openNotificationModal('whatsapp', 'confirmed')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle text-xs text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={13} />
                  </div>
                  <span className="font-medium">WhatsApp: Order Confirmation</span>
                </div>
                <ExternalLink size={13} className="text-text-muted group-hover:text-white" />
              </button>

              <button
                onClick={() => openNotificationModal('email', 'shipped')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-border-subtle text-xs text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Mail size={13} />
                  </div>
                  <span className="font-medium">Email: Send Transactional Update</span>
                </div>
                <Send size={13} className="text-text-muted group-hover:text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable GST Invoice (Only renders clearly on window.print()) */}
      <div className="hidden print:block print:bg-white print:text-black print:p-8 print:w-full">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">STARPRESS</h1>
            <p className="text-xs text-gray-600">Premium Commercial & Business Printing</p>
            <p className="text-xs text-gray-600">GSTIN: 07AAACS1429B1Z8</p>
            <p className="text-xs text-gray-600">Official Store Invoice | Star Press</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold">TAX INVOICE</h2>
            <p className="text-xs font-mono">Invoice #: {order.orderNumber}</p>
            <p className="text-xs">Date: {new Date(order.date).toLocaleDateString('en-IN')}</p>
            <p className="text-xs">Status: {order.paymentStatus?.toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
          <div>
            <p className="font-bold text-gray-700 uppercase mb-1">Billed & Shipped To:</p>
            <p className="font-semibold">{order.customerName}</p>
            <p>{order.shippingAddress}</p>
            <p>Phone: {order.customerPhone}</p>
            <p>Email: {order.customerEmail}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-700 uppercase mb-1">Dispatch Details:</p>
            <p>Courier: {order.courierPartner || 'StarPress Logistics'}</p>
            <p>Tracking AWB: {order.trackingNumber || 'Pending'}</p>
            <p>Payment: {order.paymentMethod}</p>
          </div>
        </div>

        <table className="w-full text-left text-xs mb-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2">Item Description</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {order.items.map((it: any) => (
              <tr key={it.id}>
                <td className="py-2">
                  <p className="font-medium">{it.productName}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{it.sku}</p>
                </td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN').format(it.unitPrice)}</td>
                <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN').format(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-4 flex justify-end text-xs">
          <div className="w-64 space-y-1 text-right">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{new Intl.NumberFormat('en-IN').format(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (18%):</span>
              <span>₹{new Intl.NumberFormat('en-IN').format(order.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>{order.shipping > 0 ? `₹${new Intl.NumberFormat('en-IN').format(order.shipping)}` : 'FREE'}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Total:</span>
              <span>₹{new Intl.NumberFormat('en-IN').format(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-[10px] text-gray-500 border-t border-gray-300 pt-4">
          <p>Thank you for choosing StarPress for your commercial print solutions!</p>
          <p>This is a computer-generated tax invoice. No signature required.</p>
        </div>
      </div>

      {/* Notification Preview & Send Modal */}
      {notifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0F1420] border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  notifyChannel === 'whatsapp' ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {notifyChannel === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {notifyChannel === 'whatsapp' ? 'Send WhatsApp Message' : 'Send Email Notification'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    To: {order.customerName} ({notifyChannel === 'whatsapp' ? order.customerPhone || 'No phone' : order.customerEmail || 'No email'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifyModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Message Content Preview (Editable)
                </label>
                <textarea
                  rows={8}
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-lg p-3 text-xs text-white placeholder-text-muted focus:outline-none focus:border-brand-yellow/50 font-mono leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setNotifyModalOpen(false)}
                  disabled={notifySending}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendNotification}
                  disabled={notifySending}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm ${
                    notifyChannel === 'whatsapp'
                      ? 'bg-[#25D366] text-black hover:bg-[#20bd5a]'
                      : 'bg-brand-yellow text-black hover:bg-[#FFE04D]'
                  }`}
                >
                  {notifySending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Sending...
                    </>
                  ) : notifyChannel === 'whatsapp' ? (
                    <>
                      <MessageCircle size={14} />
                      Open WhatsApp Web
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send Email Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
