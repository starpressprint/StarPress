import { NextRequest, NextResponse } from "next/server";
import { createBulkOrderInquiry, BulkOrderInquiryInput } from "@/server/inquiries";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitDistributed(`inquiries:bulk:${ip}`, 10, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many inquiry submissions. Please wait a moment.");
    }

    const body = (await request.json()) as BulkOrderInquiryInput;

    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: "Name and contact phone number are required." },
        { status: 400 }
      );
    }

    const result = await createBulkOrderInquiry(body);

    return NextResponse.json({
      success: true,
      inquiryNumber: result.inquiryNumber,
      message: "Bulk order quotation request registered successfully. An enterprise print consultant will reach out shortly.",
    });
  } catch (error) {
    console.error("API /api/inquiries/bulk error:", error);
    return NextResponse.json(
      { error: "Failed to submit bulk quotation request." },
      { status: 500 }
    );
  }
}
