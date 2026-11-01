// src/app/api/cron/spider-lifecycle/route.ts
import { NextResponse } from "next/server";
import { runLifecycleRound } from "@/lib/discovery/spider-lifecycle";

export const dynamic = "force-dynamic";
// Vercel Pro max (~13 min). New jobs stop starting at 8 min so the job in progress always finishes.
export const maxDuration = 800;

/**
 * Living Spider Lifecycle (Vercel Cron, every 15 minutes).
 * Each firing is a new generation: one source at a time -> crawl -> spawn -> die, until the start window closes.
 * $0 Google: never calls Gemini / Search Grounding. Missed lookups are logged to `spider_lookup_needed`.
 * If CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runLifecycleRound({ startWindowMs: 8 * 60_000 });
    return NextResponse.json({ success: true, ...stats, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Spider lifecycle error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
