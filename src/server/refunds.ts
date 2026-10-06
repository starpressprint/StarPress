import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isProductionEnvironment } from "@/server/payments";
import { auditPaymentEvent } from "@/server/payment-audit";
import { sendRefundNotificationEmail } from "@/server/email";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export interface WebhookRefundInput {
  orderId: string;
  refundId: string;
  paymentId?: string;
  amount: number; // INR; the webhook route converts Razorpay paise before calling.
  status: string;
  reason?: string;
  rawPayload?: unknown;
}

/** Persist one Razorpay refund event using the same transaction used by production webhooks. */
export async function processWebhookRefund(input: WebhookRefundInput, client: typeof db = db) {
  try {
    return await client.$transaction(async (tx) => {
      // Serialize all refund events for an order before checking the refund ID or total.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`;

      const existing = await tx.refund.findUnique({
        where: { razorpayRefundId: input.refundId },
      });
      if (existing?.status === input.status) {
        const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { refundAmount: true, totalAmount: true } });
        return {
          skipped: true,
          isExcessive: false,
          finalRefundAmount: Number(order?.refundAmount || 0),
          totalRefundProcessed: 0,
          orderTotal: Number(order?.totalAmount || 0),
        };
      }

      if (existing) {
        await tx.refund.update({
          where: { id: existing.id },
          data: {
            status: input.status,
            paymentId: input.paymentId || existing.paymentId,
            amount: input.amount > 0 ? new Prisma.Decimal(input.amount) : existing.amount,
            reason: input.reason || existing.reason,
          },
        });
      } else {
        await tx.refund.create({
          data: {
            razorpayRefundId: input.refundId,
            orderId: input.orderId,
            paymentId: input.paymentId,
            amount: new Prisma.Decimal(input.amount),
            status: input.status,
            reason: input.reason,
            source: "WEBHOOK",
          },
        });
      }

      const existingTx = await tx.paymentTransaction.findFirst({ where: { refundId: input.refundId } });
      if (existingTx) {
        await tx.paymentTransaction.update({
          where: { id: existingTx.id },
          data: {
            refundStatus: input.status,
            status: input.status === "processed" ? "REFUND_PROCESSED" : "REFUND_INITIATED",
            rawPayload: input.rawPayload as any,
          },
        });
      } else {
        await tx.paymentTransaction.create({
          data: {
            orderId: input.orderId,
            gateway: "RAZORPAY",
            gatewayPaymentId: input.refundId,
            refundId: input.refundId,
            refundStatus: input.status,
            amount: new Prisma.Decimal(input.amount),
            currency: "INR",
            status: input.status === "processed" ? "REFUND_PROCESSED" : "REFUND_INITIATED",
            rawPayload: input.rawPayload as any,
          },
        });
      }

      const [aggregate, order] = await Promise.all([
        tx.refund.aggregate({ where: { orderId: input.orderId, status: "processed" }, _sum: { amount: true } }),
        tx.order.findUnique({ where: { id: input.orderId }, select: { totalAmount: true } }),
      ]);
      if (!order) throw new Error(`Order ${input.orderId} not found while processing refund.`);
      const totalRefundProcessed = aggregate._sum.amount || new Prisma.Decimal(0);
      const orderTotal = new Prisma.Decimal(order.totalAmount);
      const isExcessive = totalRefundProcessed.greaterThan(orderTotal);
      const finalRefundAmount = isExcessive ? orderTotal : totalRefundProcessed;

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          refundStatus: input.status,
          refundId: input.refundId,
          refundAmount: finalRefundAmount,
          ...(isExcessive ? { refundFlag: `OVER_REFUND: ${totalRefundProcessed.toFixed(2)} exceeds ${orderTotal.toFixed(2)}` } : {}),
          ...(finalRefundAmount.greaterThanOrEqualTo(orderTotal) ? { paymentStatus: "REFUNDED" } : {}),
        },
      });

      return {
        skipped: false,
        isExcessive,
        finalRefundAmount: finalRefundAmount.toNumber(),
        totalRefundProcessed: totalRefundProcessed.toNumber(),
        orderTotal: orderTotal.toNumber(),
      };
    });
  } catch (error: any) {
    // A duplicate refund can win the unique insert after another event committed.
    if (error?.code === "P2002" && (error?.meta?.target?.includes?.("razorpayRefundId") || String(error?.meta?.target || "").includes("razorpayRefundId"))) {
      return {
        skipped: true,
        isExcessive: false,
        finalRefundAmount: 0,
        totalRefundProcessed: 0,
        orderTotal: 0,
      };
    }
    throw error;
  }
}

export interface InitiateRefundParams {
  orderId: string;
  paymentId: string;
  amount?: number; // In INR (omit for full remaining refundable amount)
  reason: string;
  initiatedBy: string; // Admin userId, "SYSTEM", or "SYSTEM:CRON"
}

