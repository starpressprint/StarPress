import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { db } from "@/lib/db";
import { persistentStore } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let orders: any[] = [];
    try {
      orders = await db.order.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch {
      orders = persistentStore.getOrders();
    }

    let totalRevenue = 0;
    let netSales = 0;
    let totalTax = 0;
    let totalRefunds = 0;

    const transactions: any[] = [];

    for (const o of orders) {
      const amount = Number(o.totalAmount || 0);
      const isCancelled = (o.status || "").toUpperCase() === "CANCELLED";
      const isRefunded = (o.paymentStatus || "").toUpperCase() === "REFUNDED";

      if (isRefunded) {
        totalRefunds += amount;
      } else if (!isCancelled) {
        totalRevenue += amount;
        netSales += Number(o.subtotal || amount);
        totalTax += Number(o.gstAmount || 0);
      }

      transactions.push({
        id: `txn_${o.id}`,
        date: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
        type: isRefunded ? "refund" : "sale",
        description: `Order ${o.orderNumber} — ${o.guestName || "Customer"}`,
        amount: isRefunded ? -amount : amount,
        status: o.paymentStatus === "PAID" || o.paymentStatus === "paid" ? "completed" : "pending",
        reference: o.orderNumber,
        ...(o.refundFlag ? { refundFlag: o.refundFlag } : {}),
        ...(o.refundFlag ? { description: `Order ${o.orderNumber} — ${o.guestName || "Customer"} — ⚠ ${o.refundFlag}` } : {}),
      });
    }

    const summary = {
      totalRevenue,
      netSales,
      totalRefunds,
      totalTax,
      totalPayouts: Math.max(0, Math.round(totalRevenue * 0.85)),
      pendingPayouts: Math.max(0, Math.round(totalRevenue * 0.15)),
    };

    // 1. Payment Health Metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let unpaidStaleCount = 0;
    let disputedCount = 0;
    let refundFlaggedCount = 0;

    try {
      unpaidStaleCount = await db.order.count({
        where: {
          paymentStatus: "UNPAID",
          paymentMethod: "ONLINE",
          status: "PENDING",
          createdAt: { lte: oneHourAgo },
        },
      });

      disputedCount = await db.order.count({
        where: { paymentStatus: "DISPUTED" },
      });

      refundFlaggedCount = await db.paymentTransaction.count({
        where: { status: "REFUND_FLAGGED" },
      });
    } catch {}

    // 2. Gateway Payment Transactions (Last 50)
    let paymentTransactions: any[] = [];
    try {
      paymentTransactions = await db.paymentTransaction.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              guestName: true,
              totalAmount: true,
            },
          },
        },
      });
    } catch {}

    // 3. Refund Queue (REFUND_FLAGGED pending auto-refund or manual refund)
    let refundQueue: any[] = [];
    try {
      refundQueue = await db.paymentTransaction.findMany({
        where: { status: "REFUND_FLAGGED" },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              guestName: true,
              totalAmount: true,
              paymentId: true,
            },
          },
        },
      });
    } catch {}

    // 4. Payment Audit Log (Last 50)
    let recentAuditLogs: any[] = [];
    try {
      recentAuditLogs = await db.paymentAuditLog.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      summary,
      transactions,
      refundAlerts: orders
        .filter((order) => Boolean(order.refundFlag))
        .map((order) => ({ id: order.id, orderNumber: order.orderNumber, refundFlag: order.refundFlag })),
      paymentHealth: {
        unpaidStaleCount,
        disputedCount,
        refundFlaggedCount,
      },
      paymentTransactions,
      refundQueue,
      recentAuditLogs,
    });
  } catch (error) {
    console.error("API /api/admin/finances error:", error);
    return NextResponse.json(
      { error: "Failed to calculate financial summary." },
      { status: 500 }
    );
  }
}
