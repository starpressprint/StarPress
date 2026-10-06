import { NextRequest, NextResponse } from "next/server";
import { reconcilePayments } from "@/server/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: reject all cron requests if CRON_SECRET is not configured
  if (!cronSecret) {
    console.error("[Cron Security] CRON_SECRET is not configured. Rejecting cron request.");
    return NextResponse.json({ error: "Cron security not configured." }, { status: 500 });
  }

  const bearer = authHeader?.replace("Bearer ", "").trim();
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (bearer !== cronSecret && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
  }

  try {
    const result = await reconcilePayments();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("[Cron Reconcile Payments Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process payment reconciliation." },
      { status: 500 }
    );
  }
}
