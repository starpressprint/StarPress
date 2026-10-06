import crypto from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  notifyOwnerOrderPaid,
} from "@/server/email";
import { auditPaymentEvent } from "@/server/payment-audit";

export interface CreateRazorpayOrderInput {
  orderId: string;
  sessionUserId?: string;
  sessionUserEmail?: string;
  isAdmin?: boolean;
}

export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    env.NODE_ENV === "production"
  );
}

/**
 * Creates or reuses a Razorpay order at the gateway.
 * Strictly derives the charged amount from DB totalAmount in integer paise.
 * Fails closed in production if Razorpay keys are not configured.
 */
export async function createRazorpayOrder(input: CreateRazorpayOrderInput) {
  const isProd = isProductionEnvironment();
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;

  // 1. Fetch authoritative order from DB
  const order = await db.order.findUnique({
    where: { id: input.orderId },
  });

  if (!order) {
    const err = new Error("Order not found.");
    (err as any).statusCode = 404;
    throw err;
  }

  // 2. Validate payment state
  if (order.paymentStatus === "PAID") {
    const err = new Error("This order has already been paid.");
    (err as any).statusCode = 400;
    throw err;
  }

  const method = (order.paymentMethod || "").toUpperCase();
  if (method !== "ONLINE") {
    const err = new Error("Payment gateway checkout is only available for ONLINE orders.");
    (err as any).statusCode = 400;
    throw err;
  }

  // 3. Ownership check: strictly verify order ownership or admin clearance
  const isOwner =
    (input.sessionUserId && order.userId === input.sessionUserId) ||
    (input.sessionUserEmail && order.guestEmail && order.guestEmail.toLowerCase().trim() === input.sessionUserEmail.toLowerCase().trim());
  const isAdmin = Boolean(input.isAdmin);

  if ((order.userId || order.guestEmail) && (input.sessionUserId || input.sessionUserEmail) && !isOwner && !isAdmin) {
    const err = new Error("Order not found.");
    (err as any).statusCode = 404;
    throw err;
  }

  const amountInPaise = Math.round(Number(order.totalAmount) * 100);
  if (amountInPaise <= 0) {
    const err = new Error("Invalid order total amount.");
    (err as any).statusCode = 400;
    throw err;
  }

  // 4. Reuse existing Razorpay order if already attached and UNPAID
  if (order.razorpayOrderId && order.paymentStatus === "UNPAID") {
    // If we have live keys, we can safely reuse the existing razorpayOrderId
    return {
      success: true,
      razorpayOrderId: order.razorpayOrderId,
      amount: amountInPaise,
      currency: "INR",
      keyId: keyId || "rzp_test_placeholder",
      reused: true,
      orderNumber: order.orderNumber,
      isMock: false,
    };
  }

  // 5. Check keys and fail closed in production
  if (!keyId || !keySecret || keyId === "rzp_test_placeholder") {
    if (isProd) {
      console.error("[Razorpay Security] Refusing to process payment: Razorpay production credentials missing in production environment.");
      const err = new Error("Payment gateway service is unavailable in production (missing credentials).");
      (err as any).statusCode = 503;
      throw err;
    }

    // Dev-only mock strictly prohibited in production
    console.warn("[Razorpay Dev] Missing live keys in non-production. Generating dev test order.");
    const mockRazorpayId = `order_mock_${Date.now()}`;

    try {
      await db.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: mockRazorpayId },
      });
    } catch {}

    return {
      success: true,
      razorpayOrderId: mockRazorpayId,
      amount: amountInPaise,
      currency: "INR",
      keyId: "rzp_test_mock_key",
      orderNumber: order.orderNumber,
      isMock: true,
    };
  }

  // Refuse test keys on production host
  if (isProd && (keyId.startsWith("rzp_test_") || keySecret.startsWith("rzp_test_"))) {
    console.error("[Razorpay Security] Refusing live payment initialization: Razorpay test keys (rzp_test_*) detected in production environment.");
    const err = new Error("Configuration Error: Razorpay test keys cannot be used on a production host.");
    (err as any).statusCode = 503;
    throw err;
  }

  // 6. Call Razorpay REST API
  try {
    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const receipt = order.orderNumber.slice(0, 40);

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          starpressOrderId: order.id,
          orderNumber: order.orderNumber,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Razorpay API] Order creation failed:", response.status, errorData);
      const description = errorData?.error?.description || "Failed to initialize Razorpay order.";
      const err = new Error(description);
      (err as any).statusCode = 502;
      throw err;
    }

    const orderData = await response.json();

    // Attach razorpayOrderId to DB order
    await db.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: orderData.id },
    });

    return {
      success: true,
      razorpayOrderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
      orderNumber: order.orderNumber,
      isMock: false,
    };
  } catch (error: any) {
    console.error("[Razorpay Gateway Error]:", error);
    if (error.statusCode) throw error;
    const err = new Error(error.message || "Failed to communicate with Razorpay payment gateway.");
    (err as any).statusCode = 502;
    throw err;
  }
}

