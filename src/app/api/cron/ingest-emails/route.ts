// src/app/api/cron/ingest-emails/route.ts
import { NextResponse } from "next/server";
import { runEmailIngestion } from "@/lib/email/ingestEmails";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel execution window

/**
 * Scheduled Email Intake Worker
 * Triggered at 6:00 AM, 10:00 AM, 1:00 PM, and 5:00 PM EST via Vercel Cron.
 *
 * Rules:
 *  - Single Intake Gate: All events flow through publishEvent().
 *  - Auto-accepts newsletter confirmation/verification emails immediately.
 *  - Archives yard sale aggregators to 'sale aggregators' and queues into sources.
 *  - Archives personal event/sale submissions to 'personal event emails' and publishes live.
 *  - Archives recognized newsletters/digests to 'Newsletters'.
 *  - Preserves unmatched/new inbound emails in INBOX for review.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runEmailIngestion();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error: any) {
    console.error("[CRON_INGEST_EMAILS_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
