// =============================================================================
// StarPress Customer Notifications & WhatsApp Automation Service
// Generates pre-formatted WhatsApp Click-to-Chat links and email templates
// =============================================================================

export type OrderNotificationType =
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'custom';

export interface OrderNotificationPayload {
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  total: number;
  status: string;
  courierPartner?: string | null;
  trackingNumber?: string | null;
  itemCount?: number;
  items?: Array<{ productName: string; quantity: number }>;
}

const STORE_NAME = 'StarPress Print Studio';
const STORE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://starpress.in';
const SUPPORT_PHONE = '+91 74568 49955';

/**
 * Clean phone number to WhatsApp international standard (+91 for India if not provided)
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Generate message text for WhatsApp & SMS based on order milestone
 */
export function getOrderNotificationText(
  type: OrderNotificationType,
  order: OrderNotificationPayload,
  customMsg?: string
): string {
  const trackingUrl = `${STORE_URL}/orders/track?order=${encodeURIComponent(order.orderNumber)}`;
  const formattedTotal = new Intl.NumberFormat('en-IN').format(order.total);

  switch (type) {
    case 'confirmed':
      return (
        `👋 Hello ${order.customerName},\n\n` +
        `✅ Thank you for your order with *${STORE_NAME}*!\n\n` +
        `📦 *Order Number:* ${order.orderNumber}\n` +
        `💰 *Total Amount:* ₹${formattedTotal}\n` +
        `📄 *Status:* Order Confirmed & Pre-Press Review Underway\n\n` +
        `You can track your order status live anytime here:\n` +
        `🔗 ${trackingUrl}\n\n` +
        `For any design or artwork queries, feel free to reply to this chat.\n\n` +
        `— Team ${STORE_NAME}`
      );

    case 'in_production':
      return (
        `👋 Hello ${order.customerName},\n\n` +
        `🖨️ Great news! Your custom print order *#${order.orderNumber}* has passed pre-press checks and is now *In Production* on our printing presses.\n\n` +
        `⏱️ We are ensuring crisp colors, accurate trimming, and premium finish.\n\n` +
        `Live Tracking:\n` +
        `🔗 ${trackingUrl}\n\n` +
        `— Team ${STORE_NAME}`
      );

    case 'shipped':
      const courier = order.courierPartner || 'our delivery partner';
      const awb = order.trackingNumber || 'Available shortly';
      return (
        `👋 Hello ${order.customerName},\n\n` +
        `🚀 Your order *#${order.orderNumber}* has been *Dispatched*!\n\n` +
        `🚚 *Courier Partner:* ${courier}\n` +
        `🏷️ *AWB / Tracking Number:* ${awb}\n\n` +
        `Track your package live:\n` +
        `🔗 ${trackingUrl}\n\n` +
        `Please ensure someone is available at the delivery address to receive your parcel.\n\n` +
        `— Team ${STORE_NAME}`
      );

    case 'delivered':
      return (
        `👋 Hello ${order.customerName},\n\n` +
        `🎉 Your order *#${order.orderNumber}* has been *Delivered*!\n\n` +
        `We hope your prints exceeded your expectations. If you love your prints, please consider sharing your feedback with us.\n\n` +
        `Need help or a re-order? Contact us anytime at ${SUPPORT_PHONE}.\n\n` +
        `Thank you for trusting *${STORE_NAME}*!\n` +
        `— Team ${STORE_NAME}`
      );

    case 'custom':
      return (
        `👋 Hello ${order.customerName},\n\n` +
        `Regarding your order *#${order.orderNumber}*:\n\n` +
        `${customMsg || 'Thank you for choosing StarPress.'}\n\n` +
        `Track Order: ${trackingUrl}\n\n` +
        `— Team ${STORE_NAME}`
      );
  }
}

/**
 * Generate a direct Click-to-Chat WhatsApp URL
 */
export function buildWhatsAppClickUrl(
  phone: string,
  message: string
): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate HTML Email content for transactional order update
 */
