// =============================================================================
// Transactional Email Service (Resend Integration) — Phase A6
// Safe execution: logs and continues if RESEND_API_KEY is not configured
// Never throws errors that would disrupt order placement or payment recording
// =============================================================================

import { env } from "@/lib/env";

const STORE_NAME = "Star Press Print Studio";
const APP_URL = env.NEXT_PUBLIC_APP_URL || "https://starpress.in";
const RESEND_API_URL = "https://api.resend.com/emails";
const SENDER_EMAIL = process.env.NOTIFICATION_EMAIL || "orders@starpress.in";
const OWNER_EMAIL =
  process.env.ORDER_NOTIFY_EMAIL ||
  process.env.OWNER_ALERT_EMAIL ||
  "owner@starpress.in";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendViaResend(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "re_test_placeholder") {
    console.log(`[Email Service] RESEND_API_KEY not configured. Simulated send to ${JSON.stringify(params.to)}: "${params.subject}"`);
    return false;
  }

  try {
    const toList = Array.isArray(params.to) ? params.to : [params.to];
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        from: `${STORE_NAME} <${SENDER_EMAIL}>`,
        to: toList,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[Email Service] Resend API error response:", res.status, errText);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn("[Email Service] Failed to dispatch email via Resend:", err?.message);
    return false;
  }
}

/**
 * Common HTML Wrapper with StarPress Neon Dark aesthetic
 */
function wrapHtmlEmail(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { padding: 32px; background: linear-gradient(180deg, #1f2937 0%, #111827 100%); text-align: center; border-bottom: 1px solid #1f2937; }
    .logo { font-size: 24px; font-weight: 900; color: #ffffff; text-decoration: none; letter-spacing: -0.5px; }
    .logo span { color: #FFCF1B; }
    .content { padding: 32px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
    .badge-paid { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-proof { background: rgba(255, 207, 27, 0.15); color: #FFCF1B; border: 1px solid rgba(255, 207, 27, 0.3); }
    .badge-failed { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .h1 { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0; }
    .p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0; }
    .box { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155; }
    .row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; }
    .row:last-child { margin-bottom: 0; }
    .lbl { color: #64748b; }
    .val { color: #f8fafc; font-weight: 600; }
    .btn { display: inline-block; background: #FFCF1B; color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 800; text-align: center; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <a href="${APP_URL}" class="logo">
        <img src="${APP_URL}/images/Logo.png" alt="Star Press" height="40" style="display: block; margin: 0 auto; height: 40px; width: auto;" />
      </a>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Commercial & Digital Printing</p>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">Need pre-press help? WhatsApp us at +91 74568 49955.</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Star Press. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Order Placed Email (Pay After Proof / Manual COD)
 */
export async function sendOrderPlacedProofEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  items?: Array<{ productName: string; quantity: number }>;
}): Promise<boolean> {
  const formattedTotal = Number(order.totalAmount).toLocaleString("en-IN");
  const trackUrl = `${APP_URL}/orders/track?order=${encodeURIComponent(order.orderNumber)}`;
  const waUrl = `https://wa.me/917456849955?text=${encodeURIComponent(
    `Hi Star Press, here is my artwork for Order #${order.orderNumber}. Please send the pre-press proof.`
  )}`;

  const body = `
    <span class="badge badge-proof">Pre-Press Proof Required</span>
    <h1 class="h1">Order Received — Pre-Press Proof Underway</h1>
    <p class="p">Hi ${order.customerName},</p>
    <p class="p">Thank you for printing with Star Press! Your order <strong>#${order.orderNumber}</strong> has been received into our pre-flight workflow.</p>
    
    <div class="box">
      <div class="row"><span class="lbl">Order Number:</span><span class="val" style="font-family: monospace;">${order.orderNumber}</span></div>
      <div class="row"><span class="lbl">Total Payable:</span><span class="val">₹${formattedTotal}</span></div>
      <div class="row"><span class="lbl">Payment Preference:</span><span class="val">Pay After Pre-Press Proof Approval</span></div>
    </div>

    <p class="p">Please submit or verify your high-resolution artwork (300 DPI, CMYK) on WhatsApp with our pre-press director to review your digital proof before printing:</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${waUrl}" class="btn" style="background: #25D366; color: #000;">Verify Artwork on WhatsApp →</a>
    </div>

    <p class="p" style="text-align: center; font-size: 12px;">
      Or track order status online: <a href="${trackUrl}" style="color: #FFCF1B;">${trackUrl}</a>
    </p>
  `;

  return sendViaResend({
    to: order.customerEmail,
    subject: `Order Confirmation #${order.orderNumber} — Pre-Press Review [Star Press]`,
    html: wrapHtmlEmail(`Order Confirmed #${order.orderNumber}`, body),
  });
}

/**
 * 2. Payment Received Email (Razorpay Online Success)
 */
export async function sendPaymentReceivedEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  paymentId: string;
}): Promise<boolean> {
  const formattedTotal = Number(order.totalAmount).toLocaleString("en-IN");
  const trackUrl = `${APP_URL}/orders/track?order=${encodeURIComponent(order.orderNumber)}`;

  const body = `
    <span class="badge badge-paid">Payment Verified</span>
    <h1 class="h1">Payment Received — Order Confirmed!</h1>
    <p class="p">Hi ${order.customerName},</p>
    <p class="p">We have successfully received your payment of <strong>₹${formattedTotal}</strong> for Order <strong>#${order.orderNumber}</strong>. Your job has been queued in our production print facility.</p>
    
    <div class="box">
      <div class="row"><span class="lbl">Order Reference:</span><span class="val" style="font-family: monospace;">${order.orderNumber}</span></div>
      <div class="row"><span class="lbl">Payment Transaction ID:</span><span class="val" style="font-family: monospace;">${order.paymentId}</span></div>
      <div class="row"><span class="lbl">Amount Paid:</span><span class="val">₹${formattedTotal} (All inclusive)</span></div>
      <div class="row"><span class="lbl">Production Stage:</span><span class="val" style="color: #10B981;">CONFIRMED & QUEUED</span></div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${trackUrl}" class="btn">Track Production & Dispatch Live →</a>
    </div>
  `;

  return sendViaResend({
    to: order.customerEmail,
    subject: `Payment Confirmed: Order #${order.orderNumber} [Star Press]`,
    html: wrapHtmlEmail(`Payment Received #${order.orderNumber}`, body),
  });
}

/**
 * 3. Payment Failed Email (with retry checkout link)
 */
export async function sendPaymentFailedEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  reason?: string;
}): Promise<boolean> {
  const formattedTotal = Number(order.totalAmount).toLocaleString("en-IN");
  const checkoutUrl = `${APP_URL}/checkout`;

  const body = `
    <span class="badge badge-failed">Payment Incomplete</span>
    <h1 class="h1">Payment Could Not Be Completed</h1>
    <p class="p">Hi ${order.customerName},</p>
    <p class="p">We noticed your recent payment attempt for print order <strong>#${order.orderNumber}</strong> was not completed.${order.reason ? ` Reason: <em>${order.reason}</em>.` : ""}</p>
    
    <p class="p">Don't worry — your print configurations and cart items are preserved. You can retry with UPI, Credit/Debit card, or choose Pay After Proof.</p>

    <div class="box">
      <div class="row"><span class="lbl">Order Number:</span><span class="val" style="font-family: monospace;">${order.orderNumber}</span></div>
      <div class="row"><span class="lbl">Order Total:</span><span class="val">₹${formattedTotal}</span></div>
      <div class="row"><span class="lbl">Payment Status:</span><span class="val" style="color: #EF4444;">UNPAID</span></div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${checkoutUrl}" class="btn">Retry Payment Securely →</a>
    </div>
  `;

  return sendViaResend({
    to: order.customerEmail,
    subject: `Payment Alert: Action Required for Order #${order.orderNumber} [Star Press]`,
    html: wrapHtmlEmail(`Payment Notice #${order.orderNumber}`, body),
  });
}

