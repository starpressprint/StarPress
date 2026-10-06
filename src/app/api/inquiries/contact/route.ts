import { NextRequest, NextResponse } from "next/server";
import { createContactInquiry, ContactInquiryInput } from "@/server/inquiries";
import { rateLimitDistributed, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimitDistributed(`inquiries:contact:${ip}`, 10, 60);
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Too many message submissions. Please wait a moment.");
    }

    const body = (await request.json()) as ContactInquiryInput;

    if (!body.name || !body.message) {
      return NextResponse.json(
        { error: "Name and message are required." },
        { status: 400 }
      );
    }

    const result = await createContactInquiry(body);

    return NextResponse.json({
      success: true,
      inquiryNumber: result.inquiryNumber,
      message: "Your message has been delivered to our desk. We respond to all queries within one business day.",
    });
  } catch (error) {
    console.error("API /api/inquiries/contact error:", error);
    return NextResponse.json(
      { error: "Failed to submit message." },
      { status: 500 }
    );
  }
}
