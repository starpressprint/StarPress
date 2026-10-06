'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Search,
  X,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Save,
  ExternalLink,
  AlertCircle,
  Copy,
  Phone,
  Mail,
  MapPin,
  Check,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import Pagination from '@/components/admin/ui/Pagination';
import StatCard from '@/components/admin/ui/StatCard';
import EmptyState from '@/components/admin/ui/EmptyState';
import { Skeleton, SkeletonTableRow } from '@/components/admin/ui/Skeleton';
import { showToast } from '@/components/admin/ui/Toast';
import { orderService } from '@/lib/admin/services';
import type { AdminOrder, OrderStatus } from '@/lib/admin/types';

type StatusTab = 'all' | OrderStatus;

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Status and tracking state in drawer
  const [drawerStatus, setDrawerStatus] = useState<string>('pending');
  const [drawerTracking, setDrawerTracking] = useState<string>('');
  const [drawerCourier, setDrawerCourier] = useState<string>('Shiprocket');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  const [orderStats, setOrderStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await orderService.getOrders({
        search: debouncedSearch,
        status: statusTab,
        paymentStatus: paymentFilter as any,
        page,
        pageSize: 10,
      });
      setOrders(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (result.stats && result.stats.total > 0) {
        setOrderStats(result.stats);
      } else if (result.data.length > 0 || result.total > 0) {
        const totalCount = Math.max(result.total, result.data.length);
        const pendingCount = result.data.filter((o) => o.status === 'pending').length;
        const processingCount = result.data.filter((o) => o.status === 'processing').length;
        const shippedCount = result.data.filter((o) => o.status === 'shipped').length;
        const deliveredCount = result.data.filter((o) => o.status === 'delivered').length;
        const cancelledCount = result.data.filter((o) => o.status === 'cancelled').length;
        const refundedCount = result.data.filter((o) => o.status === 'refunded').length;

        setOrderStats((prev) => ({
          total: Math.max(prev.total, totalCount),
          pending: prev.pending || pendingCount,
          processing: prev.processing || processingCount,
          shipped: prev.shipped || shippedCount,
          delivered: prev.delivered || deliveredCount,
          cancelled: prev.cancelled || cancelledCount,
          refunded: prev.refunded || refundedCount,
        }));
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusTab, paymentFilter, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusTab, paymentFilter]);

  // Sync drawer form state when order is selected
  useEffect(() => {
    if (selectedOrder) {
      setDrawerStatus(selectedOrder.status);
      setDrawerTracking(selectedOrder.trackingNumber || '');
      setDrawerCourier(selectedOrder.courierPartner || 'Shiprocket');
    }
  }, [selectedOrder]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast(`Copied ${field} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUpdateOrderStatus = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const res = await orderService.updateOrderStatus(selectedOrder.id, drawerStatus, {
        trackingNumber: drawerTracking,
        courierPartner: drawerCourier,
      });

      if (res.success) {
        showToast(`Order ${selectedOrder.orderNumber} updated to ${drawerStatus.toUpperCase()}`);
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: drawerStatus as any,
                trackingNumber: drawerTracking,
                courierPartner: drawerCourier,
              }
            : null
        );
        loadOrders();
      } else {
        showToast('Failed to update order status', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error updating order', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualMarkPaid = async () => {
    if (!selectedOrder) return;
    const confirmMsg = `Are you sure you want to mark Order #${selectedOrder.orderNumber} as PAID? This audit action is logged.`;
    if (!window.confirm(confirmMsg)) return;

    setIsMarkingPaid(true);
    try {
      const res = await orderService.markOrderPaid(selectedOrder.id);
      if (res.success) {
        showToast(res.message || `Order #${selectedOrder.orderNumber} marked as PAID`);
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: 'paid' as any,
                status: 'confirmed' as any,
              }
            : null
        );
        loadOrders();
      } else {
        showToast(res.message || 'Failed to mark order as paid', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error marking order as paid', 'error');
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleIssueRefund = async () => {
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      showToast('A refund reason is required', 'error');
      return;
    }

    setIsSubmittingRefund(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: refundReason.trim(),
          amount: refundAmount.trim() ? Number(refundAmount) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to issue refund');
      }

      showToast(`Refund of ₹${data.amount} initiated successfully.`);
      setRefundModalOpen(false);
      setRefundReason('');
      setRefundAmount('');
      loadOrders();
    } catch (err: any) {
      showToast(err.message || 'Refund failed', 'error');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat('en-IN').format(n);
  const totalDisplay = Math.max(orderStats.total, total, orders.length);

  const PAYMENT_FILTERS = [
    { key: 'all', label: 'All Payments' },
    { key: 'unpaid', label: 'UNPAID' },
    { key: 'paid', label: 'PAID' },
    { key: 'pay_after_proof', label: 'PAY AFTER PROOF' },
  ];

  const STATUS_TABS: { key: StatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Orders', count: totalDisplay },
    { key: 'pending', label: 'Pending', count: orderStats.pending },
    { key: 'processing', label: 'Processing', count: orderStats.processing },
    { key: 'shipped', label: 'Shipped', count: orderStats.shipped },
    { key: 'delivered', label: 'Delivered', count: orderStats.delivered },
    { key: 'cancelled', label: 'Cancelled', count: orderStats.cancelled },
    { key: 'refunded', label: 'Refunded', count: orderStats.refunded },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Customer Orders</h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold">
              {totalDisplay} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Dispatch printing jobs, assign courier AWB tracking, and track fulfillment in real time.
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-brand-yellow' : ''} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          icon={ShoppingCart}
          title="Total Orders"
          value={totalDisplay.toString()}
          iconColor="text-blue-400"
        />
        <StatCard
          icon={Clock}
          title="Pending Action"
          value={orderStats.pending.toString()}
          iconColor="text-amber-400"
          period="needs dispatch"
        />
        <StatCard
          icon={Truck}
          title="In Transit"
          value={orderStats.shipped.toString()}
          iconColor="text-cyan-400"
          period="with courier"
        />
        <StatCard
          icon={CheckCircle2}
          title="Delivered"
          value={orderStats.delivered.toString()}
          iconColor="text-emerald-400"
          period="completed"
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-[#0E111B] border border-white/[0.06] rounded-2xl shadow-elevation-sm overflow-hidden">
        {/* Search */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by order #, customer name, phone, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-yellow/40 focus:bg-white/[0.05] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 px-3.5 py-2.5 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusTab === tab.key
                  ? 'bg-brand-yellow/15 text-brand-yellow font-semibold border border-brand-yellow/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[10px] opacity-80">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Payment Filter Sub-row */}
        <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-white/[0.04] bg-white/[0.015] overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1.5 flex items-center gap-1">
            <CreditCard size={12} /> Payment:
          </span>
          {PAYMENT_FILTERS.map((pf) => (
            <button
              key={pf.key}
              onClick={() => setPaymentFilter(pf.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                paymentFilter === pf.key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="p-4">
            <table className="w-full">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={8} />
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No orders found"
            description={
              search
                ? `No orders match "${search}"`
                : 'Customer orders placed through the store checkout will appear here in real time.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Order
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Customer
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Items
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Payment
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Fulfillment
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono font-bold text-brand-yellow group-hover:underline">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs font-semibold text-white">{order.customerName}</div>
                      <div className="text-[11px] text-slate-400">{order.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {new Date(order.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-300">{order.itemCount} item(s)</td>
                    <td className="px-4 py-3.5 text-xs sm:text-sm font-semibold text-white">
                      ₹{formatPrice(order.total)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.fulfillmentStatus} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-3.5 border-t border-white/[0.06] flex items-center justify-between">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={10}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Order Detail & Fulfillment Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-xl bg-[#0D101A] border-l border-white/10 shadow-elevation-md overflow-y-auto animate-fadeIn flex flex-col justify-between">
            {/* Drawer Header */}
            <div>
              <div className="sticky top-0 bg-[#0D101A]/95 backdrop-blur-xl border-b border-white/[0.08] p-5 flex items-center justify-between z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white font-mono">{selectedOrder.orderNumber}</h2>
                    <span className="text-[11px] text-slate-400">
                      {new Date(selectedOrder.date).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={selectedOrder.status} />
                    <StatusBadge status={selectedOrder.paymentStatus} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/orders/${selectedOrder.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-yellow hover:bg-brand-yellow/10 border border-brand-yellow/30 transition-colors"
                  >
                    <ExternalLink size={13} />
                    Invoice &amp; Print
                  </Link>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Fulfillment Controls Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#141828] to-[#10131F] border border-white/[0.08] space-y-4 shadow-elevation-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-brand-yellow uppercase tracking-wider flex items-center gap-1.5">
                      <Truck size={15} /> Courier Dispatch &amp; Status
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                        Order Lifecycle Status
                      </label>
                      <select
                        value={drawerStatus}
                        onChange={(e) => setDrawerStatus(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-[#090B12] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-brand-yellow/50 capitalize cursor-pointer"
                      >
                        <option value="pending">Pending Confirmation</option>
                        <option value="processing">Processing / Printing</option>
                        <option value="in_production">In Production</option>
                        <option value="shipped">Shipped / Dispatched</option>
                        <option value="delivered">Delivered to Customer</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                        Courier Partner
                      </label>
                      <select
                        value={drawerCourier}
                        onChange={(e) => setDrawerCourier(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-[#090B12] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-brand-yellow/50 cursor-pointer"
                      >
                        {COURIER_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      AWB / Tracking Number
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. SF-789324823 or BLUEDART-1234"
                        value={drawerTracking}
                        onChange={(e) => setDrawerTracking(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-xl bg-[#090B12] border border-white/[0.1] text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-brand-yellow/50"
                      />
                      {drawerTracking && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(drawerTracking, 'tracking number')}
                          className="px-2.5 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-slate-300 flex items-center gap-1"
                          title="Copy tracking number"
                        >
                          {copiedField === 'tracking number' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateOrderStatus}
                    disabled={isUpdating}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-all shadow-[0_0_15px_rgba(245,186,19,0.2)] disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{isUpdating ? 'Saving to Database…' : 'Save & Notify Customer'}</span>
                  </button>
                </div>

                {/* Payment & Audit Action Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#141828] to-[#10131F] border border-white/[0.08] space-y-3.5 shadow-elevation-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={15} className="text-brand-yellow" /> Payment Audit & Status
                    </h3>
                    <StatusBadge status={selectedOrder.paymentStatus} />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                    <span className="text-slate-400">Payment Channel:</span>
                    <span className="font-mono text-white uppercase font-bold px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
                      {selectedOrder.paymentMethod || 'ONLINE'}
                    </span>
                  </div>

                  {selectedOrder.paymentStatus !== 'paid' ? (
                    selectedOrder.paymentMethod === 'PAY_AFTER_PROOF' ||
                    selectedOrder.paymentMethod === 'COD' ||
                    selectedOrder.paymentMethod === 'MANUAL_PROOF' ? (
                      <div className="pt-2">
                        <button
                          onClick={handleManualMarkPaid}
                          disabled={isMarkingPaid}
                          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          <span>{isMarkingPaid ? 'Recording in Audit Log…' : 'Mark as Paid (Proof/COD Confirmed)'}</span>
                        </button>
                        <p className="text-[10px] text-slate-500 text-center mt-1.5">
                          Logs admin identity, previous state, and timestamp to AdminAuditLog.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
                        🔒 Online gateway order: Verified automatically upon Razorpay webhook capture. Manual override is locked for zero-trust security.
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Payment captured and verified. Order is confirmed for print production.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRefundAmount('');
                          setRefundReason('');
                          setRefundModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 h-8 rounded-xl text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Issue Refund (Partial or Full)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Customer Details Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Customer Profile
                    </h3>
                    {selectedOrder.customerPhone && (
                      <a
                        href={`https://wa.me/${selectedOrder.customerPhone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(
                          selectedOrder.customerName
                        )},%20regarding%20your%20StarPress%20order%20${selectedOrder.orderNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Phone size={12} /> WhatsApp Customer
                      </a>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <p className="text-sm text-white font-bold">{selectedOrder.customerName}</p>
                    <p className="text-slate-300 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-500" />
                      {selectedOrder.customerEmail}
                    </p>
                    {selectedOrder.customerPhone && (
                      <p className="text-slate-300 font-mono flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-500" />
                        {selectedOrder.customerPhone}
                      </p>
                    )}
                    {selectedOrder.shippingAddress && (
                      <div className="pt-2.5 mt-2 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                            <MapPin size={11} /> Delivery Address
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedOrder.shippingAddress, 'address')}
                            className="text-[10px] text-brand-yellow hover:underline"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-slate-300 leading-relaxed bg-[#090B12] p-2.5 rounded-xl border border-white/[0.04]">
                          {selectedOrder.shippingAddress}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ordered Items */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Ordered Line Items ({selectedOrder.itemCount})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-semibold text-white truncate">{item.productName}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.sku} • {item.quantity} qty @ ₹{formatPrice(item.unitPrice)}
                          </p>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-white shrink-0">
                          ₹{formatPrice(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Totals */}
                <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white font-medium">₹{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">GST / Taxes</span>
                    <span className="text-white font-medium">₹{formatPrice(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Shipping</span>
                    <span className="text-white font-medium">
                      {selectedOrder.shipping > 0 ? `₹${formatPrice(selectedOrder.shipping)}` : 'FREE'}
                    </span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Discount Applied</span>
                      <span className="text-emerald-400 font-medium">
                        −₹{formatPrice(selectedOrder.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-bold pt-3 border-t border-white/[0.08]">
                    <span className="text-white">Total Amount</span>
                    <span className="text-brand-yellow font-mono text-lg font-bold">
                      ₹{formatPrice(selectedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Refund Modal */}
      {refundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <RotateCcw size={16} />
                <span>Issue Razorpay Refund</span>
              </div>
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="text-text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-text-secondary space-y-1">
              <p>
                Initiate an automated refund via Razorpay for Order <strong className="font-mono text-white">#{selectedOrder.orderNumber}</strong>.
              </p>
              <p className="text-[11px] text-text-muted">
                Order Total: <strong className="text-brand-yellow font-mono">₹{formatPrice(selectedOrder.total)}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Refund Amount (₹) <span className="text-text-muted font-normal">(Leave blank for full amount)</span>
                </label>
                <input
                  type="number"
                  placeholder={`Full amount: ${selectedOrder.total}`}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs text-white focus:outline-none focus:border-brand-yellow"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Reason for Refund <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Customer cancelled before proofing, quality defect, double charged"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border-subtle bg-bg-surface-alt text-xs text-white focus:outline-none focus:border-brand-yellow resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border-subtle text-xs text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueRefund}
                disabled={isSubmittingRefund || !refundReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingRefund ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Refund...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>Confirm &amp; Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
