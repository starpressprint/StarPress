import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isProductionEnvironment, recordPaymentSuccess } from "@/server/payments";
import { auditPaymentEvent } from "@/server/payment-audit";
import { alertOwnerReconciliationDrift, alertOwnerAmountMismatch } from "@/server/email";

export interface ReconciliationResult {
  scanned: number;
  reconciled: number;
  discrepancies: number;
  errors: number;
  fixedOrders: Array<{ orderNumber: string; dbStatus: string; gatewayStatus: string }>;
}

/**
 * Sweeps orders created in the last 48 hours that remain UNPAID in the database
 * but have a Razorpay order ID, and cross-checks them directly against Razorpay's API.
 * Self-heals any missed webhooks or dropped network connections.
 */
export async function reconcilePayments(): Promise<ReconciliationResult> {
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
  const isProd = isProductionEnvironment();
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

  // 1. Find candidates for reconciliation
  const pendingOrders = await db.order.findMany({
    where: {
      paymentStatus: "UNPAID",
      razorpayOrderId: { not: null },
      createdAt: { gte: cutoffTime },
    },
    include: {
      items: true,
      user: { select: { id: true, email: true } },
    },
  });

  const result: ReconciliationResult = {
    scanned: pendingOrders.length,
    reconciled: 0,
    discrepancies: 0,
    errors: 0,
    fixedOrders: [],
  };

  if (pendingOrders.length === 0) {
    await auditPaymentEvent({
      action: "RECONCILIATION_RUN",
      actor: "SYSTEM:CRON",
      details: { scanned: 0, reconciled: 0 },
    });
    return result;
  }

  // Non-production mock bypass
  if (!isProd && (!keyId || !keySecret || keyId.startsWith("rzp_test_mock"))) {
    console.log(`[Reconciliation] Non-production environment — scanned ${pendingOrders.length} pending orders.`);
    await auditPaymentEvent({
      action: "RECONCILIATION_RUN",
      actor: "SYSTEM:CRON",
      details: { scanned: pendingOrders.length, note: "Mock / Dev run" },
    });
    return result;
  }

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  for (const order of pendingOrders) {
    if (!order.razorpayOrderId) continue;

    try {
      // 2. Fetch Razorpay Order Status
      const rzpRes = await fetch(`https://api.razorpay.com/v1/orders/${order.razorpayOrderId}`, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      });

      if (!rzpRes.ok) {
        result.errors++;
        continue;
      }

      const rzpOrder = await rzpRes.json();

      // 3. If Gateway says "paid", fetch captured payment details
      if (rzpOrder.status === "paid") {
        const paymentsRes = await fetch(
          `https://api.razorpay.com/v1/orders/${order.razorpayOrderId}/payments`,
          {
            headers: {
              Authorization: `Basic ${basicAuth}`,
            },
          }
        );

        if (!paymentsRes.ok) {
          result.errors++;
          continue;
        }

        const paymentsData = await paymentsRes.json();
        const paymentsList: any[] = paymentsData.items || [];

        // Find successful captured payment
        const successfulPayment = paymentsList.find(
          (p) => p.status === "captured" || p.status === "authorized"
        );

        if (!successfulPayment) {
          result.discrepancies++;
          continue;
        }

        const capturedPaise = Number(successfulPayment.amount || 0);
        const expectedPaise = Math.round(Number(order.totalAmount) * 100);

        if (capturedPaise !== expectedPaise) {
          result.discrepancies++;
          await alertOwnerAmountMismatch({
            orderNumber: order.orderNumber,
            expectedAmount: expectedPaise / 100,
            capturedAmount: capturedPaise / 100,
          });
          continue;
        }

        // 4. Authoritatively record payment success
        await recordPaymentSuccess({
          orderId: order.id,
          paymentId: successfulPayment.id,
          razorpayOrderId: order.razorpayOrderId,
          signature: "reconciled_gateway_sync",
          method: successfulPayment.method || "ONLINE",
          amount: Number(order.totalAmount),
          rawPayload: {
            reconciled: true,
            gatewayPayment: successfulPayment,
            gatewayOrder: rzpOrder,
          },
        });

        result.reconciled++;
        result.fixedOrders.push({
          orderNumber: order.orderNumber,
          dbStatus: "UNPAID",
          gatewayStatus: "PAID",
        });

        await auditPaymentEvent({
          orderId: order.id,
          action: "PAYMENT_CAPTURED",
          actor: "SYSTEM:RECONCILIATION",
          details: {
            orderNumber: order.orderNumber,
            paymentId: successfulPayment.id,
            reconciledAt: new Date().toISOString(),
          },
        });
      }
    } catch (err: any) {
      console.error(`[Reconciliation Error] Failed on Order ${order.orderNumber}:`, err);
      result.errors++;
    }
  }

  // 5. Notify owner if discrepancies were healed
  if (result.fixedOrders.length > 0) {
    alertOwnerReconciliationDrift({
      driftedOrders: result.fixedOrders,
    }).catch(console.warn);
  }

  // 6. Audit complete run
  await auditPaymentEvent({
    action: "RECONCILIATION_RUN",
    actor: "SYSTEM:CRON",
    details: {
      scanned: result.scanned,
      reconciled: result.reconciled,
      discrepancies: result.discrepancies,
      errors: result.errors,
    },
  });

  return result;
}
