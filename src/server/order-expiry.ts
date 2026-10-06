import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { auditPaymentEvent } from "@/server/payment-audit";

/**
 * Sweeps the database for UNPAID orders exceeding their paymentExpiresAt timestamp.
 * Marks them CANCELLED and paymentStatus EXPIRED to prevent dangling inventory and rogue captures.
 */
export async function expireStaleOrders(): Promise<{
  scanned: number;
  expired: number;
  orderNumbers: string[];
}> {
  const now = new Date();

  const staleOrders = await db.order.findMany({
    where: {
      status: OrderStatus.PENDING,
      paymentStatus: "UNPAID",
      paymentExpiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      notes: true,
      totalAmount: true,
      guestEmail: true,
    },
  });

  const expiredOrderNumbers: string[] = [];

  for (const order of staleOrders) {
    try {
      const noteAppend = `[ORDER_EXPIRED: ${now.toISOString()} 24-hour payment window closed]`;
      const updatedNotes = order.notes ? `${order.notes} ${noteAppend}` : noteAppend;

      const expired = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
        if (!current || current.status !== OrderStatus.PENDING || current.paymentStatus !== "UNPAID" || !current.paymentExpiresAt || current.paymentExpiresAt > now) {
          return false;
        }

        // Keep the order lock until stock restoration and expiry are committed.
        for (const item of current.items) {
          if (!item.productId) continue;
          await tx.product.updateMany({
            where: { id: item.productId, trackInventory: true },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED, paymentStatus: "EXPIRED", notes: updatedNotes },
        });
        return true;
      });
      if (!expired) continue;

      await auditPaymentEvent({
        orderId: order.id,
        action: "ORDER_EXPIRED",
        actor: "SYSTEM:CRON",
        details: {
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
        },
      });

      expiredOrderNumbers.push(order.orderNumber);
    } catch (err) {
      console.error(`[Order Expiry] Failed to expire order #${order.orderNumber}:`, err);
    }
  }

  return {
    scanned: staleOrders.length,
    expired: expiredOrderNumbers.length,
    orderNumbers: expiredOrderNumbers,
  };
}