export function generateOrderEmailHtml(
  type: OrderNotificationType,
  order: OrderNotificationPayload,
  customMsg?: string
): { subject: string; html: string } {
  const trackingUrl = `${STORE_URL}/orders/track?order=${encodeURIComponent(order.orderNumber)}`;
  const formattedTotal = new Intl.NumberFormat('en-IN').format(order.total);

  let subject = `Order Update: #${order.orderNumber} - ${STORE_NAME}`;
  let title = 'Order Update';
  let badgeColor = '#FFD000';
  let badgeText = order.status.toUpperCase();
  let messageBody = '';

  if (type === 'confirmed') {
    subject = `Order Confirmed: #${order.orderNumber} - ${STORE_NAME}`;
    title = 'Order Confirmed!';
    badgeText = 'CONFIRMED';
    badgeColor = '#10B981';
    messageBody = `Thank you for your order! We have received your artwork and our pre-press team is verifying the specifications for print production.`;
  } else if (type === 'in_production') {
    subject = `Printing in Progress: #${order.orderNumber} - ${STORE_NAME}`;
    title = 'Your Order is in Production';
    badgeText = 'IN PRODUCTION';
    badgeColor = '#3B82F6';
    messageBody = `Your order has passed file inspection and is currently on the press. We take pride in delivering vibrant colors and accurate finishes.`;
  } else if (type === 'shipped') {
    subject = `Order Dispatched: #${order.orderNumber} via ${order.courierPartner || 'Courier'}`;
    title = 'Your Package is on the Way!';
    badgeText = 'DISPATCHED';
    badgeColor = '#8B5CF6';
    messageBody = `Your print order has been packed with protective corner guards and handed over to <strong>${order.courierPartner || 'Courier'}</strong>. Tracking number: <strong>${order.trackingNumber || 'Pending'}</strong>.`;
  } else if (type === 'delivered') {
    subject = `Order Delivered: #${order.orderNumber} - ${STORE_NAME}`;
    title = 'Order Delivered';
    badgeText = 'DELIVERED';
    badgeColor = '#10B981';
    messageBody = `Your order has been successfully delivered. We hope you are thrilled with your new prints!`;
  } else if (type === 'custom') {
    title = `Note regarding Order #${order.orderNumber}`;
    messageBody = customMsg || 'Thank you for your business.';
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
          .header { padding: 32px; background: linear-gradient(180deg, #1f2937 0%, #111827 100%); text-align: center; border-bottom: 1px solid #1f2937; }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; text-decoration: none; }
          .logo span { color: #FFD000; }
          .content { padding: 32px; }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0; }
          .card { background-color: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .card-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
          .card-row:last-child { margin-bottom: 0; }
          .card-label { color: #64748b; }
          .card-val { color: #f8fafc; font-weight: 600; }
          .button { display: inline-block; background-color: #FFD000; color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; text-align: center; }
          .footer { padding: 24px 32px; background-color: #0b0f19; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1f2937; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="${STORE_URL}" class="logo">
              <img src="${STORE_URL}/images/Logo.png" alt="Star Press" height="40" style="display: block; margin: 0 auto; height: 40px; width: auto;" />
            </a>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Commercial & Business Printing</p>
          </div>
          <div class="content">
            <span class="badge">${badgeText}</span>
            <h1 class="title">${title}</h1>
            <p class="text">Hi ${order.customerName},</p>
            <p class="text">${messageBody}</p>

            <div class="card">
              <div class="card-row">
                <span class="card-label">Order Number:</span>
                <span class="card-val" style="font-family: monospace;">${order.orderNumber}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Total Amount:</span>
                <span class="card-val">₹${formattedTotal}</span>
              </div>
              ${order.courierPartner ? `
              <div class="card-row">
                <span class="card-label">Courier:</span>
                <span class="card-val">${order.courierPartner}</span>
              </div>` : ''}
              ${order.trackingNumber ? `
              <div class="card-row">
                <span class="card-label">Tracking Number:</span>
                <span class="card-val" style="font-family: monospace;">${order.trackingNumber}</span>
              </div>` : ''}
            </div>

            <div style="text-align: center; margin: 32px 0 16px 0;">
              <a href="${trackingUrl}" class="button">Track Your Order Live →</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">Questions? Reply to this email or call our print desk at ${SUPPORT_PHONE}.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} StarPress. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}
