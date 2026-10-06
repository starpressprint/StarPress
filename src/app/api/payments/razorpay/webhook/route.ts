// =============================================================================
// POST /api/payments/razorpay/webhook
// Production-hardened Razorpay Webhook processor
// Handles: payment.captured, order.paid, payment.failed, payment.authorized,
//          refund.created, refund.processed, refund.failed,
//          payment.dispute.created, payment.dispute.won, payment.dispute.lost
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  verifyWebhookSignature,
  recordPaymentSuccess,
  recordPaymentFailure,
  isProductionEnvironment,
} from "@/server/payments";
import { getOrderById } from "@/server/orders";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { isAllowedWebhookSource } from "@/lib/webhook-security";
import { auditPaymentEvent } from "@/server/payment-audit";
import { processWebhookRefund } from "@/server/refunds";
import {
  sendRefundNotificationEmail,
  alertOwnerPaymentDispute,
  alertOwnerAmountMismatch,
} from "@/server/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. Rate Limiting: 100 requests per 60s window
    const rl = await rateLimitDistributed(`webhook:razorpay:${clientIp}`, 100, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Webhook rate limit exceeded.");
    }

    // 2. IP Allowlisting (Defense in Depth)
    if (!isAllowedWebhookSource(clientIp)) {
      console.warn(`[Razorpay Security] Rejected webhook request from unauthorized IP: ${clientIp}`);
      return NextResponse.json(
        { error: "Forbidden: unauthorized webhook source IP" },
        { status: 403 }
      );
    }

    // 3. Read raw body string directly — NEVER re-serialize JSON before HMAC verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    const isProd = isProductionEnvironment();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      if (isProd) {
        console.error("[Webhook Security Alert] RAZORPAY_WEBHOOK_SECRET is not configured in production. Rejecting unsigned webhook.");
        return NextResponse.json(
          { error: "Webhook secret is not configured on server." },
          { status: 500 }
        );
      }
      console.warn("[Webhook Dev Warning] RAZORPAY_WEBHOOK_SECRET not set in non-production.");
    }

    // 4. Cryptographic signature check on raw body
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[Webhook Security Alert] Invalid Razorpay webhook signature received.");
      await auditPaymentEvent({
        action: "WEBHOOK_SIGNATURE_FAILED",
        actor: "WEBHOOK",
        ipAddress: clientIp,
        userAgent: request.headers.get("user-agent") || undefined,
        details: { signatureProvided: Boolean(signature) },
      });
      return NextResponse.json({ error: "Invalid cryptographic signature" }, { status: 400 });
    }

    // 5. Parse JSON event after signature verification
    const event = JSON.parse(rawBody);
    const eventType = event.event;
    console.log(`[Razorpay Webhook] Received verified event: "${eventType}"`);

    // Audit webhook arrival
    await auditPaymentEvent({
      action: "WEBHOOK_RECEIVED",
      actor: "WEBHOOK",
      ipAddress: clientIp,
      details: { eventType, eventId: event.id },
    });

    // 6. Extract payload entities
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const refundEntity = event.payload?.refund?.entity;
    const disputeEntity = event.payload?.dispute?.entity;

    // 7. Resolve Target Order
    const starpressOrderId =
      paymentEntity?.notes?.starpressOrderId ||
      orderEntity?.notes?.starpressOrderId ||
      paymentEntity?.notes?.orderId ||
      refundEntity?.notes?.starpressOrderId ||
      refundEntity?.notes?.orderId ||
      disputeEntity?.notes?.starpressOrderId;

    const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
    const receipt =
      paymentEntity?.receipt ||
      orderEntity?.receipt ||
      refundEntity?.notes?.orderNumber;

    let targetOrder = null;
    if (starpressOrderId) {
      targetOrder = await getOrderById(starpressOrderId);
    }
    if (!targetOrder && rzpOrderId) {
      targetOrder = await db.order.findFirst({
        where: { razorpayOrderId: rzpOrderId },
        include: { items: true },
      });
    }
    if (!targetOrder && receipt) {
      targetOrder = await getOrderById(receipt);
    }

    // Fallback resolution via known payment ID from previous capture
    const paymentId =
      paymentEntity?.id ||
      refundEntity?.payment_id ||
      disputeEntity?.payment_id;

    if (!targetOrder && paymentId) {
      const existingTx = await db.paymentTransaction.findFirst({
        where: { gatewayPaymentId: paymentId },
        include: { order: { include: { items: true } } },
      });
      if (existingTx?.order) {
        targetOrder = existingTx.order;
      }
    }

    if (!targetOrder) {
      console.warn(`[Razorpay Webhook] Order could not be resolved for event "${eventType}". Receipt: ${receipt}, RzpOrder: ${rzpOrderId}, PaymentId: ${paymentId}`);
      // Return 200 to acknowledge unhandled event without causing infinite webhook retries
      return NextResponse.json({ status: "acknowledged_unmatched" }, { status: 200 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

    // 8. Event Handling
    // -------------------------------------------------------------------------
    // 8A. Payment Captured or Order Paid
    // -------------------------------------------------------------------------
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const pId = paymentEntity?.id;
      const amountInPaise = Number(paymentEntity?.amount || 0);
      const expectedPaise = Math.round(Number(targetOrder.totalAmount) * 100);

      // Amount verification: prevent undercharging / tampering
      if (amountInPaise !== expectedPaise) {
        console.error(
          `[Webhook Security Alert] Amount mismatch on Order ${targetOrder.orderNumber}! Captured: ${amountInPaise} paise, Expected: ${expectedPaise} paise.`
        );

        try {
          await db.order.update({
            where: { id: targetOrder.id },
            data: {
              paymentStatus: "DISPUTED",
              notes: `${targetOrder.notes || ""} [PAYMENT_DISPUTE: Captured ${amountInPaise} paise vs Expected ${expectedPaise} paise]`,
            },
          });
        } catch {}

        await auditPaymentEvent({
          orderId: targetOrder.id,
          action: "AMOUNT_MISMATCH_DETECTED",
          actor: "WEBHOOK",
          details: { expectedPaise, capturedPaise: amountInPaise },
        });

        await alertOwnerAmountMismatch({
          orderNumber: targetOrder.orderNumber,
          expectedAmount: expectedPaise / 100,
          capturedAmount: amountInPaise / 100,
        });

        return NextResponse.json({ status: "disputed_logged" }, { status: 200 });
      }

      if (pId) {
        await recordPaymentSuccess({
          orderId: targetOrder.id,
          paymentId: pId,
          razorpayOrderId: rzpOrderId,
          signature,
          method: paymentEntity?.method || "ONLINE",
          amount: Number(targetOrder.totalAmount),
          rawPayload: event,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 8B. Payment Authorized (Phase 5: Auto-Capture for International / Non-instant Cards)
    // -------------------------------------------------------------------------
    else if (eventType === "payment.authorized") {
      const pId = paymentEntity?.id;
      const amountInPaise = Number(paymentEntity?.amount || 0);
      const expectedPaise = Math.round(Number(targetOrder.totalAmount) * 100);

      if (amountInPaise !== expectedPaise) {
        console.error(`[Webhook Alert] payment.authorized amount mismatch on order ${targetOrder.orderNumber}`);
        await alertOwnerAmountMismatch({
          orderNumber: targetOrder.orderNumber,
          expectedAmount: expectedPaise / 100,
          capturedAmount: amountInPaise / 100,
        });
        return NextResponse.json({ status: "amount_mismatch_logged" }, { status: 200 });
      }

      if (pId && keyId && keySecret) {
        console.log(`[Razorpay Auto-Capture] Initiating server capture for authorized payment: ${pId}`);
        const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const captureRes = await fetch(`https://api.razorpay.com/v1/payments/${pId}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${basicAuth}`,
          },
          body: JSON.stringify({ amount: amountInPaise, currency: "INR" }),
        });

        if (captureRes.ok) {
          const captureData = await captureRes.json();
          await recordPaymentSuccess({
            orderId: targetOrder.id,
            paymentId: pId,
            razorpayOrderId: rzpOrderId,
            signature,
            method: paymentEntity?.method || "ONLINE",
            amount: Number(targetOrder.totalAmount),
            rawPayload: captureData,
          });

          await auditPaymentEvent({
            orderId: targetOrder.id,
            action: "PAYMENT_AUTO_CAPTURED",
            actor: "WEBHOOK",
            details: { paymentId: pId, amount: amountInPaise / 100 },
          });
        } else {
          const errData = await captureRes.json().catch(() => ({}));
          console.error("[Razorpay Auto-Capture Failed]:", captureRes.status, errData);
          await auditPaymentEvent({
            orderId: targetOrder.id,
            action: "REST_VERIFICATION_FAILED",
            actor: "WEBHOOK",
            details: { paymentId: pId, error: errData },
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 8C. Payment Failed
    // -------------------------------------------------------------------------
    else if (eventType === "payment.failed") {
      const pId = paymentEntity?.id;
      const errorDesc =
        paymentEntity?.error_description ||
        paymentEntity?.error_reason ||
        "Payment failed at bank / card network";

      console.warn(`[Razorpay Webhook] Payment failed for Order ${targetOrder.orderNumber}: ${errorDesc}`);

      await recordPaymentFailure({
        orderId: targetOrder.id,
        paymentId: pId,
        reason: errorDesc,
        rawPayload: event,
      });
    }

    // -------------------------------------------------------------------------
    // 8D. Refund Events (Phase 4.3 - Idempotent Refund Accounting)
    // -------------------------------------------------------------------------
    else if (eventType === "refund.created" || eventType === "refund.processed") {
      const rfId = refundEntity?.id;
      const rfPaymentId = refundEntity?.payment_id || paymentId;
      const rfAmount = Number(refundEntity?.amount || 0) / 100;
      const rfStatus = refundEntity?.status || (eventType === "refund.processed" ? "processed" : "initiated");
      const rfReason = refundEntity?.notes?.reason || undefined;

      if (rfId) {
        const txResult = await processWebhookRefund({
          orderId: targetOrder.id,
          refundId: rfId,
          paymentId: rfPaymentId,
          amount: rfAmount,
          status: rfStatus,
          reason: rfReason,
          rawPayload: event,
        });

        if (txResult.skipped) {
          console.log(`[Razorpay Webhook] Duplicate refund event skipped for refund ${rfId} (status already "${rfStatus}").`);
          await auditPaymentEvent({
            orderId: targetOrder.id,
            action: "WEBHOOK_REFUND_SKIPPED",
            actor: "WEBHOOK",
            details: { refundId: rfId, status: rfStatus, reason: "Duplicate webhook replay ignored" },
          });
          return NextResponse.json({ status: "skipped_duplicate" }, { status: 200 });
        }

        if (txResult.isExcessive) {
          console.warn(
            `[Payment Security Alert] Excessive refund attempt on Order ${targetOrder.orderNumber}! Derived: ₹${txResult.totalRefundProcessed}, Total: ₹${txResult.orderTotal}. Clamped to ₹${txResult.finalRefundAmount}.`
          );
          await auditPaymentEvent({
            orderId: targetOrder.id,
            action: "EXCESSIVE_REFUND_BLOCKED",
            actor: "WEBHOOK",
            details: {
              refundId: rfId,
              calculatedTotal: txResult.totalRefundProcessed,
              orderTotal: txResult.orderTotal,
              clampedTo: txResult.finalRefundAmount,
            },
          });
        }

        await auditPaymentEvent({
          orderId: targetOrder.id,
          action: rfStatus === "processed" ? "REFUND_PROCESSED" : "REFUND_INITIATED",
          actor: "WEBHOOK",
          details: {
            refundId: rfId,
            paymentId: rfPaymentId,
            amount: rfAmount,
            status: rfStatus,
            derivedTotalRefund: txResult.finalRefundAmount,
          },
        });

        // Send email to customer on successful refund process
        if (rfStatus === "processed") {
          const customerEmail =
            targetOrder.guestEmail || (targetOrder as any).user?.email || (targetOrder.shippingAddress as any)?.email;
          const customerName =
            targetOrder.guestName || (targetOrder as any).user?.name || (targetOrder.shippingAddress as any)?.fullName || "Customer";

          if (customerEmail) {
            sendRefundNotificationEmail({
              orderNumber: targetOrder.orderNumber,
              customerName,
              customerEmail,
              refundAmount: rfAmount,
              refundId: rfId,
              status: "processed",
              reason: refundEntity?.notes?.reason || "Refund completed successfully",
            }).catch(console.warn);
          }
        }
      }
    } else if (eventType === "refund.failed") {
      const rfId = refundEntity?.id;
      if (rfId) {
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${targetOrder.id} FOR UPDATE`;
          const existingRefund = await tx.refund.findUnique({
            where: { razorpayRefundId: rfId },
          });

          if (existingRefund) {
            await tx.refund.update({
              where: { id: existingRefund.id },
              data: { status: "failed" },
            });
          } else {
            await tx.refund.create({
              data: {
                razorpayRefundId: rfId,
                orderId: targetOrder.id,
                paymentId: refundEntity?.payment_id || paymentId,
                amount: Number(refundEntity?.amount || 0) / 100,
                status: "failed",
                source: "WEBHOOK",
                reason: refundEntity?.error_description,
              },
            });
          }

          await tx.paymentTransaction.updateMany({
            where: { refundId: rfId },
            data: { refundStatus: "failed", status: "REFUND_FAILED" },
          });

          // Re-derive sum of processed refunds
          const processedRefunds = await tx.refund.aggregate({
            where: { orderId: targetOrder.id, status: "processed" },
            _sum: { amount: true },
          });
          const totalRefundProcessed = processedRefunds._sum.amount || new Prisma.Decimal(0);
          const orderTotal = new Prisma.Decimal(targetOrder.totalAmount);

          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              refundStatus: "failed",
              refundAmount: Prisma.Decimal.min(totalRefundProcessed, orderTotal),
            },
          });
        });

        await auditPaymentEvent({
          orderId: targetOrder.id,
          action: "REFUND_FAILED",
          actor: "WEBHOOK",
          details: { refundId: rfId, error: refundEntity?.error_description },
        });
      }
    }

    // -------------------------------------------------------------------------
    // 8E. Payment Dispute / Chargeback Events (Phase 4.3)
    // -------------------------------------------------------------------------
    else if (eventType === "payment.dispute.created") {
      const disputeReason =
        disputeEntity?.reason_code ||
        disputeEntity?.reason_description ||
        "Bank chargeback filed by cardholder";
      const disputeAmount = Number(disputeEntity?.amount || 0) / 100;
      const disputePaymentId = disputeEntity?.payment_id || paymentId || "N/A";

      await db.order.update({
        where: { id: targetOrder.id },
        data: {
          paymentStatus: "DISPUTED",
          disputeReason,
          notes: `${targetOrder.notes || ""} [PAYMENT_DISPUTE: ${disputeReason} amount: ₹${disputeAmount}]`,
        },
      });

      await auditPaymentEvent({
        orderId: targetOrder.id,
        action: "PAYMENT_DISPUTED",
        actor: "WEBHOOK",
        details: { disputeReason, disputeAmount, paymentId: disputePaymentId },
      });

      await alertOwnerPaymentDispute({
        orderNumber: targetOrder.orderNumber,
        paymentId: disputePaymentId,
        disputeReason,
        amount: disputeAmount,
      });
    } else if (eventType === "payment.dispute.won" || eventType === "payment.dispute.lost") {
      const disputeStatus = eventType === "payment.dispute.won" ? "WON" : "LOST";
      await db.order.update({
        where: { id: targetOrder.id },
        data: {
          notes: `${targetOrder.notes || ""} [PAYMENT_DISPUTE_${disputeStatus}: Resolved by bank]`,
          paymentStatus: disputeStatus === "WON" ? "PAID" : "DISPUTED_LOST",
        },
      });

      await auditPaymentEvent({
        orderId: targetOrder.id,
        action: "PAYMENT_DISPUTED",
        actor: "WEBHOOK",
        details: { disputeStatus },
      });
    }

    // Always respond with 200 after processing
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: any) {
    console.error("API /api/payments/razorpay/webhook error:", error);
    // Return 500 only for unexpected runtime crashes so Razorpay knows to retry
    return NextResponse.json(
      { error: "Webhook processing exception" },
      { status: 500 }
    );
  }
}
