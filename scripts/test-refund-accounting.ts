import { Prisma } from "@prisma/client";
import { processWebhookRefund } from "../src/server/refunds";

type RefundRow = {
  id: string;
  razorpayRefundId: string;
  orderId: string;
  paymentId?: string;
  amount: Prisma.Decimal;
  status: string;
  source: string;
  reason?: string;
};

/** Minimal Prisma-shaped fake. processWebhookRefund itself is production code. */
class MockPrisma {
  order: any;
  refunds = new Map<string, RefundRow>();
  paymentTransactions = new Map<string, any>();
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(orderId: string, totalAmount: number) {
    const row = { id: orderId, totalAmount: new Prisma.Decimal(totalAmount), refundAmount: new Prisma.Decimal(0), refundFlag: null as string | null };
    this.order = {
      findUnique: async ({ where }: any) => where.id === orderId ? row : null,
      update: async ({ data }: any) => Object.assign(row, data),
    };
  }

  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const tx = {
        $queryRaw: async () => [],
        order: this.order,
        refund: {
          findUnique: async ({ where }: any) => [...this.refunds.values()].find((r) => r.razorpayRefundId === where.razorpayRefundId) || null,
          create: async ({ data }: any) => {
            if ([...this.refunds.values()].some((r) => r.razorpayRefundId === data.razorpayRefundId)) {
              const error: any = new Error("Unique constraint"); error.code = "P2002"; error.meta = { target: ["razorpayRefundId"] }; throw error;
            }
            const refund = { id: `refund-${this.refunds.size + 1}`, ...data, amount: new Prisma.Decimal(data.amount) };
            this.refunds.set(refund.id, refund);
            return refund;
          },
          update: async ({ where, data }: any) => {
            const refund = this.refunds.get(where.id) || [...this.refunds.values()].find((r) => r.razorpayRefundId === where.razorpayRefundId);
            if (!refund) throw new Error("Refund missing");
            if (data.razorpayRefundId && [...this.refunds.values()].some((r) => r !== refund && r.razorpayRefundId === data.razorpayRefundId)) {
              const error: any = new Error("Unique constraint"); error.code = "P2002"; error.meta = { target: ["razorpayRefundId"] }; throw error;
            }
            Object.assign(refund, data, data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {});
            return refund;
          },
          aggregate: async ({ where }: any) => {
            const sum = [...this.refunds.values()]
              .filter((r) => r.orderId === where.orderId && (typeof where.status === "string" ? r.status === where.status : where.status?.in?.includes(r.status)))
              .reduce((total, r) => total.plus(r.amount), new Prisma.Decimal(0));
            return { _sum: { amount: sum.isZero() ? null : sum } };
          },
        },
        paymentTransaction: {
          findFirst: async ({ where }: any) => [...this.paymentTransactions.values()].find((t) => t.refundId === where.refundId) || null,
          create: async ({ data }: any) => { this.paymentTransactions.set(data.refundId, data); return data; },
          update: async ({ where, data }: any) => { const row = this.paymentTransactions.get(where.id); Object.assign(row, data); return row; },
        },
      };
      return await callback(tx);
    } finally {
      release();
    }
  }
}

async function main() {
  const orderId = "order-test-1";
  const prisma = new MockPrisma(orderId, 1000);
  const input = (refundId: string, amount: number) => ({
    orderId, refundId, paymentId: "pay_test", amount, status: "processed", rawPayload: { id: refundId },
  });

  const first = await processWebhookRefund(input("rfnd-1", 3.33), prisma as any);
  if (first.finalRefundAmount !== 3.33) throw new Error("Expected ₹3.33 to be accounted exactly");
  const replay = await processWebhookRefund(input("rfnd-1", 3.33), prisma as any);
  if (!replay.skipped) throw new Error("Replay should be skipped by production handler logic");

  await Promise.all([
    processWebhookRefund(input("rfnd-2", 300.01), prisma as any),
    processWebhookRefund(input("rfnd-3", 450.02), prisma as any),
  ]);
  const finalTotal = prisma.order.findUnique ? (await prisma.order.findUnique({ where: { id: orderId } })).refundAmount.toNumber() : 0;
  if (finalTotal !== 753.36) throw new Error(`Concurrent distinct refunds should sum to ₹753.36; got ₹${finalTotal}`);

  const excessive = await processWebhookRefund(input("rfnd-excess", 300), prisma as any);
  const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
  if (!excessive.isExcessive || finalOrder.refundAmount.toNumber() !== 1000 || !finalOrder.refundFlag) {
    throw new Error("Over-refund should clamp the order total and set its dashboard flag");
  }

  const rows = [...prisma.refunds.values()];
  if (rows.some((refund) => refund.source !== "WEBHOOK")) throw new Error("Webhook refund rows must have source=WEBHOOK");
  console.log("PASS: real webhook refund processor handles paise-derived amounts, replay, concurrent refunds, and over-refund flagging");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
