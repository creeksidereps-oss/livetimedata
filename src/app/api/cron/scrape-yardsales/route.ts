// src/app/api/cron/scrape-yardsales/route.ts
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getActiveTier1Sources } from "@/lib/yardsales/registry";
import {
  scrapeYardSaleSearchForCity,
  scrapeGsalrForCity,
  scrapeEstateSalesForCity,
  scrapeStorageTreasuresLiveAuctions,
  ScrapedYardSale,
} from "@/lib/yardsales/scraper";

export const dynamic = "force-dynamic";
// Vercel Pro max (~13 min). New cities stop starting at 8 min so the city in progress always finishes.
export const maxDuration = 800;

/**
 * Yard Sale / Estate Sale / Live In-Person Auction worker (daily).
 *
 * Owner rules applied:
 *  - No geographic borders: rotates through ALL cities (oldest-run first), no country/state filter.
 *  - Every listing needs a real numeric street address and a real date.
 *  - No made-up start times or hosts. A listing without a confirmed start time goes to `pending_review`.
 *  - Past listings are discarded before insert.
 *  - Per city + per platform yield is tracked in `yardsale_city_source_stats`. Pairs with no listings for
 *    30 days show up in the admin report query (see bottom of file); nothing is auto-culled.
 *
 * Query params: ?city=&state= for a single on-demand city. ?auctions=false to skip StorageTreasures.
 */
