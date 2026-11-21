// src/app/api/cron/spider-lifecycle/route.ts
import { NextResponse } from "next/server";
import { runLifecycleRound } from "@/lib/discovery/spider-lifecycle";

export const dynamic = "force-dynamic";
// Vercel Pro max (~13 min). New jobs stop starting at 7 min and page fetches stop at 10 min, so the job in
// progress always finishes (unfinished pagination is carried to crawl_frontier).
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
    const stats = await runLifecycleRound({ startWindowMs: 7 * 60_000, fetchDeadlineMs: 10 * 60_000 });

    // Perpetual Cascade Baton-Pass:
    // If the active cascade still has discovery spiders waiting,
    // fire an asynchronous pulse immediately to pass the baton so the cascade never sleeps!
    if (stats.hasMoreCascade) {
      try {
        const origin = new URL(request.url).origin;
        const pulseUrl = `${origin}/api/cron/spider-lifecycle?cascade=1`;
        const authHeader = request.headers.get("authorization") || (secret ? `Bearer ${secret}` : "");
        fetch(pulseUrl, {
          method: "GET",
          headers: authHeader ? { authorization: authHeader } : {},
        }).catch((err) => console.warn("[CASCADE_PULSE_FAILED]", err?.message || err));
      } catch (err: any) {
        console.warn("[CASCADE_PULSE_DISPATCH_ERROR]", err?.message || err);
      }
    }

    return NextResponse.json({ success: true, ...stats, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Spider lifecycle error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
