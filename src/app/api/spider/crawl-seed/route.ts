// src/app/api/spider/crawl-seed/route.ts
//
// Instant VIP Seed Probe Endpoint:
// Allows the owner to drop a calendar URL or seed from mobile, desktop, or chat
// and have it crawled, verified, and ingested in real time (3-5s) on Vercel.
// Discovered child venues and performers are birthed directly into the priority cascade.
//
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { crawlUrl, ingestCrawledEvents, isValidCalendarSourceUrl } from "@/lib/events/crawl";
import { spawnSource } from "@/lib/events/crawl/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // up to 5 min for deep seed extraction

function prettyName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const last = u.pathname.split("/").filter(Boolean).slice(-1)[0];
    return last ? `${host}/${last}` : host;
  } catch {
    return url;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || undefined;
  return handleCrawlSeed(url, name);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body.url || body.seedUrl;
    const name = body.name || undefined;
    return handleCrawlSeed(url, name);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

async function handleCrawlSeed(rawUrl?: string | null, name?: string) {
  if (!rawUrl || !rawUrl.startsWith("http")) {
    return NextResponse.json({ ok: false, error: "A valid http/https URL is required." }, { status: 400 });
  }

  const url = rawUrl.trim();
  if (!isValidCalendarSourceUrl(url)) {
    return NextResponse.json({ ok: false, error: "URL is not an indexable public event calendar or venue hub." }, { status: 422 });
  }

  const started = Date.now();
  try {
    // 1. Immediately crawl the seed with 6-month horizon
    const crawl = await crawlUrl(url, { horizonMonths: 6 });

    // 2. Ingest found events through publishEvent()
    let ingestedCount = 0;
    if (crawl.events.length > 0) {
      const ingestStats = await ingestCrawledEvents(crawl.events, crawl.extractedEmails, {
        origin: "spider_daemon",
        sourceUrl: url,
      });
      ingestedCount = ingestStats.ingested;
    }

    // 3. Register or update the seed in sources with phase = 'priority'
    const seedName = name || prettyName(url);
    const seedRes = await sql.query(
      `INSERT INTO sources (url, name, status, phase, scrape_interval_days, scrape_horizon_months, next_scrape_due, last_scraped_at, updated_at)
       VALUES ($1, $2, 'active', 'priority', 30, 6, NOW() + interval '30 days', NOW(), NOW())
       ON CONFLICT (url)
       DO UPDATE SET phase = 'priority', status = 'active', last_scraped_at = NOW(), updated_at = NOW()
       RETURNING id`,
      [url, seedName]
    );
    const sourceId = seedRes.rows[0]?.id || null;

    // 4. Birth discovered entities (venues / performers / hubs) as priority discovery spiders
    let birthedCount = 0;
    const lineage = { parentSourceId: sourceId, rootSourceId: sourceId, depth: 1 };
    
    // Discovered hubs
    for (const hub of crawl.subUrls) {
      birthedCount += await spawnSource(hub, prettyName(hub), "calendar_hub", 6, lineage);
    }

    // Discovered entities
    for (const ent of crawl.entities) {
      if (ent.url) {
        birthedCount += await spawnSource(ent.url, ent.name, ent.type, 6, lineage);
      }
    }

    const durationMs = Date.now() - started;

    return NextResponse.json({
      ok: true,
      url,
      sourceId,
      name: seedName,
      durationMs,
      fetchStatus: crawl.fetchStatus,
      pageClass: crawl.pageClass,
      eventsFound: crawl.events.length,
      eventsIngested: ingestedCount,
      spidersBirthed: birthedCount,
      message: `Seed verified: ${crawl.events.length} events found, ${ingestedCount} published, ${birthedCount} priority spiders birthed into cascade.`
    });
  } catch (error: any) {
    console.error("[CRAWL_SEED_ERROR]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
