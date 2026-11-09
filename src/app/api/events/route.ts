// src/app/api/events/route.ts
// City events feed for the EventsBlock UI. Verified events only, matched by coordinates
// (see src/lib/events/query.ts). No city-name guessing, no state-abbreviation heuristics.
import { NextResponse } from "next/server";
import { deduplicateEventList } from "@/lib/events/dedup";
import { findPublicEvents, toEventDTO } from "@/lib/events/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: string | null) => (v === null || v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rows = await findPublicEvents({
      lat: num(searchParams.get("lat")),
      lon: num(searchParams.get("lon")),
      citySlug: searchParams.get("slug"),
      nearby: searchParams.get("nearby") === "true",
    });
    const events = deduplicateEventList(rows.map(toEventDTO));
    return NextResponse.json({ ok: true, events }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("GET Events Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch events" }, { status: 500 });
  }
}
