import { db } from "@/lib/db";
import { Prisma, OrderStatus } from "@prisma/client";
import { quoteOrder, QuoteItemInput } from "@/server/quote";
import { sendOrderPlacedProofEmail } from "@/server/email";

export interface CreateOrderInput {
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestName?: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    email: string;
    companyName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  billingAddress?: {
    companyName?: string;
    gstin?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  shippingMethod?: "standard" | "rush" | "express";
  couponCode?: string;
  paymentMethod?: string;
  notes?: string;
  items: Array<{
    productId?: string;
    slug?: string;
    productSlug?: string;
    quantity: number;
    sizeId?: string;
    materialId?: string;
    customText?: string;
    artworkUrl?: string;
    previewUrl?: string;
  }>;
  idempotencyKey?: string;
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `SP-${year}-${timestamp}${random}`;
}

export async function createOrder(input: CreateOrderInput) {
  // 1. Validate payment method
  let normalizedPaymentMethod = (input.paymentMethod || "ONLINE").toUpperCase().trim();
  if (
    normalizedPaymentMethod === "ONLINE" ||
    normalizedPaymentMethod === "RAZORPAY"
  ) {
    normalizedPaymentMethod = "ONLINE";
  } else if (
    normalizedPaymentMethod === "PAY_AFTER_PROOF" ||
    normalizedPaymentMethod === "COD_PROOF" ||
    normalizedPaymentMethod === "MANUAL_PROOF" ||
    normalizedPaymentMethod === "COD"
  ) {
    normalizedPaymentMethod = "PAY_AFTER_PROOF";
  } else {
    const err = new Error("Invalid payment method. Only 'ONLINE' and 'PAY_AFTER_PROOF' are supported.");
    (err as any).statusCode = 400;
    throw err;
  }

  // 2. Check Idempotency Key within 24 hours
  const idempKey = input.idempotencyKey?.trim();
  if (idempKey) {
    try {
      const existingOrder = await db.order.findFirst({
        where: {
          paymentStatus: "UNPAID",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          notes: { contains: `[idempotency:${idempKey}]` },
          ...(input.userId ? { userId: input.userId } : {}),
        },
        include: { items: true },
      });

      if (existingOrder) {
        console.log(`[Order Idempotency] Returning existing unpaid order ${existingOrder.orderNumber} for key "${idempKey}"`);
        return { success: true, order: existingOrder, isExisting: true };
      }
    } catch (e) {
      console.warn("Idempotency lookup warning:", e);
    }
  }

  // 3. Validate shipping address fields (server-side defense)
  const pincode = (input.shippingAddress.pincode || "").trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    const err = new Error("Invalid PIN code. Must be a valid 6-digit Indian PIN code.");
    (err as any).statusCode = 400;
    throw err;
  }

  // 4. Authoritative server quote calculation (NEVER trust client unit prices or totals)
  const quoteItems: QuoteItemInput[] = input.items.map((it) => ({
    productId: it.productId,
    slug: it.slug || it.productSlug,
    quantity: it.quantity,
    sizeId: it.sizeId,
    materialId: it.materialId,
    customText: it.customText,
    artworkUrl: it.artworkUrl,
    previewUrl: it.previewUrl,
  }));

  const quote = await quoteOrder({
    items: quoteItems,
    couponCode: input.couponCode,
    shippingMethod: input.shippingMethod,
  });

  // 5. Pre-order stock validation — reject if any tracked product has insufficient stock
  for (const snap of quote.lineSnapshots) {
    if (snap.productId) {
      try {
        const dbProd = await db.product.findUnique({
          where: { id: snap.productId },
          select: { trackInventory: true, stockQuantity: true, name: true },
        });
        if (dbProd && dbProd.trackInventory && dbProd.stockQuantity < snap.quantity) {
          const err = new Error(
            `Insufficient stock for "${dbProd.name}". Available: ${dbProd.stockQuantity}, Requested: ${snap.quantity}.`
          );
          (err as any).statusCode = 409;
          throw err;
        }
      } catch (stockErr: any) {
        if (stockErr?.statusCode === 409) throw stockErr;
        console.warn("Stock check warning:", stockErr);
      }
    }
  }

  // 6. Check for products requiring artwork: if artworkUrl is missing, force PAY_AFTER_PROOF
  const missingArtwork = quote.lineSnapshots.some(
    (snap) => snap.requiresArtwork && (!snap.artworkUrl || snap.artworkUrl.trim() === "")
  );

  if (missingArtwork && normalizedPaymentMethod === "ONLINE") {
    console.log("[Pre-Press Policy] Order requires artwork proofing. Switching paymentMethod to PAY_AFTER_PROOF.");
    normalizedPaymentMethod = "PAY_AFTER_PROOF";
  }