export async function initiateRefund(params: InitiateRefundParams) {
  const { orderId, paymentId, reason, initiatedBy } = params;
  const reservationId = `admin-reservation-${crypto.randomUUID()}`;
  // Lock and reserve within one transaction so two admin requests cannot both
  // observe the same remaining balance before either reaches Razorpay.
  const { order, totalAmount, refundAmount } = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const lockedOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!lockedOrder) throw new Error(`Order ${orderId} not found.`);

    const committed = await tx.refund.aggregate({ where: { orderId, status: { in: ["initiated", "processed"] } }, _sum: { amount: true } });
    const total = new Prisma.Decimal(lockedOrder.totalAmount);
    const committedTotal = committed._sum.amount || new Prisma.Decimal(0);
    const legacyProcessed = new Prisma.Decimal(lockedOrder.refundAmount || 0);
    const alreadyRefunded = Prisma.Decimal.max(committedTotal, legacyProcessed);
    const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(alreadyRefunded));
    const requested = params.amount !== undefined ? new Prisma.Decimal(params.amount) : remaining;
    if (requested.lessThanOrEqualTo(0)) throw new Error("Refund amount must be greater than zero.");
    if (requested.greaterThan(remaining.plus("0.01"))) {
      throw new Error(`Refund amount (₹${requested.toFixed(2)}) exceeds maximum refundable balance (₹${remaining.toFixed(2)}).`);
    }

    await tx.refund.create({
      data: {
        razorpayRefundId: reservationId,
        orderId,
        paymentId,
        amount: requested,
        status: "initiated",
        reason,
        source: "ADMIN",
      },
    });
    return { order: lockedOrder, totalAmount: total.toNumber(), refundAmount: requested.toNumber() };
  });

  const isProd = isProductionEnvironment();
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

  // Dev Mock Refund
  if (!isProd && (paymentId.startsWith("pay_mock_") || !keySecret)) {
    const mockRefundId = `rfnd_mock_${Date.now()}`;
    const noteAppend = `[REFUND_MOCK: ${mockRefundId} ₹${refundAmount} reason: ${reason}]`;
    const updatedNotes = order.notes ? `${order.notes} ${noteAppend}` : noteAppend;

    await db.$transaction(async (tx) => {
      // 1. Record into Refund model
      await tx.refund.update({
        where: { razorpayRefundId: reservationId },
        data: { razorpayRefundId: mockRefundId, status: "processed" },
      });

      // 2. Record legacy PaymentTransaction
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          gateway: "RAZORPAY",
          gatewayPaymentId: mockRefundId,
          refundId: mockRefundId,
          refundStatus: "processed",
          amount: refundAmount,
          currency: "INR",
          status: "REFUND_PROCESSED",
          rawPayload: { mock: true, paymentId, refundAmount, reason },
        },
      });

      // 3. Derive order.refundAmount from sum of processed refunds
      const processed = await tx.refund.aggregate({ where: { orderId: order.id, status: "processed" }, _sum: { amount: true } });
      const derivedRefundTotal = processed._sum.amount || new Prisma.Decimal(0);
      const newRefundTotal = Prisma.Decimal.min(new Prisma.Decimal(totalAmount), derivedRefundTotal);

      // 4. Update Order
      await tx.order.update({
        where: { id: order.id },
        data: {
          refundAmount: newRefundTotal,
          refundId: mockRefundId,
          refundStatus: "processed",
          notes: updatedNotes,
          ...(newRefundTotal.greaterThanOrEqualTo(totalAmount) ? { paymentStatus: "REFUNDED" } : {}),
        },
      });
    });

    await auditPaymentEvent({
      orderId: order.id,
      action: "REFUND_PROCESSED",
      actor: initiatedBy,
      details: {
        mock: true,
        refundId: mockRefundId,
        paymentId,
        amount: refundAmount,
        reason,
      },
    });

    return {
      success: true,
      refundId: mockRefundId,
      amount: refundAmount,
      status: "processed",
      isMock: true,
    };
  }

  if (!keyId || !keySecret) {
    await db.refund.update({ where: { razorpayRefundId: reservationId }, data: { status: "failed" } }).catch(() => {});
    throw new Error("Razorpay credentials are not configured on server.");
  }

  // 2. Call Razorpay Refund REST API
  const amountInPaise = Math.round(refundAmount * 100);
  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      speed: "normal",
      notes: {
        starpressOrderId: order.id,
        orderNumber: order.orderNumber,
        reason: reason.slice(0, 250),
      },
    }),
  });

  const refundData = await response.json();

  if (!response.ok) {
    await db.refund.update({ where: { razorpayRefundId: reservationId }, data: { status: "failed" } }).catch(() => {});
    console.error("[Razorpay Refund API Error]:", response.status, refundData);
    await auditPaymentEvent({
      orderId: order.id,
      action: "REFUND_FAILED",
      actor: initiatedBy,
      details: {
        paymentId,
        amount: refundAmount,
        error: refundData?.error,
      },
    });
    throw new Error(refundData?.error?.description || "Failed to initiate refund with Razorpay.");
  }

  const refundId = refundData.id;
  const refundStatus = refundData.status || "initiated";
  const noteAppend = `[REFUND_INITIATED: ${refundId} ₹${refundAmount} status: ${refundStatus} reason: ${reason}]`;
  const updatedNotes = order.notes ? `${order.notes} ${noteAppend}` : noteAppend;

  // 3. Atomically record refund and update order
  await db.$transaction(async (tx) => {
    // 3A. Write to Refund table
    await tx.refund.update({
      where: { razorpayRefundId: reservationId },
      data: { razorpayRefundId: refundId, status: refundStatus, reason },
    });

    // 3B. Record Refund Transaction
    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        gateway: "RAZORPAY",
        gatewayPaymentId: refundId,
        refundId: refundId,
        refundStatus: refundStatus,
        amount: refundAmount,
        currency: "INR",
        status: refundStatus === "processed" ? "REFUND_PROCESSED" : "REFUND_INITIATED",
        rawPayload: refundData,
      },
    });

    // 3C. Derive order.refundAmount from sum of processed refunds
    const processed = await tx.refund.aggregate({ where: { orderId: order.id, status: "processed" }, _sum: { amount: true } });
    const derivedRefundTotal = processed._sum.amount || new Prisma.Decimal(0);
    const newRefundTotal = Prisma.Decimal.min(new Prisma.Decimal(totalAmount), derivedRefundTotal);

    // 3D. Update Order
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundAmount: newRefundTotal,
        refundId: refundId,
        refundStatus: refundStatus,
        notes: updatedNotes,
        ...(newRefundTotal.greaterThanOrEqualTo(totalAmount) ? { paymentStatus: "REFUNDED" } : {}),
      },
    });
  });

  // 4. Audit Logging
  await auditPaymentEvent({
    orderId: order.id,
    action: "REFUND_INITIATED",
    actor: initiatedBy,
    details: {
      refundId,
      paymentId,
      amount: refundAmount,
      status: refundStatus,
      reason,
    },
  });

  // 6. Notify Customer via Email
  const customerEmail =
    order.guestEmail || order.user?.email || (order.shippingAddress as any)?.email;
  const customerName =
    order.guestName || order.user?.name || (order.shippingAddress as any)?.fullName || "Customer";

  if (customerEmail) {
    sendRefundNotificationEmail({
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      refundAmount,
      refundId,
      status: refundStatus,
      reason,
    }).catch((e) => console.warn("[Refund Notice] Failed to send email:", e));
  }

  return {
    success: true,
    refundId,
    amount: refundAmount,
    status: refundStatus,
    raw: refundData,
  };
}

