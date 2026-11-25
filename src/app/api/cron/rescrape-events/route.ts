// src/app/api/cron/rescrape-events/route.ts
//
// Dedicated 30-Day Recrawl & Maintenance Worker (Worker #5)
// Runs on a 15-minute interval (:07, :22, :37, :52)
// Exclusively crawls established sources in sources where phase = 'recrawl'.
// Reschedules crawled venues by 30 days and feeds birthed performers/venues
// into phase = 'discovery' for Workers 1, 2, and 3.
//
import { NextResponse } from "next/server";
import { runRecrawlRound } from "@/lib/discovery/spider-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel Pro max

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runRecrawlRound({ startWindowMs: 7 * 60_000, fetchDeadlineMs: 10 * 60_000 });
    return NextResponse.json({
      success: true,
      worker: "recrawl",
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error: any) {
    console.error("[CRON_RESCRAPE_EVENTS_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