  // 7. Ensure synced DB User if userId provided
  let validUserId: string | null = null;
  if (input.userId) {
    try {
      const { ensureDbUser } = await import("@/lib/user-sync");
      const synced = await ensureDbUser({
        id: input.userId,
        email: input.guestEmail || input.shippingAddress.email,
        name: input.guestName || input.shippingAddress.fullName,
        phone: input.guestPhone || input.shippingAddress.phone,
      });
      if (synced) validUserId = synced.id;
    } catch {
      validUserId = null;
    }
  }

  // 8. Build Metadata Notes
  const metadataNotes: string[] = [];
  if (input.notes?.trim()) metadataNotes.push(input.notes.trim());
  if (idempKey) metadataNotes.push(`[idempotency:${idempKey}]`);
  if (quote.couponApplied) metadataNotes.push(`[coupon:${quote.couponApplied.code}]`);
  const finalNotes = metadataNotes.length > 0 ? metadataNotes.join(" ") : null;

  const orderNumber = generateOrderNumber();

  // 9. Atomic DB Persistence with stock decrement (Fail closed on DB failure)
  // Retry up to 3 times on orderNumber unique constraint collision
  let order: any = null;
  let retries = 0;
  const MAX_RETRIES = 3;

  while (retries < MAX_RETRIES) {
    try {
      const currentOrderNumber = retries === 0 ? orderNumber : generateOrderNumber();
      order = await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber: currentOrderNumber,
        userId: validUserId,
        guestEmail: input.guestEmail || input.shippingAddress.email,
        guestPhone: input.guestPhone || input.shippingAddress.phone,
        guestName: input.guestName || input.shippingAddress.fullName,
        status: OrderStatus.PENDING,
        subtotal: quote.subtotal,
        gstAmount: quote.gst,
        shippingFee: quote.shipping,
        discountAmount: quote.discount,
        totalAmount: quote.grandTotal,
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        billingAddress: input.billingAddress
          ? (input.billingAddress as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        paymentMethod: normalizedPaymentMethod,
        paymentStatus: "UNPAID",
        paymentExpiresAt: normalizedPaymentMethod === "ONLINE" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        notes: finalNotes,
        items: {
          create: quote.lineSnapshots.map((item) => ({
            productId: item.productId || null,
            productName: item.productName,
            productSlug: item.productSlug,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            specs: item.specs as unknown as Prisma.InputJsonValue,
            customText: item.customText || null,
            artworkUrl: item.artworkUrl || null,
            previewUrl: item.previewUrl || null,
          })),
        },
          },
          include: {
            items: true,
          },
        });

