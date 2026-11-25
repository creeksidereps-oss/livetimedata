// src/app/api/cron/spider-frontier/route.ts
//
// Dedicated Pagination & Deep Detail Worker (Worker #4)
// Runs on a 15-minute interval (:02, :17, :32, :47)
// Exclusively crawls multi-page calendars and detail overflows in crawl_frontier.
// Any newly birthed venues or performers are spawned with phase = 'discovery'
// to feed the 3 live discovery workers.
//
import { NextResponse } from "next/server";
import { runFrontierRound } from "@/lib/discovery/spider-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel Pro max

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runFrontierRound({ startWindowMs: 7 * 60_000, fetchDeadlineMs: 10 * 60_000 });
    return NextResponse.json({
      success: true,
      worker: "frontier",
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error: any) {
    console.error("[CRON_SPIDER_FRONTIER_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
