// =============================================================================
// POST /api/admin/orders/[id]/notify
// Send or generate customer notification via WhatsApp or Email
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { getOrderById } from "@/server/orders";
import {
  getOrderNotificationText,
  buildWhatsAppClickUrl,
  generateOrderEmailHtml,
  OrderNotificationType,
} from "@/lib/notifications/order-messages";
import { db } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const order: any = await getOrderById(params.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const body = await request.json();
    const { channel, type, customMessage } = body as {
      channel: "whatsapp" | "email";
      type: OrderNotificationType;
      customMessage?: string;
    };

    const customerPhone =
      order.guestPhone || (order.user ? order.user.phone : null);
    const customerEmail =
      order.guestEmail || (order.user ? order.user.email : null);
    const customerName =
      order.guestName || (order.user ? order.user.name : "Valued Customer");

    const payload = {
      orderNumber: order.orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      total: Number(order.totalAmount || order.total || 0),
      status: order.status,
      courierPartner: order.courierPartner,
      trackingNumber: order.trackingNumber,
      items: (order.items || []).map((it: any) => ({
        productName: it.productName,
        quantity: it.quantity,
      })),
    };

    if (channel === "whatsapp") {
      if (!customerPhone) {
        return NextResponse.json(
          { error: "Customer does not have a phone number on this order." },
          { status: 400 }
        );
      }

      const messageText = getOrderNotificationText(type, payload, customMessage);
      const whatsappUrl = buildWhatsAppClickUrl(customerPhone, messageText);

      // Audit log
      try {
        await db.adminAuditLog.create({
          data: {
            adminEmail: auth.user?.email || "admin@example.com",
            entityType: "order_notification",
            entityId: order.id,
            action: `whatsapp_${type}`,
            changes: { phone: customerPhone, preview: messageText.substring(0, 100) },
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        phone: customerPhone,
        message: messageText,
        whatsappUrl,
      });
    }

    if (channel === "email") {
      if (!customerEmail) {
        return NextResponse.json(
          { error: "Customer does not have an email address on this order." },
          { status: 400 }
        );
      }

      const emailData = generateOrderEmailHtml(type, payload, customMessage);

      // Optional email sender integration (e.g. Resend, Sendgrid, or SMTP)
      // If configured via process.env.RESEND_API_KEY, we could send it directly.
      let emailSent = false;
      if (process.env.RESEND_API_KEY) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `StarPress Notifications <${process.env.NOTIFICATION_EMAIL || "orders@example.com"}>`,
              to: [customerEmail],
              subject: emailData.subject,
              html: emailData.html,
            }),
          });
          emailSent = res.ok;
        } catch (e) {
          console.warn("Resend email send error:", e);
        }
      }

      // Audit log
      try {
        await db.adminAuditLog.create({
          data: {
            adminEmail: auth.user?.email || "admin@example.com",
            entityType: "order_notification",
            entityId: order.id,
            action: `email_${type}`,
            changes: { email: customerEmail, subject: emailData.subject, delivered: emailSent },
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        channel: "email",
        email: customerEmail,
        subject: emailData.subject,
        sent: emailSent,
        previewHtml: emailData.html,
      });
    }

    return NextResponse.json(
      { error: "Invalid notification channel. Choose 'whatsapp' or 'email'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(`API /api/admin/orders/${params.id}/notify error:`, error);
    return NextResponse.json(
      { error: error?.message || "Failed to process notification." },
      { status: 500 }
    );
  }
}
