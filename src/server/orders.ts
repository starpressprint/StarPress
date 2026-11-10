import { db } from "@/lib/db";
import { Prisma, OrderStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { quoteOrder, QuoteItemInput } from "@/server/quote";
import { sendOrderPlacedProofEmail } from "@/server/email";
import { persistentStore, type PersistedOrder } from "@/server/storage";
import { slugify, invalidateCatalogCache } from "@/server/products";

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

export async function createOrder(input: CreateOrderInput, client: typeof db = db) {
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
      const existingOrder = await client.order.findFirst({
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

  const quote = await quoteOrder(
    {
      items: quoteItems,
      couponCode: input.couponCode,
      shippingMethod: input.shippingMethod,
    },
    client
  );

  // 5. Pre-order stock validation — reject if any tracked product has insufficient stock
  for (const snap of quote.lineSnapshots) {
    if (snap.productId || snap.productSlug) {
      try {
        const dbProd = await client.product.findFirst({
          where: {
            OR: [
              ...(snap.productId ? [{ id: snap.productId }, { slug: snap.productId }] : []),
              ...(snap.productSlug ? [{ slug: snap.productSlug }] : []),
            ],
          },
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

  // 6. Check for products requiring artwork: flag in notes if artwork is missing, but preserve customer's payment method
  const missingArtwork = quote.lineSnapshots.some(
    (snap) => snap.requiresArtwork && (!snap.artworkUrl || snap.artworkUrl.trim() === "")
  );

  if (missingArtwork) {
    console.log("[Pre-Press Policy] Order contains items requiring artwork; flagged for pre-flight proofing.");
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
  if (missingArtwork) metadataNotes.push("[PENDING_ARTWORK_UPLOAD]");
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
      order = await client.$transaction(async (tx) => {
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
        paymentExpiresAt:
          normalizedPaymentMethod === "ONLINE"
            ? new Date(
                Date.now() +
                  Number(
                    process.env.ORDER_PAYMENT_WINDOW_MINUTES ||
                      env.ORDER_PAYMENT_WINDOW_MINUTES ||
                      60
                  ) *
                    60 *
                    1000
              )
            : null,
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
          if (!item.productId && !item.productSlug) continue;
          const prod = await tx.product.findFirst({
            where: {
              OR: [
                ...(item.productId ? [{ id: item.productId }, { slug: item.productId }] : []),
                ...(item.productSlug ? [{ slug: item.productSlug }] : []),
              ],
            },
            select: { id: true, name: true, trackInventory: true, stockQuantity: true },
          });
          if (prod?.trackInventory) {
            const decResult = await tx.product.updateMany({
              where: {
                id: prod.id,
                trackInventory: true,
                stockQuantity: { gte: item.quantity },
              },
              data: {
                stockQuantity: { decrement: item.quantity },
              },
            });
            if (decResult.count === 0) {
              const err = new Error(
                `Product "${prod.name || item.productName}" is out of stock. Requested: ${item.quantity}, Available: ${prod.stockQuantity}.`
              );
              (err as any).statusCode = 409;
              (err as any).code = "OUT_OF_STOCK";
              throw err;
            }
          }
        }

        return created;
      });

      invalidateCatalogCache();
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
        await client.discount.updateMany({
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

    // Mirror to persistentStore for multi-source resilience
    try {
      persistentStore.saveOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        guestEmail: order.guestEmail,
        guestPhone: order.guestPhone,
        guestName: order.guestName,
        status: order.status,
        subtotal: Number(order.subtotal),
        gstAmount: order.gstAmount ? Number(order.gstAmount) : null,
        shippingFee: Number(order.shippingFee),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId,
        trackingNumber: order.trackingNumber,
        courierPartner: order.courierPartner,
        notes: order.notes,
        items: (order.items || []).map((it: any) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          productSlug: it.productSlug,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
          specs: it.specs,
          customText: it.customText,
          artworkUrl: it.artworkUrl,
          previewUrl: it.previewUrl,
        })),
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
        updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt),
      });
    } catch (saveErr) {
      console.warn("Could not mirror order to persistentStore:", saveErr);
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

  try {
    const local = persistentStore.getOrderById(idOrNumber);
    if (local) return local;
  } catch {}

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

  try {
    const local = persistentStore.getOrderById(normalizedOrderNumber);
    if (local) {
      const email = (local.guestEmail || "").toLowerCase();
      const phone = (local.guestPhone || "").replace(/\D/g, "");
      const cleanInput = normalizedInput.replace(/\D/g, "");
      if (email === normalizedInput || (cleanInput && phone.includes(cleanInput))) {
        return local;
      }
    }
  } catch {}

  return null;
}

export async function getOrderStats() {
  const stats = {
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

  const norm = (s?: string) => {
    const v = (s || "").toUpperCase().trim();
    if (v === "DISPATCHED") return "SHIPPED";
    if (v === "CONFIRMED" || v === "IN_PRODUCTION") return "PROCESSING";
    return v;
  };

  let dbOrders: any[] = [];
  try {
    let [statusCounts, paymentCounts, dbTotal] = await Promise.all([
      db.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }).catch(() => null),
      db.order.groupBy({
        by: ['paymentStatus'],
        _count: {
          paymentStatus: true,
        },
      }).catch(() => null),
      db.order.count().catch(() => 0),
    ]);

    if (!statusCounts || !paymentCounts) {
      const allDb = await db.order.findMany({ select: { status: true, paymentStatus: true, id: true, orderNumber: true } }).catch(() => []);
      dbTotal = allDb.length;
      for (const row of allDb) {
        const s = norm(row.status);
        if (s === "PENDING") stats.pending++;
        else if (s === "PROCESSING") stats.processing++;
        else if (s === "SHIPPED") stats.shipped++;
        else if (s === "DELIVERED") stats.delivered++;
        else if (s === "CANCELLED") stats.cancelled++;
        else if (s === "REFUNDED") stats.refunded++;

        const ps = (row.paymentStatus || "").toUpperCase().trim();
        if (ps === "UNPAID") stats.unpaid++;
        else if (ps === "PAID") stats.paid++;
      }
      dbOrders = allDb;
    } else {
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

      dbOrders = await db.order.findMany({ select: { id: true, orderNumber: true } }).catch(() => []);
    }

    stats.total = Math.max(stats.total, dbTotal);
  } catch (error) {
    console.warn("getOrderStats database error:", error);
  }

  // Include any extra local orders from persistentStore not present in DB
  try {
    const localOrders = persistentStore.getOrders();
    const dbKeys = new Set(dbOrders.map((o) => (o.orderNumber || o.id || "").toUpperCase().trim()));

    for (const lo of localOrders) {
      const key = (lo.orderNumber || lo.id || "").toUpperCase().trim();
      if (key && !dbKeys.has(key)) {
        stats.total++;
        const s = norm(lo.status);
        if (s === "PENDING") stats.pending++;
        else if (s === "PROCESSING") stats.processing++;
        else if (s === "SHIPPED") stats.shipped++;
        else if (s === "DELIVERED") stats.delivered++;
        else if (s === "CANCELLED") stats.cancelled++;
        else if (s === "REFUNDED") stats.refunded++;

        const ps = (lo.paymentStatus || "").toUpperCase().trim();
        if (ps === "UNPAID") stats.unpaid++;
        else if (ps === "PAID") stats.paid++;
      }
    }
  } catch {}

  return stats;
}

export async function listOrders(options?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  limit?: number;
  skip?: number;
}) {
  let dbOrders: any[] = [];
  try {
    const where: any = {};

    if (options?.status && options.status !== "all" && options.status !== "ALL") {
      const st = options.status.toUpperCase();
      if (st === "SHIPPED" || st === "DISPATCHED") {
        where.status = { in: ["DISPATCHED"] };
      } else if (st === "PROCESSING" || st === "CONFIRMED" || st === "IN_PRODUCTION") {
        where.status = { in: ["CONFIRMED", "IN_PRODUCTION"] };
      } else if (st === "REFUNDED") {
        where.OR = [
          { refundStatus: { in: ["processed", "initiated", "completed"] } },
          { refundAmount: { gt: 0 } },
        ];
      } else if (["PENDING", "CONFIRMED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED", "CANCELLED"].includes(st)) {
        where.status = st as any;
      }
    }

    if (options?.paymentStatus && options.paymentStatus !== "all" && options.paymentStatus !== "ALL") {
      const ps = options.paymentStatus.toUpperCase();
      if (ps === "PAY_AFTER_PROOF") {
        where.paymentMethod = "PAY_AFTER_PROOF";
      } else if (ps === "PAID") {
        where.paymentStatus = "PAID";
      } else if (ps === "UNPAID") {
        where.paymentStatus = { in: ["UNPAID", "PENDING"] };
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

    dbOrders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        transactions: { select: { id: true, gatewayPaymentId: true, method: true, status: true } },
      },
    });
  } catch (error) {
    console.error("listOrders database query error:", error);
  }

  // Fetch persistentStore orders
  let localOrders: any[] = [];
  try {
    localOrders = persistentStore.getOrders();
  } catch (error) {
    console.warn("listOrders persistentStore fetch error:", error);
  }

  // Combine and deduplicate by orderNumber or id
  const combinedMap = new Map<string, any>();
  for (const o of dbOrders) {
    const key = (o.orderNumber || o.id || "").toUpperCase().trim();
    if (key) {
      combinedMap.set(key, o);
      // Ensure real DB order is also mirrored in persistentStore for offline backup
      try {
        persistentStore.saveOrder({
          id: o.id,
          orderNumber: o.orderNumber,
          userId: o.userId,
          guestEmail: o.guestEmail,
          guestPhone: o.guestPhone,
          guestName: o.guestName,
          status: o.status,
          subtotal: Number(o.subtotal || 0),
          gstAmount: o.gstAmount ? Number(o.gstAmount) : null,
          shippingFee: Number(o.shippingFee || 0),
          discountAmount: Number(o.discountAmount || 0),
          totalAmount: Number(o.totalAmount || 0),
          shippingAddress: o.shippingAddress,
          billingAddress: o.billingAddress,
          paymentMethod: o.paymentMethod || "ONLINE",
          paymentStatus: o.paymentStatus || "UNPAID",
          paymentId: o.paymentId,
          trackingNumber: o.trackingNumber,
          courierPartner: o.courierPartner,
          notes: o.notes,
          items: Array.isArray(o.items)
            ? o.items.map((it: any) => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                productSlug: it.productSlug,
                quantity: it.quantity,
                unitPrice: Number(it.unitPrice || 0),
                lineTotal: Number(it.lineTotal || 0),
                specs: it.specs,
                customText: it.customText,
                artworkUrl: it.artworkUrl,
                previewUrl: it.previewUrl,
              }))
            : [],
          createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : new Date().toISOString(),
        });
      } catch {}
    }
  }

  for (const lo of localOrders) {
    const key = (lo.orderNumber || lo.id || "").toUpperCase().trim();
    if (key && !combinedMap.has(key)) {
      combinedMap.set(key, lo);
    }
  }

  let allOrders = Array.from(combinedMap.values());

  // Apply filters in memory so any persistentStore orders match the criteria
  if (options?.status && options.status !== "all" && options.status !== "ALL") {
    const st = options.status.toUpperCase();
    allOrders = allOrders.filter((o) => {
      const ost = (o.status || "").toUpperCase();
      if (st === "SHIPPED" || st === "DISPATCHED") return ost === "DISPATCHED" || ost === "SHIPPED";
      if (st === "PROCESSING" || st === "CONFIRMED" || st === "IN_PRODUCTION") {
        return ost === "CONFIRMED" || ost === "IN_PRODUCTION" || ost === "PROCESSING";
      }
      if (st === "REFUNDED") {
        return (
          o.refundStatus === "processed" ||
          o.refundStatus === "completed" ||
          Number(o.refundAmount || 0) > 0 ||
          ost === "REFUNDED"
        );
      }
      return ost === st;
    });
  }

  if (options?.paymentStatus && options.paymentStatus !== "all" && options.paymentStatus !== "ALL") {
    const ps = options.paymentStatus.toUpperCase();
    allOrders = allOrders.filter((o) => {
      if (ps === "PAY_AFTER_PROOF") {
        return (o.paymentMethod || "").toUpperCase() === "PAY_AFTER_PROOF";
      }
      if (ps === "PAID") {
        return (o.paymentStatus || "").toUpperCase() === "PAID";
      }
      if (ps === "UNPAID") {
        const ops = (o.paymentStatus || "").toUpperCase();
        return ops === "UNPAID" || ops === "PENDING";
      }
      return (o.paymentStatus || "").toUpperCase() === ps;
    });
  }

  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    allOrders = allOrders.filter((o) => {
      const num = (o.orderNumber || "").toLowerCase();
      const name = (o.guestName || o.user?.name || "").toLowerCase();
      const email = (o.guestEmail || o.user?.email || "").toLowerCase();
      const phone = (o.guestPhone || o.user?.phone || "").toLowerCase();
      return num.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }

  // Sort descending by createdAt safely
  allOrders.sort((a, b) => {
    const da = a.createdAt && a.createdAt !== "undefined" ? new Date(a.createdAt).getTime() : 0;
    const dbTime = b.createdAt && b.createdAt !== "undefined" ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(dbTime) ? 0 : dbTime) - (isNaN(da) ? 0 : da);
  });

  const total = allOrders.length;
  const skip = options?.skip || 0;
  const limit = options?.limit || 50;
  const pagedOrders = allOrders.slice(skip, skip + limit);

  return { orders: pagedOrders, total };
}

export async function updateOrderStatus(
  id: string,
  status: string,
  tracking?: { trackingNumber?: string; courierPartner?: string; notes?: string },
  client: typeof db = db
) {
  let normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "SHIPPED") normalizedStatus = "DISPATCHED";
  if (normalizedStatus === "PROCESSING") normalizedStatus = "IN_PRODUCTION";

  // Always mirror to persistentStore
  try {
    persistentStore.updateOrderStatus(id, normalizedStatus, tracking);
  } catch (e) {
    console.warn("persistentStore updateOrderStatus error:", e);
  }

  try {
    const result = await client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!existing) {
        // If not found in DB, check persistentStore
        const local = persistentStore.getOrderById(id);
        if (local) {
          return { success: true as const, order: local };
        }
        return { success: false as const, error: "Order not found" };
      }

      const targetStatus = normalizedStatus as OrderStatus;
      const isNowCancelled = targetStatus === OrderStatus.CANCELLED;
      const now = new Date();

      if (isNowCancelled) {
        // Restock exactly once: only if stockRestoredAt is null
        const claimRestock = await tx.order.updateMany({
          where: { id, stockRestoredAt: null },
          data: {
            status: targetStatus,
            stockRestoredAt: now,
            ...(tracking?.trackingNumber !== undefined ? { trackingNumber: tracking.trackingNumber } : {}),
            ...(tracking?.courierPartner !== undefined ? { courierPartner: tracking.courierPartner } : {}),
            ...(tracking?.notes !== undefined ? { notes: tracking.notes } : {}),
          },
        });

        if (claimRestock.count > 0) {
          for (const item of existing.items) {
            if (!item.productId) continue;
            await tx.product.updateMany({
              where: { id: item.productId, trackInventory: true },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        } else {
          // Already restocked, update status and tracking metadata
          await tx.order.update({
            where: { id },
            data: {
              status: targetStatus,
              ...(tracking?.trackingNumber !== undefined ? { trackingNumber: tracking.trackingNumber } : {}),
              ...(tracking?.courierPartner !== undefined ? { courierPartner: tracking.courierPartner } : {}),
              ...(tracking?.notes !== undefined ? { notes: tracking.notes } : {}),
            },
          });
        }
      } else {
        await tx.order.update({
          where: { id },
          data: {
            status: targetStatus,
            ...(tracking?.trackingNumber !== undefined ? { trackingNumber: tracking.trackingNumber } : {}),
            ...(tracking?.courierPartner !== undefined ? { courierPartner: tracking.courierPartner } : {}),
            ...(tracking?.notes !== undefined ? { notes: tracking.notes } : {}),
          },
        });
      }

      const updated = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      return { success: true as const, order: updated };
    });

    invalidateCatalogCache();
    return result;
  } catch (error) {
    // If DB transaction failed, return local order if available
    const local = persistentStore.getOrderById(id);
    if (local) {
      return { success: true, order: local };
    }
    return { success: false, error: (error as Error).message };
  }
}

