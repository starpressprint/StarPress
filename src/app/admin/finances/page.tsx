'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Banknote,
  ReceiptText,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Activity,
  History,
  CheckCircle2,
  XCircle,
  CreditCard,
  Search,
} from 'lucide-react';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import StatCard from '@/components/admin/ui/StatCard';
import type { FinanceSummary, FinanceTransaction } from '@/lib/admin/types';

interface PaymentHealth {
  unpaidStaleCount: number;
  disputedCount: number;
  refundFlaggedCount: number;
}

interface GatewayTx {
  id: string;
  orderId: string;
  gatewayPaymentId: string | null;
  method: string | null;
  amount: number;
  currency: string;
  status: string;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  cardLast4: string | null;
  cardNetwork: string | null;
  refundId: string | null;
  refundStatus: string | null;
  createdAt: string;
  order?: {
    orderNumber: string;
    guestName: string | null;
    totalAmount: number;
  };
}

interface RefundQueueItem {
  id: string;
  orderId: string;
  gatewayPaymentId: string | null;
  amount: number;
  status: string;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    guestName: string | null;
    totalAmount: number;
    paymentId: string | null;
  };
}

interface AuditLogItem {
  id: string;
  orderId: string | null;
  action: string;
  actor: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface RefundAlert {
  id: string;
  orderNumber: string;
  refundFlag: string;
}

export default function FinancesPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [paymentHealth, setPaymentHealth] = useState<PaymentHealth>({
    unpaidStaleCount: 0,
    disputedCount: 0,
    refundFlaggedCount: 0,
  });
  const [gatewayTxs, setGatewayTxs] = useState<GatewayTx[]>([]);
  const [refundQueue, setRefundQueue] = useState<RefundQueueItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [refundAlerts, setRefundAlerts] = useState<RefundAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'gateway' | 'refunds' | 'audit'>('overview');
  const [auditSearch, setAuditSearch] = useState('');
  const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
  const [refundNotification, setRefundNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchFinanceData = async () => {
    try {
      const res = await fetch('/api/admin/finances');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setTransactions(data.transactions || []);
        if (data.paymentHealth) setPaymentHealth(data.paymentHealth);
        if (data.paymentTransactions) setGatewayTxs(data.paymentTransactions);
        if (data.refundQueue) setRefundQueue(data.refundQueue);
        if (data.recentAuditLogs) setAuditLogs(data.recentAuditLogs);
        if (data.refundAlerts) setRefundAlerts(data.refundAlerts);
      }
    } catch (e) {
      console.error('Failed to load finance data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const handleProcessRefund = async (item: RefundQueueItem) => {
    if (!item.order?.id) return;
    setProcessingRefundId(item.id);
    setRefundNotification(null);

    try {
      const res = await fetch(`/api/admin/orders/${item.order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(item.amount),
          reason: 'Duplicate payment auto-refund approved by admin',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process refund.');
      }

      setRefundNotification({
        type: 'success',
        message: `Refund of ₹${item.amount} initiated successfully for Order #${item.order.orderNumber}.`,
      });

      // Refresh list
      fetchFinanceData();
    } catch (err: any) {
      setRefundNotification({
        type: 'error',
        message: err.message || 'Refund processing failed.',
      });
    } finally {
      setProcessingRefundId(null);
    }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat('en-IN').format(Math.abs(n));

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const term = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.actor && log.actor.toLowerCase().includes(term)) ||
      (log.orderId && log.orderId.toLowerCase().includes(term))
    );
  });

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Payment Health & Finances</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Real-time gateway transactions, automated refunds, and payment security monitoring.
        </p>
      </div>

      {/* Payment Health Alert Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${paymentHealth.unpaidStaleCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-bg-surface border-border-subtle'}`}>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{paymentHealth.unpaidStaleCount} Orders</div>
            <div className="text-xs text-text-muted">Unpaid &gt; 1h (Expiry Pending)</div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${paymentHealth.disputedCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-bg-surface border-border-subtle'}`}>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{paymentHealth.disputedCount} Disputed</div>
            <div className="text-xs text-text-muted">Bank Chargebacks / Tampering</div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${paymentHealth.refundFlaggedCount > 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-bg-surface border-border-subtle'}`}>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <RotateCcw size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{paymentHealth.refundFlaggedCount} Flagged</div>
            <div className="text-xs text-text-muted">Duplicate Payments in Refund Queue</div>
          </div>
        </div>
      </div>

      {refundAlerts.length > 0 && (
        <section className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4" aria-label="Refund accounting alerts">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-300">
            <ShieldAlert size={17} /> Over-refund accounting alerts ({refundAlerts.length})
          </h2>
          <ul className="space-y-1">
            {refundAlerts.map((alert) => (
              <li key={alert.id} className="text-xs text-red-100">
                Order {alert.orderNumber}: {alert.refundFlag}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Primary KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon={TrendingUp} title="Total Revenue" value={`₹${formatPrice(summary.totalRevenue)}`} iconColor="text-emerald-400" />
        <StatCard icon={DollarSign} title="Net Sales" value={`₹${formatPrice(summary.netSales)}`} iconColor="text-blue-400" />
        <StatCard icon={ReceiptText} title="Refunds" value={`₹${formatPrice(summary.totalRefunds)}`} iconColor="text-rose-400" />
        <StatCard icon={Banknote} title="Tax Collected" value={`₹${formatPrice(summary.totalTax)}`} iconColor="text-amber-400" />
        <StatCard icon={ArrowUpRight} title="Payouts" value={`₹${formatPrice(summary.totalPayouts)}`} iconColor="text-cyan-400" />
        <StatCard icon={ArrowDownRight} title="Pending" value={`₹${formatPrice(summary.pendingPayouts)}`} iconColor="text-orange-400" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border-subtle gap-2 sm:gap-6 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'border-brand-yellow text-brand-yellow'
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          <DollarSign size={16} />
          <span>Accounting Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gateway')}
          className={`pb-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'gateway'
              ? 'border-brand-yellow text-brand-yellow'
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          <CreditCard size={16} />
          <span>Razorpay Transactions ({gatewayTxs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('refunds')}
          className={`pb-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'refunds'
              ? 'border-brand-yellow text-brand-yellow'
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          <RotateCcw size={16} />
          <span>Refund Queue ({refundQueue.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-brand-yellow text-brand-yellow'
              : 'border-transparent text-text-secondary hover:text-white'
          }`}
        >
          <Activity size={16} />
          <span>Security Audit Trail</span>
        </button>
      </div>

      {/* Notifications */}
      {refundNotification && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            refundNotification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{refundNotification.message}</span>
          <button
            type="button"
            onClick={() => setRefundNotification(null)}
            className="text-white hover:underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW LEDGER */}
      {activeTab === 'overview' && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Sales &amp; Refunds Ledger</h2>
            <span className="text-xs text-text-muted">{transactions.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-alt">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Reference</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-border-subtle/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize ${
                        txn.type === 'sale'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : txn.type === 'refund'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary max-w-xs truncate">{txn.description}</td>
                    <td className="px-4 py-3 text-xs font-mono text-text-muted">{txn.reference}</td>
                    <td className={`px-4 py-3 text-xs font-medium text-right ${txn.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {txn.amount >= 0 ? '+' : '−'}₹{formatPrice(txn.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={txn.status === 'completed' ? 'completed' : 'pending'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GATEWAY TRANSACTIONS */}
      {activeTab === 'gateway' && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Live Razorpay Payment Transactions</h2>
            <span className="text-xs text-text-muted">Last 50 captured/failed gateway events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-alt">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Payment ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Order #</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Method / Details</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Gateway Status</th>
                </tr>
              </thead>
              <tbody>
                {gatewayTxs.map((gtx) => (
                  <tr key={gtx.id} className="border-b border-border-subtle/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                      {new Date(gtx.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-white select-all">
                      {gtx.gatewayPaymentId || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-brand-yellow">
                      {gtx.order?.orderNumber || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize font-medium text-white">{gtx.method || 'online'}</span>
                        {gtx.cardNetwork && <span className="text-[10px] text-text-muted">({gtx.cardNetwork} ••{gtx.cardLast4})</span>}
                        {gtx.vpa && <span className="text-[10px] text-text-muted">({gtx.vpa})</span>}
                        {gtx.bank && <span className="text-[10px] text-text-muted">({gtx.bank})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-right text-white">
                      ₹{formatPrice(Number(gtx.amount))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        gtx.status === 'CAPTURED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : gtx.status === 'REFUND_FLAGGED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : gtx.status === 'REFUND_PROCESSED' || gtx.status === 'REFUNDED'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {gtx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REFUND QUEUE */}
      {activeTab === 'refunds' && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-lg space-y-4 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-base font-bold text-white">Pending Automated Refund Queue</h2>
              <p className="text-xs text-text-muted">
                Payments flagged due to duplicate checkout attempts or multi-tab orders. These are refunded automatically every 4 hours or instantly below.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              {refundQueue.length} Pending Actions
            </span>
          </div>

          {refundQueue.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Refund Queue is Clear</h3>
              <p className="text-xs text-text-muted">No duplicate transactions or pending refund flags detected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {refundQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">
                        Order #{item.order?.orderNumber || 'Unknown'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        DUPLICATE PAYMENT
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary flex flex-wrap gap-x-4">
                      <span>Gateway ID: <strong className="font-mono text-white">{item.gatewayPaymentId}</strong></span>
                      <span>Initial Paid ID: <strong className="font-mono text-white">{item.order?.paymentId || 'N/A'}</strong></span>
                      <span>Amount: <strong className="text-brand-yellow font-mono">₹{formatPrice(Number(item.amount))}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleProcessRefund(item)}
                    disabled={processingRefundId === item.id}
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {processingRefundId === item.id ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Initiating Refund...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>Issue Instant Refund</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-lg space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-base font-bold text-white">PCI-DSS Payment Audit Trail</h2>
              <p className="text-xs text-text-muted">
                Immutable chronological log of all HMAC verifications, gateway requests, and webhook lifecycle events.
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search action or order..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border-subtle bg-bg-surface-alt text-xs text-white focus:outline-none focus:border-brand-yellow"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-alt">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Timestamp</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Action</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Actor / Source</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">IP Address</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border-subtle/50 hover:bg-white/[0.02] text-xs">
                    <td className="px-4 py-2.5 text-text-muted font-mono whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        log.action.includes('SUCCESS') || log.action.includes('CAPTURED') || log.action.includes('VERIFIED')
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : log.action.includes('FAILED') || log.action.includes('DISPUTED') || log.action.includes('MISMATCH')
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-white/5 text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary font-mono">{log.actor || 'SYSTEM'}</td>
                    <td className="px-4 py-2.5 text-text-muted font-mono">{log.ipAddress || '—'}</td>
                    <td className="px-4 py-2.5 text-text-muted font-mono max-w-xs truncate select-all">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