        // Atomically decrement stock for all tracked products within the same transaction
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${created.id} FOR UPDATE`;
        for (const item of created.items) {
          if (item.productId) {
            try {
              await tx.product.updateMany({
                where: {
                  id: item.productId,
                  trackInventory: true,
                  stockQuantity: { gte: item.quantity },
                },
                data: {
                  stockQuantity: { decrement: item.quantity },
                },
              });
            } catch (stockErr) {
              console.warn(`[Stock Decrement] Failed for product ${item.productId}:`, stockErr);
            }
          }
        }

        return created;
      });

      break; // Success — exit retry loop
    } catch (retryErr: any) {
      // Check if this is a unique constraint violation on orderNumber
      if (
        retryErr?.code === "P2002" &&
        retryErr?.meta?.target?.includes("orderNumber")
      ) {
        retries++;
        if (retries >= MAX_RETRIES) {
          console.error("[Order Number Collision] Max retries exhausted.");
          const err = new Error("Order creation temporarily unavailable. Please try again.");
          (err as any).statusCode = 503;
          throw err;
        }
        continue;
      }
      throw retryErr; // Re-throw non-collision errors
    }
  }

  if (!order) {
    const err = new Error("Database service unavailable. Order could not be created.");
    (err as any).statusCode = 503;
    throw err;
  }

    // If order was placed under PAY_AFTER_PROOF, increment coupon usage now (since no online gateway capture)
    if (normalizedPaymentMethod === "PAY_AFTER_PROOF" && quote.couponApplied) {
      try {
        await db.discount.updateMany({
          where: { code: quote.couponApplied.code.toUpperCase() },
          data: { usedCount: { increment: 1 } },
        });
      } catch (dErr) {
        console.warn("Could not increment coupon usedCount for proof order:", dErr);
      }

      // Send Order Placed / Proof email asynchronously
      sendOrderPlacedProofEmail({
        orderNumber: order.orderNumber,
        customerName: order.guestName || input.shippingAddress.fullName,
        customerEmail: order.guestEmail || input.shippingAddress.email,
        totalAmount: Number(order.totalAmount),
        items: (order.items || []).map((it: { productName: string; quantity: number }) => ({
          productName: it.productName,
          quantity: it.quantity,
        })),
      }).catch((e) => console.warn("Failed to dispatch order placed proof email:", e));
    }

    return { success: true, order };
}

export async function getOrderById(idOrNumber: string) {
  try {
    const order = await db.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        items: true,
        transactions: true,
      },
    });
    if (order) return order;
  } catch (error) {
    console.warn("getOrderById database error:", error);
  }

  return null;
}

export async function trackOrder(orderNumber: string, phoneOrEmail: string) {
  const normalizedInput = phoneOrEmail.trim().toLowerCase();
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();

  try {
    const order = await db.order.findFirst({
      where: {
        orderNumber: normalizedOrderNumber,
        OR: [
          { guestEmail: { equals: normalizedInput, mode: "insensitive" } },
          { guestPhone: { contains: normalizedInput } },
        ],
      },
      include: {
        items: true,
      },
    });
    if (order) return order;
  } catch (error) {
    console.warn("trackOrder database error:", error);
  }

  return null;
}

export async function getOrderStats() {
  try {
    const [statusCounts, paymentCounts, total] = await Promise.all([
      db.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
      db.order.groupBy({
        by: ['paymentStatus'],
        _count: {
          paymentStatus: true,
        },
      }),
      db.order.count(),
    ]);

    const stats = {
      total,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
      unpaid: 0,
      paid: 0,
    };

    const norm = (s?: string) => {
      const v = (s || "").toUpperCase().trim();
      if (v === "DISPATCHED") return "SHIPPED";
      if (v === "CONFIRMED" || v === "IN_PRODUCTION") return "PROCESSING";
      return v;
    };

    for (const group of statusCounts) {
      const normalizedStatus = norm(group.status);
      const count = group._count.status;
      if (normalizedStatus === "PENDING") stats.pending += count;
      else if (normalizedStatus === "PROCESSING") stats.processing += count;
      else if (normalizedStatus === "SHIPPED") stats.shipped += count;
      else if (normalizedStatus === "DELIVERED") stats.delivered += count;
      else if (normalizedStatus === "CANCELLED") stats.cancelled += count;
      else if (normalizedStatus === "REFUNDED") stats.refunded += count;
    }

    for (const group of paymentCounts) {
      const ps = (group.paymentStatus || "").toUpperCase().trim();
      if (ps === "UNPAID") stats.unpaid += group._count.paymentStatus;
      else if (ps === "PAID") stats.paid += group._count.paymentStatus;
    }

    return stats;
  } catch (error) {
    console.warn("getOrderStats database error:", error);
    return {
      total: 0,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
      unpaid: 0,
      paid: 0,
    };
  }
}

export async function listOrders(options?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  limit?: number;
  skip?: number;
}) {
  try {
    const where: any = {};

    if (options?.status && options.status !== "all" && options.status !== "ALL") {
      const st = options.status.toUpperCase();
      if (st === "SHIPPED") {
        where.status = { in: ["DISPATCHED", "SHIPPED"] };
      } else if (st === "PROCESSING") {
        where.status = { in: ["CONFIRMED", "IN_PRODUCTION", "PROCESSING"] };
      } else {
        where.status = st;
      }
    }

    if (options?.paymentStatus && options.paymentStatus !== "all" && options.paymentStatus !== "ALL") {
      const ps = options.paymentStatus.toUpperCase();
      if (ps === "PAY_AFTER_PROOF") {
        where.paymentMethod = "PAY_AFTER_PROOF";
      } else {
        where.paymentStatus = ps;
      }
    }

    if (options?.search?.trim()) {
      const q = options.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { guestName: { contains: q, mode: "insensitive" } },
        { guestEmail: { contains: q, mode: "insensitive" } },
        { guestPhone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [dbOrders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
        },
        skip: options?.skip || 0,
        take: options?.limit || 50,
      }),
      db.order.count({ where }),
    ]);

    return { orders: dbOrders, total };
  } catch (error) {
    console.error("listOrders database error:", error);
    return { orders: [], total: 0 };
  }
}

export async function updateOrderStatus(
  id: string,
  status: string,
  tracking?: { trackingNumber?: string; courierPartner?: string; notes?: string }
) {
  let normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "SHIPPED") normalizedStatus = "DISPATCHED";
  if (normalizedStatus === "PROCESSING") normalizedStatus = "IN_PRODUCTION";

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!existing) return { success: false as const, error: "Order not found" };

      const targetStatus = normalizedStatus as OrderStatus;
      const isNowCancelled = targetStatus === OrderStatus.CANCELLED;
      const wasAlreadyCancelled = existing.status === OrderStatus.CANCELLED;
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(tracking?.trackingNumber !== undefined ? { trackingNumber: tracking.trackingNumber } : {}),
          ...(tracking?.courierPartner !== undefined ? { courierPartner: tracking.courierPartner } : {}),
          ...(tracking?.notes !== undefined ? { notes: tracking.notes } : {}),
        },
        include: { items: true },
      });

      if (isNowCancelled && !wasAlreadyCancelled) {
        for (const item of existing.items) {
          if (!item.productId) continue;
          await tx.product.updateMany({
            where: { id: item.productId, trackInventory: true },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }
      return { success: true as const, order: updated };
    });

    return result;
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