/**
 * Timing-safe HMAC signature verification for client payment verification.
 * Fails closed in production if RAZORPAY_KEY_SECRET is not configured.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET;
  const isProd = isProductionEnvironment();

  if (!secret) {
    if (isProd) {
      console.error("[Security Alert] RAZORPAY_KEY_SECRET missing in production. Verification failed closed.");
      return false;
    }
    // In local non-production development without keys, allow mock verification
    return true;
  }

  if (isProd && secret.startsWith("rzp_test_")) {
    console.error("[Razorpay Security] Refusing signature verification: Test key detected on production host.");
    return false;
  }

  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(generatedSignature, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Timing-safe webhook HMAC verification over raw payload string.
 * Fails closed in production if RAZORPAY_WEBHOOK_SECRET is missing.
 */
export function verifyWebhookSignature(rawPayload: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  const isProd = isProductionEnvironment();

  if (!secret) {
    if (isProd) {
      console.error("[Security Alert] RAZORPAY_WEBHOOK_SECRET missing in production. Webhook rejected.");
      return false;
    }
    // In local non-production dev only
    return false;
  }

  if (!rawPayload || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Idempotently records payment capture and marks order CONFIRMED + PAID.
 * Upserts / checks unique gatewayPaymentId to prevent duplicate webhook processing.
 * Also increments discount coupon usedCount atomically upon payment capture.
 */
export async function recordPaymentSuccess(params: {
  orderId: string;
  paymentId: string;
  razorpayOrderId?: string;
  signature?: string;
  method?: string;
  amount: number; // in rupees
  rawPayload?: any;
}) {
  try {
    // 1. Idempotency Check: if this payment transaction already exists, skip duplicate write
    const existingTx = await db.paymentTransaction.findFirst({
      where: { gatewayPaymentId: params.paymentId },
    });

    if (existingTx) {
      console.log(`[Payment Idempotency] Gateway transaction ${params.paymentId} already recorded. Skipping duplicate.`);
      const existingOrder = await db.order.findUnique({
        where: { id: params.orderId },
        include: { items: true },
      });
      return { success: true, order: existingOrder, isDuplicate: true };
    }

    // 2. Atomic database update: mark order PAID and create PaymentTransaction
    const updatedOrder = await db.$transaction(async (tx) => {
      // Serialize capture against expiry/restock for this order.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${params.orderId} FOR UPDATE`;
      // Find current order
      const targetOrder = await tx.order.findUnique({
        where: { id: params.orderId },
      });

      if (!targetOrder) {
        throw new Error(`Order ${params.orderId} not found for payment recording.`);
      }

      // Extract payment method details
      const payload = params.rawPayload || {};
      const cardInfo = payload.card || {};
      const bank = payload.bank || cardInfo.bank || null;
      const wallet = payload.wallet || null;
      const vpa = payload.vpa || null;
      const cardLast4 = cardInfo.last4 || null;
      const cardNetwork = cardInfo.network || null;
      const international = Boolean(payload.international || cardInfo.international);

      // Check for duplicate payment arrived on already PAID order (two tabs / duplicate payment)
      const isAlreadyPaid = targetOrder.paymentStatus === "PAID";
      const isDifferentPayment = Boolean(targetOrder.paymentId && targetOrder.paymentId !== params.paymentId);

      // A capture that arrives after the expiry worker released inventory must
      // enter the duplicate-payment refund queue instead of reconfirming stockless order.
      if (targetOrder.paymentStatus === "EXPIRED" || targetOrder.status === "CANCELLED") {
        await tx.paymentTransaction.create({
          data: {
            orderId: targetOrder.id,
            gateway: "RAZORPAY",
            gatewayOrderId: params.razorpayOrderId || targetOrder.razorpayOrderId || null,
            gatewayPaymentId: params.paymentId,
            gatewaySignature: params.signature || null,
            method: params.method || "ONLINE",
            amount: params.amount,
            currency: "INR",
            status: "REFUND_FLAGGED",
            bank,
            wallet,
            vpa,
            cardLast4,
            cardNetwork,
            international,
            rawPayload: {
              ...(params.rawPayload ? (params.rawPayload as any) : {}),
              refundReason: "LATE_PAYMENT_AFTER_ORDER_EXPIRY",
            },
          },
        });
        await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            notes: `${targetOrder.notes || ""} [LATE_PAYMENT_FLAGGED: Payment ${params.paymentId} arrived after order expiry; refund required.]`,
          },
        });
        return { ...targetOrder, items: [], latePaymentFlagged: true };
      }

      if (isAlreadyPaid && isDifferentPayment) {
        console.warn(
          `[Payment Conflict] Order ${targetOrder.orderNumber} is already marked PAID with ${targetOrder.paymentId}. Transaction ${params.paymentId} flagged for refund.`
        );

        // Record payment transaction with status REFUND_FLAGGED
        await tx.paymentTransaction.create({
          data: {
            orderId: targetOrder.id,
            gateway: "RAZORPAY",
            gatewayOrderId: params.razorpayOrderId || targetOrder.razorpayOrderId || null,
            gatewayPaymentId: params.paymentId,
            gatewaySignature: params.signature || null,
            method: params.method || "ONLINE",
            amount: params.amount,
            currency: "INR",
            status: "REFUND_FLAGGED",
            bank,
            wallet,
            vpa,
            cardLast4,
            cardNetwork,
            international,
            rawPayload: {
              ...(params.rawPayload ? (params.rawPayload as any) : {}),
              refundReason: "DUPLICATE_PAYMENT_ORDER_ALREADY_PAID",
              initialPaymentId: targetOrder.paymentId,
            },
          },
        });

        // Flag order notes for admin dashboard visibility
        const updatedWithRefund = await tx.order.update({
          where: { id: targetOrder.id },
          data: {
            notes: `${targetOrder.notes || ""} [DUPLICATE_PAYMENT_FLAGGED: Payment ${params.paymentId} received after order was already PAID with ${targetOrder.paymentId}. Needs refund.]`,
          },
          include: { items: true },
        });

        await auditPaymentEvent({
          orderId: targetOrder.id,
          action: "DUPLICATE_PAYMENT_DETECTED",
          actor: "SYSTEM",
          details: {
            paymentId: params.paymentId,
            existingPaymentId: targetOrder.paymentId,
            amount: params.amount,
          },
        });

        return updatedWithRefund;
      }

      // Record transaction
      await tx.paymentTransaction.create({
        data: {
          orderId: targetOrder.id,
          gateway: "RAZORPAY",
          gatewayOrderId: params.razorpayOrderId || targetOrder.razorpayOrderId || null,
          gatewayPaymentId: params.paymentId,
          gatewaySignature: params.signature || null,
          method: params.method || "ONLINE",
          amount: params.amount,
          currency: "INR",
          status: "CAPTURED",
          bank,
          wallet,
          vpa,
          cardLast4,
          cardNetwork,
          international,
          rawPayload: params.rawPayload ? (params.rawPayload as any) : null,
        },
      });

      // Update Order
      const saved = await tx.order.update({
        where: { id: targetOrder.id },
        data: {
          paymentId: params.paymentId,
          paymentStatus: "PAID",
          status: "CONFIRMED",
        },
        include: { items: true },
      });

      // Increment coupon usedCount if a coupon was used (race-condition safe)
      if (Number(saved.discountAmount || 0) > 0) {
        // Try finding discount code in notes e.g. [coupon:CODE]
        const couponMatch = saved.notes?.match(/\[coupon:([A-Za-z0-9_-]+)\]/);
        if (couponMatch && couponMatch[1]) {
          try {
            const couponCode = couponMatch[1].toUpperCase();
            const discountDoc = await tx.discount.findUnique({
              where: { code: couponCode },
            });
            if (discountDoc) {
              if (discountDoc.maxUses && discountDoc.usedCount >= discountDoc.maxUses) {
                console.warn(`[Coupon Race] Coupon ${couponCode} usage limit reached (${discountDoc.usedCount}/${discountDoc.maxUses}).`);
              } else {
                await tx.discount.update({
                  where: { id: discountDoc.id },
                  data: { usedCount: { increment: 1 } },
                });
              }
            }
          } catch (cErr) {
            console.warn("Could not increment coupon usedCount:", cErr);
          }
        }
      }

      return saved;
    });

    if ((updatedOrder as any).latePaymentFlagged) {
      await auditPaymentEvent({
        orderId: params.orderId,
        action: "LATE_PAYMENT_REFUND_FLAGGED",
        actor: "WEBHOOK",
        details: { paymentId: params.paymentId, amount: params.amount },
      });
      return { success: true, order: updatedOrder, requiresRefund: true };
    }

    // 3. Trigger transactional email asynchronously (never blocks / fails request)
    const customerEmail =
      updatedOrder.guestEmail || (updatedOrder as any).user?.email || (updatedOrder.shippingAddress as any)?.email;
    const customerName =
      updatedOrder.guestName || (updatedOrder as any).user?.name || (updatedOrder.shippingAddress as any)?.fullName || "Valued Customer";

    if (customerEmail) {
      sendPaymentReceivedEmail({
        orderNumber: updatedOrder.orderNumber,
        customerName,
        customerEmail,
        totalAmount: Number(updatedOrder.totalAmount),
        paymentId: params.paymentId,
      }).catch((e) => console.warn("Failed to dispatch payment success email:", e));
    }

    notifyOwnerOrderPaid({
      orderNumber: updatedOrder.orderNumber,
      customerName,
      customerEmail,
      customerPhone: updatedOrder.guestPhone || undefined,
      totalAmount: Number(updatedOrder.totalAmount),
      paymentId: params.paymentId,
    }).catch((e) => console.warn("Failed to dispatch owner payment alert:", e));

    // Dispatch audit log
    await auditPaymentEvent({
      orderId: params.orderId,
      action: "PAYMENT_CAPTURED",
      actor: "PAYMENTS:recordPaymentSuccess",
      details: {
        paymentId: params.paymentId,
        amount: params.amount,
        method: params.method,
      },
    });

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    console.error("[Record Payment Success Error]:", error);
    return { success: false, error: error?.message || "Failed to record payment." };
  }
}