export interface CreateAdminOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: Array<{
    productId?: string;
    productName: string;
    productSlug?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
    customText?: string;
  }>;
  paymentMethod?: string; // "CASH", "UPI", "BANK_TRANSFER", "ONLINE", "PAY_AFTER_PROOF"
  paymentStatus?: string; // "PAID", "UNPAID"
  status?: string; // "PENDING", "CONFIRMED", "IN_PRODUCTION", "DISPATCHED", "DELIVERED", "CANCELLED"
  shippingFee?: number;
  discountAmount?: number;
  notes?: string;
}

/**
 * Create a manual order from the admin panel (walk-in, phone, WhatsApp).
 * Saves to both PostgreSQL and persistentStore with full audit trail.
 */
export async function createAdminOrder(
  data: CreateAdminOrderInput,
  adminEmail: string,
  ipAddress?: string
) {
  const orderNumber = generateOrderNumber();
  const customerName = data.customerName.trim();
  const customerPhone = data.customerPhone.trim();
  const customerEmail = (data.customerEmail?.trim() || `${customerPhone.replace(/\D/g, '') || "customer"}@starpress.in`).toLowerCase();

  const shippingAddrObj = {
    fullName: data.shippingAddress?.fullName || customerName,
    phone: data.shippingAddress?.phone || customerPhone,
    addressLine1: data.shippingAddress?.addressLine1 || "Star Press Counter / Walk-in",
    addressLine2: data.shippingAddress?.addressLine2 || "",
    city: data.shippingAddress?.city || "Khatima",
    state: data.shippingAddress?.state || "Uttarakhand",
    pincode: data.shippingAddress?.pincode || "262308",
  };

  const cleanItems = data.items.map((it) => {
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    const price = Math.max(0, Number(it.unitPrice) || 0);
    const lineTotal = it.lineTotal !== undefined ? Number(it.lineTotal) : price * qty;
    return {
      productId: it.productId || null,
      productName: it.productName.trim(),
      productSlug: it.productSlug?.trim() || slugify(it.productName),
      quantity: qty,
      unitPrice: price,
      lineTotal,
      customText: it.customText?.trim() || null,
    };
  });

  const subtotal = cleanItems.reduce((acc, it) => acc + it.lineTotal, 0);
  const shippingFee = Math.max(0, Number(data.shippingFee) || 0);
  const discountAmount = Math.max(0, Number(data.discountAmount) || 0);
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

  let normalizedPaymentMethod = (data.paymentMethod || "CASH").toUpperCase().trim();
  let normalizedPaymentStatus = (data.paymentStatus || "UNPAID").toUpperCase().trim();
  let normalizedStatus = (data.status || "CONFIRMED").toUpperCase().trim();
  if (normalizedStatus === "PROCESSING") normalizedStatus = "IN_PRODUCTION";
  if (normalizedStatus === "SHIPPED") normalizedStatus = "DISPATCHED";

  let createdDbOrder: any = null;

  try {
    createdDbOrder = await db.order.create({
      data: {
        orderNumber,
        guestName: customerName,
        guestPhone: customerPhone,
        guestEmail: customerEmail,
        shippingAddress: shippingAddrObj,
        billingAddress: shippingAddrObj,
        paymentMethod: normalizedPaymentMethod,
        paymentStatus: normalizedPaymentStatus,
        status: normalizedStatus as any,
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
        notes: data.notes?.trim() || "Manual Order via Admin Panel",
        items: {
          create: cleanItems.map((it) => ({
            productId: it.productId || null,
            productName: it.productName,
            productSlug: it.productSlug,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
            customText: it.customText,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  } catch (dbErr) {
    console.error("[createAdminOrder] Database order creation error:", dbErr);
  }

  const orderId = createdDbOrder?.id || `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  // Always mirror to persistentStore
  const persisted: PersistedOrder = {
    id: orderId,
    orderNumber,
    userId: null,
    guestName: customerName,
    guestPhone: customerPhone,
    guestEmail: customerEmail,
    status: normalizedStatus,
    subtotal,
    gstAmount: null,
    shippingFee,
    discountAmount,
    totalAmount,
    shippingAddress: shippingAddrObj,
    billingAddress: shippingAddrObj,
    paymentMethod: normalizedPaymentMethod,
    paymentStatus: normalizedPaymentStatus,
    notes: data.notes?.trim() || "Manual Order via Admin Panel",
    items: cleanItems.map((it, idx) => ({
      id: `item_${idx}_${Date.now()}`,
      productId: it.productId,
      productName: it.productName,
      productSlug: it.productSlug,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
      customText: it.customText,
    })),
    createdAt: createdDbOrder?.createdAt ? new Date(createdDbOrder.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    persistentStore.saveOrder(persisted);
  } catch (storeErr) {
    console.warn("[createAdminOrder] persistentStore error:", storeErr);
  }

  // Audit log
  try {
    await db.adminAuditLog.create({
      data: {
        adminEmail,
        entityType: "order",
        entityId: orderId,
        action: "create",
        changes: {
          orderNumber,
          customerName,
          totalAmount,
          paymentMethod: normalizedPaymentMethod,
          paymentStatus: normalizedPaymentStatus,
          status: normalizedStatus,
        },
        ipAddress: ipAddress || null,
      },
    });
  } catch {}

  return { success: true, order: createdDbOrder || persisted };
}