/**
 * 4. Owner Alert on PAID Order
 */
export async function notifyOwnerOrderPaid(order: {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  totalAmount: number;
  paymentId: string;
  itemCount?: number;
}): Promise<boolean> {
  const formattedTotal = Number(order.totalAmount).toLocaleString("en-IN");
  const adminUrl = `${APP_URL}/admin/orders`;

  const body = `
    <span class="badge badge-paid">New Captured Payment</span>
    <h1 class="h1">₹${formattedTotal} Received: Order #${order.orderNumber}</h1>
    <p class="p">An online payment was captured and verified through Razorpay.</p>
    
    <div class="box">
      <div class="row"><span class="lbl">Order Number:</span><span class="val" style="font-family: monospace;">${order.orderNumber}</span></div>
      <div class="row"><span class="lbl">Customer:</span><span class="val">${order.customerName}</span></div>
      <div class="row"><span class="lbl">Phone:</span><span class="val">${order.customerPhone || "N/A"}</span></div>
      <div class="row"><span class="lbl">Email:</span><span class="val">${order.customerEmail || "N/A"}</span></div>
      <div class="row"><span class="lbl">Amount Captured:</span><span class="val">₹${formattedTotal}</span></div>
      <div class="row"><span class="lbl">Razorpay Payment ID:</span><span class="val" style="font-family: monospace;">${order.paymentId}</span></div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${adminUrl}" class="btn">Open Admin Orders →</a>
    </div>
  `;

  return sendViaResend({
    to: OWNER_EMAIL,
    subject: `💰 [PAID ₹${formattedTotal}] New Order #${order.orderNumber} - ${order.customerName}`,
    html: wrapHtmlEmail(`New PAID Order #${order.orderNumber}`, body),
  });
}
