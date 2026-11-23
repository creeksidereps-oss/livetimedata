// src/app/api/cron/spider-lifecycle-3/route.ts
// Staggered Spider Lifecycle Worker #3 (Vercel Cron, :10, :25, :40, :55)
import { NextResponse } from "next/server";
import { runLifecycleRound } from "@/lib/discovery/spider-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runLifecycleRound({ startWindowMs: 7 * 60_000, fetchDeadlineMs: 10 * 60_000 });
    return NextResponse.json({ success: true, ...stats, worker: 3, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Spider lifecycle worker #3 error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