/**
 * Records a failed payment attempt while keeping order UNPAID.
 */
export async function recordPaymentFailure(params: {
  orderId: string;
  paymentId?: string;
  reason?: string;
  rawPayload?: any;
}) {
  try {
    const order = await db.order.findUnique({
      where: { id: params.orderId },
    });

    if (!order) return { success: false, error: "Order not found." };

    if (order.paymentStatus === "PAID") {
      // Order already paid via another attempt, do not overwrite
      return { success: true, order };
    }

    const noteAppend = `[LAST_PAYMENT_FAILED: ${new Date().toISOString()} ${params.reason || "Payment not completed"}]`;
    const updatedNotes = order.notes ? `${order.notes} ${noteAppend}` : noteAppend;

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        notes: updatedNotes,
        ...(params.paymentId
          ? {
              transactions: {
                create: {
                  gateway: "RAZORPAY",
                  gatewayPaymentId: params.paymentId,
                  amount: Number(order.totalAmount),
                  currency: "INR",
                  status: "FAILED",
                  rawPayload: params.rawPayload ? (params.rawPayload as any) : null,
                },
              },
            }
          : {}),
      },
    });

    // Send retry email
    const customerEmail =
      order.guestEmail || (order as any).user?.email || (order.shippingAddress as any)?.email;
    const customerName =
      order.guestName || (order as any).user?.name || (order.shippingAddress as any)?.fullName || "Customer";

    if (customerEmail) {
      sendPaymentFailedEmail({
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName,
        customerEmail,
        totalAmount: Number(order.totalAmount),
        reason: params.reason,
      }).catch((e) => console.warn("Failed to dispatch payment failed email:", e));
    }

    await auditPaymentEvent({
      orderId: params.orderId,
      action: "PAYMENT_FAILED",
      actor: "PAYMENTS:recordPaymentFailure",
      details: {
        paymentId: params.paymentId,
        reason: params.reason,
      },
    });

    return { success: true, order: updated };
  } catch (error: any) {
    console.error("[Record Payment Failure Error]:", error);
    return { success: false, error: error?.message };
  }
}
