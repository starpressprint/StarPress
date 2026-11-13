import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { QuoteOrderResult, validateCouponForQuote } from "./quote";
import { db } from "../lib/db";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function orderRequestHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
}

export function assertSameOrderRequest(notes: string | null | undefined, hash: string) {
  const previousHash = notes?.match(/\[request:([a-f0-9]{64})\]/)?.[1];
  // Legacy orders predate request hashes. Their existing retry keys still work.
  if (previousHash && previousHash !== hash) {
    throw Object.assign(new Error("This checkout request has already been used for a different order. Please refresh checkout."), { statusCode: 409 });
  }
}

/** Serialize coupon admission with other order creations and payment capture. */
export async function claimOrderCoupon(tx: Prisma.TransactionClient, quote: QuoteOrderResult, paymentMethod: string) {
  if (!quote.couponApplied) return;
  const code = quote.couponApplied.code;
  await tx.$queryRaw`SELECT id FROM "Discount" WHERE code = ${code} FOR UPDATE`;
  const coupon = await tx.discount.findUnique({ where: { code } });
  const current = await validateCouponForQuote(code, quote.subtotal, tx as typeof db);
  if (!coupon || !current || current.discountAmount !== quote.discount) {
    throw Object.assign(new Error("Coupon changed. Please refresh your checkout quote."), { statusCode: 409 });
  }
  if (coupon.maxUses) {
    const pendingReservations = await tx.order.count({
      where: {
        paymentMethod: "ONLINE", paymentStatus: "UNPAID", status: { not: "CANCELLED" },
        paymentExpiresAt: { gt: new Date() }, notes: { contains: `[coupon:${code}]` },
      },
    });
    if (coupon.usedCount + pendingReservations >= coupon.maxUses) {
      throw Object.assign(new Error("This coupon has reached its usage limit. Please remove it and retry."), { statusCode: 409 });
    }
  }
  if (paymentMethod === "PAY_AFTER_PROOF") {
    await tx.discount.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
  }
}

/** Preserve machine metadata when admin/customer edits the human-readable notes. */
export function mergeOrderNotes(existing: string | null, replacement?: string): string | undefined {
  if (replacement === undefined) return undefined;
  const metadata = existing?.match(/\[(?:idempotency|request|coupon):[^\]]+\]/g) || [];
  const text = replacement.replace(/\[(?:idempotency|request|coupon):[^\]]*\]/g, "").trim();
  return [text, ...metadata].filter(Boolean).join(" ");
}