const STREET_RE = /\d+\s+([a-zA-Z0-9#.\s]+)/;
const START_WINDOW_MS = 8 * 60_000;
const SPIDERS = 12; // parallel spiders per run (each works one city at a time)

async function ensureSchema() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS yardsale_city_source_stats (
      city_slug TEXT NOT NULL,
      city_name TEXT,
      admin1 TEXT,
      country_code TEXT,
      platform TEXT NOT NULL,
      first_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_found_at TIMESTAMPTZ,
      runs INT NOT NULL DEFAULT 0,
      listings_found_total INT NOT NULL DEFAULT 0,
      PRIMARY KEY (city_slug, platform)
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS yardsale_city_runs (
      city_slug TEXT PRIMARY KEY,
      last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

function isFutureOrToday(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) >= today;
}

function hasConfirmedTime(t?: string): boolean {
  return !!t && /\d/.test(t) && /(am|pm)|^\d{1,2}:\d{2}$/i.test(t.trim()) && !/tbd|tba/i.test(t);
}

/** Insert one listing. Returns 'inserted' | 'duplicate' | 'rejected'. */
async function insertListing(s: ScrapedYardSale, category: string, fallbackSource: string) {
  if (!s.streetAddress || !STREET_RE.test(s.streetAddress)) return "rejected";
  if (!s.cityName || !s.title) return "rejected";
  if (!isFutureOrToday(s.startDate)) return "rejected"; // no date / past date = discard

  const fullAddress = [s.streetAddress, s.cityName, [s.stateName, s.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");

  const dup = await sql.query(
    `SELECT id FROM events WHERE title = $1 AND city_name = $2 AND DATE(event_date) = $3::date LIMIT 1`,
    [s.title, s.cityName, s.startDate.slice(0, 10)]
  );
  if (dup.rows.length) return "duplicate";

  const confirmed = hasConfirmedTime(s.startTime);
  await sql.query(
    `INSERT INTO events (title, city_name, state_name, category, venue, venue_address, hosting_entity, source,
       start_time, event_date, details, official_info_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, $12, $13)`,
    [
      s.title, s.cityName, s.stateName || null, category, s.streetAddress, fullAddress,
      s.hostingEntity || null, s.source || fallbackSource,
      confirmed ? s.startTime : "TBD",
      `${s.startDate.slice(0, 10)}T12:00:00Z`,
      s.description || null, s.url || null,
      confirmed ? "live" : "pending_review",
    ]
  );
  return "inserted";
}

async function recordYield(city: { slug: string; name: string; admin1: string | null; country_code: string | null }, platform: string, found: number) {
  await sql.query(
    `INSERT INTO yardsale_city_source_stats (city_slug, city_name, admin1, country_code, platform, runs, listings_found_total, last_found_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, CASE WHEN $6 > 0 THEN NOW() ELSE NULL END)
     ON CONFLICT (city_slug, platform) DO UPDATE SET
       last_run_at = NOW(),
       runs = yardsale_city_source_stats.runs + 1,
       listings_found_total = yardsale_city_source_stats.listings_found_total + $6,
       last_found_at = CASE WHEN $6 > 0 THEN NOW() ELSE yardsale_city_source_stats.last_found_at END`,
    [city.slug, city.name, city.admin1, city.country_code, platform, found]
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const targetCity = url.searchParams.get("city");
    const targetState = url.searchParams.get("state");
    const includeAuctions = url.searchParams.get("auctions") !== "false";

    // Keep Tier 1 platforms registered in sources (bookkeeping only).
    for (const src of getActiveTier1Sources()) {
      await sql.query(
        `INSERT INTO sources (url, source_type, name, scrape_interval_days, scrape_horizon_months, last_scraped_at, next_scrape_due, status)
         VALUES ($1, 'yardsale_aggregator', $2, 1, 1, NOW(), NOW() + interval '1 day', 'active')
         ON CONFLICT (url) DO UPDATE SET last_scraped_at = NOW(), next_scrape_due = NOW() + interval '1 day', updated_at = NOW()`,
        [`https://${src.domain}`, src.name]
      );
    }

    const totals = { inserted: 0, pendingReview: 0, duplicates: 0, rejected: 0, auctionsInserted: 0, citiesProcessed: 0, citiesRemainingInCycle: 0 };

    // 1. Live in-person storage auctions (one global feed per run)
    if (includeAuctions) {
      const auctions = await scrapeStorageTreasuresLiveAuctions().catch(() => [] as ScrapedYardSale[]);
      for (const a of auctions) {
        const r = await insertListing(a, "Yard / Garage Sales", "StorageTreasures");
        if (r === "inserted") totals.auctionsInserted++;
        else if (r === "duplicate") totals.duplicates++;
        else totals.rejected++;
      }
    }

    // 2. Cities: single on-demand city, or rotate through ALL cities (never-run / oldest-run first).
    //    Several spiders work in parallel inside one run; each takes the next city from a shared queue.
    const queue: { slug: string; name: string; admin1: string | null; country_code: string | null }[] = targetCity
      ? [{ slug: `ondemand-${targetCity}`, name: targetCity, admin1: targetState || null, country_code: null }]
      : ((await sql.query(
          `SELECT c.slug, c.name, c.admin1, c.country_code
           FROM cities c LEFT JOIN yardsale_city_runs r ON r.city_slug = c.slug
           WHERE c.name !~ '^[0-9]+'
           ORDER BY r.last_run_at ASC NULLS FIRST, c.population DESC NULLS LAST`
        )).rows as any[]);
    let next = 0;

    const processCity = async (c: (typeof queue)[number]) => {
      const state = c.admin1 || "";
      const [yss, gsalr, estate] = await Promise.all([
        scrapeYardSaleSearchForCity(c.name, state).catch(() => [] as ScrapedYardSale[]),
        scrapeGsalrForCity(c.name, state).catch(() => [] as ScrapedYardSale[]),
        scrapeEstateSalesForCity(c.name, state).catch(() => [] as ScrapedYardSale[]),
      ]);

      for (const [platform, list] of [["YardSaleSearch", yss], ["Gsalr Network", gsalr], ["EstateSales.NET", estate]] as const) {
        let accepted = 0;
        for (const s of list) {
          const r = await insertListing(s, "Yard / Garage Sales", platform);
          if (r === "inserted") {
            accepted++;
            totals.inserted++;
            if (!hasConfirmedTime(s.startTime)) totals.pendingReview++;
          } else if (r === "duplicate") { accepted++; totals.duplicates++; }
          else totals.rejected++;
        }
        if (!targetCity) await recordYield(c, platform, accepted);
      }

      if (!targetCity) {
        await sql.query(
          `INSERT INTO yardsale_city_runs (city_slug, last_run_at) VALUES ($1, NOW())
           ON CONFLICT (city_slug) DO UPDATE SET last_run_at = NOW()`,
          [c.slug]
        );
      }
      totals.citiesProcessed++;
    };

    // Each spider: take next city, finish it, repeat until the start window closes. No city is abandoned mid-way.
    const spider = async () => {
      while (next < queue.length && Date.now() - started < START_WINDOW_MS) {
        const c = queue[next++];
        try { await processCity(c); } catch (e: any) { console.error(`[yardsales] ${c.name}:`, e?.message); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SPIDERS, queue.length) }, spider));
    totals.citiesRemainingInCycle = Math.max(queue.length - next, 0);

    return NextResponse.json({ success: true, ...totals, durationMs: Date.now() - started, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Error scraping yard sales & auctions:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/*
 * ADMIN REPORT: city + platform pairs with zero listings over a full 30-day cycle (candidates to cull):
 *
 *   SELECT city_name, admin1, country_code, platform, runs, first_run_at, last_found_at
 *   FROM yardsale_city_source_stats
 *   WHERE first_run_at <= NOW() - interval '30 days'
 *     AND (last_found_at IS NULL OR last_found_at <= NOW() - interval '30 days')
 *   ORDER BY country_code, admin1, city_name, platform;
 */
