import { db } from "@/lib/db";

export type PaymentAuditAction =
  | "ORDER_CREATED"
  | "RAZORPAY_ORDER_CREATED"
  | "PAYMENT_INITIATED"
  | "SIGNATURE_VERIFIED"
  | "SIGNATURE_FAILED"
  | "REST_VERIFIED"
  | "REST_VERIFICATION_FAILED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "PAYMENT_RETRY_INITIATED"
  | "PAYMENT_AUTO_CAPTURED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_SIGNATURE_FAILED"
  | "REFUND_INITIATED"
  | "REFUND_PROCESSED"
  | "REFUND_FAILED"
  | "DUPLICATE_PAYMENT_DETECTED"
  | "AMOUNT_MISMATCH_DETECTED"
  | "PAYMENT_DISPUTED"
  | "RECONCILIATION_RUN"
  | "ORDER_EXPIRED"
  | "MOCK_PAYMENT_BLOCKED"
  | "WEBHOOK_REFUND_SKIPPED"
  | "EXCESSIVE_REFUND_BLOCKED"
  | "LATE_PAYMENT_REFUND_FLAGGED";

export async function auditPaymentEvent(params: {
  orderId?: string;
  action: PaymentAuditAction;
  actor: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}) {
  // Non-blocking DB insert into PaymentAuditLog
  // NEVER throw — payment flow must never be disrupted by audit failures
  try {
    await db.paymentAuditLog.create({
      data: {
        orderId: params.orderId || null,
        action: params.action,
        actor: params.actor || "SYSTEM",
        details: params.details ? (params.details as any) : undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.warn("[Payment Audit Warning] Failed to persist audit log:", err);
  }
}
