import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/auth-check";
import { persistentStore } from "@/server/storage";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET || "";
    const resendKey = process.env.RESEND_API_KEY || env.RESEND_API_KEY || "";

    const isLive = keyId.startsWith("rzp_live_");
    const isTest = keyId.startsWith("rzp_test_");
    const maskedDisplay = isLive
      ? "rzp_live_••••••••"
      : isTest
      ? "rzp_test_••••••••"
      : keyId && keyId !== "rzp_test_placeholder"
      ? "••••••••"
      : null;

    const gatewayStatus = {
      isRazorpayConfigured: Boolean(keyId && keySecret && keyId !== "rzp_test_placeholder"),
      keyIdMasked: maskedDisplay,
      hasKeySecret: Boolean(keySecret),
      hasWebhookSecret: Boolean(webhookSecret),
      isResendConfigured: Boolean(resendKey && resendKey !== "re_test_placeholder"),
    };

    let settings: any = {};

    // Try PostgreSQL db.storeSetting first
    try {
      const dbSetting = await db.storeSetting.findUnique({
        where: { key: "general_settings" },
      });
      if (dbSetting && dbSetting.value) {
        settings = dbSetting.value;
      }
    } catch {}

    if (!settings || Object.keys(settings).length === 0) {
      settings = persistentStore.getSettings();
    }

    return NextResponse.json({
      success: true,
      settings,
      gatewayStatus,
    });
  } catch (error) {
    console.error("API /api/admin/settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Zero-Trust Security: Strip payment gateway secrets so they are NEVER persisted to DB
    delete body.razorpayKey;
    delete body.razorpaySecret;
    delete body.razorpayWebhookSecret;
    delete body.keySecret;
    delete body.webhookSecret;
    delete body.resendApiKey;

    // Persist to PostgreSQL db.storeSetting
    try {
      await db.storeSetting.upsert({
        where: { key: "general_settings" },
        update: { value: body },
        create: { key: "general_settings", value: body },
      });
    } catch (dbErr) {
      console.error("Could not save store settings:", dbErr);
      return NextResponse.json({ error: "Settings could not be saved. Please retry." }, { status: 503 });
    }

    const updated = persistentStore.saveSettings(body);

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error("API /api/admin/settings POST error:", error);
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}