/**
 * Sweeps all PaymentTransactions with status "REFUND_FLAGGED" (e.g. duplicate payments)
 * and automatically triggers Razorpay refunds.
 */
export async function processAutomaticRefunds(): Promise<{
  scanned: number;
  refunded: number;
  failed: number;
  details: Array<{ transactionId: string; refundId?: string; error?: string }>;
}> {
  const flaggedTransactions = await db.paymentTransaction.findMany({
    where: {
      status: "REFUND_FLAGGED",
      gatewayPaymentId: { not: null },
    },
    include: {
      order: true,
    },
  });

  let refunded = 0;
  let failed = 0;
  const details: Array<{ transactionId: string; refundId?: string; error?: string }> = [];

  for (const tx of flaggedTransactions) {
    if (!tx.gatewayPaymentId) continue;

    try {
      const result = await initiateRefund({
        orderId: tx.orderId,
        paymentId: tx.gatewayPaymentId,
        amount: Number(tx.amount),
        reason: "Automatic refund: duplicate captured payment flagged by system",
        initiatedBy: "SYSTEM:CRON",
      });

      // Mark the original flagged transaction as REFUNDED
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status: "REFUNDED",
          refundId: result.refundId,
          refundStatus: result.status,
        },
      });

      refunded++;
      details.push({ transactionId: tx.id, refundId: result.refundId });
    } catch (err: any) {
      console.error(`[Auto Refund Error] Failed to process flagged tx ${tx.id}:`, err);
      failed++;
      details.push({ transactionId: tx.id, error: err.message });
    }
  }

  return {
    scanned: flaggedTransactions.length,
    refunded,
    failed,
    details,
  };
}
