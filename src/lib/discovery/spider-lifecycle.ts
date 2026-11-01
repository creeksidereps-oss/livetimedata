// src/lib/discovery/spider-lifecycle.ts
//
// Living Spider Lifecycle (Vercel cron, every 15 minutes).
//
// Each firing is a fresh generation of spiders:
//   - Take ONE due source from `sources` at a time (no batch cap).
//   - Crawl it fully with the deterministic crawler (no caps on events / emails / sub-pages).
//   - Ingest its events; ingestDiscoveredEvents() spawns new venue / performer / organizer
//     sources (real URLs found on the page) that are due immediately.
//   - Sub-pages are only spawned if they look like a real events/calendar page (Option A gate).
//   - The spider dies; the next due source (often a freshly spawned one) is picked up next.
//   - A job that is started is always finished. No new job is started once the start window closes;
//     remaining work is left to the next firing.
//
// $0 Google: this engine NEVER calls Gemini or Google Search Grounding. Entities that would have
// needed a paid website lookup are recorded in `spider_lookup_needed` so the owner can see what is
// being missed.
//
// No hardcoded sites. Seeds live in the `sources` table.

import { sql } from "@vercel/postgres";
import { extractEventsFromUrl, ingestDiscoveredEvents, isValidCalendarSourceUrl } from "./calendar-crawler";

export type LifecycleStats = {
  sourcesCrawled: number;
  sourcesFailed: number;
  eventsFound: number;
  eventsIngested: number;
  newEntities: number;
  subPagesSpawned: number;
  emailsIngested: number;
  lookupsNeeded: number;
  flaggedForAdmin: number;
  log: string[];
};

const DEFAULT_INTERVAL_DAYS = 30; // all new spiders run monthly unless otherwise directed
const MAX_FAILS = 5; // failed task rule: retry in 1h, drop after 5 failures

export async function ensureLifecycleSchema() {
  await sql.query(`ALTER TABLE sources ADD COLUMN IF NOT EXISTS fail_count INT NOT NULL DEFAULT 0`);
  await sql.query(`ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS spider_lookup_needed (
      id SERIAL PRIMARY KEY,
      entity_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      city_name TEXT,
      state_name TEXT,
      found_on_source_id INT,
      found_on_url TEXT,
      sample_event_title TEXT,
      times_seen INT NOT NULL DEFAULT 1,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entity_type, entity_name, city_name)
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS spider_admin_review (
      id SERIAL PRIMARY KEY,
      source_id INT NOT NULL,
      url TEXT,
      name TEXT,
      reason TEXT NOT NULL,
      sub_pages_found INT,
      times_flagged INT NOT NULL DEFAULT 1,
      decision TEXT, -- NULL = awaiting admin; 'extend' | 'ban' | 'ok'
      first_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_id, reason)
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS spider_runs (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      duration_ms INT,
      sources_crawled INT DEFAULT 0,
      sources_failed INT DEFAULT 0,
      events_found INT DEFAULT 0,
      events_ingested INT DEFAULT 0,
      new_entities INT DEFAULT 0,
      sub_pages_spawned INT DEFAULT 0,
      emails_ingested INT DEFAULT 0,
      lookups_needed INT DEFAULT 0,
      log TEXT
    )`);
}

/** Atomically claim the next due source so overlapping runs never crawl the same one. */
async function claimNextSource() {
  const { rows } = await sql.query(
    `UPDATE sources SET next_scrape_due = NOW() + interval '30 minutes', updated_at = NOW()
     WHERE id = (
       SELECT id FROM sources
       WHERE status = 'active' AND url LIKE 'http%' AND (next_scrape_due IS NULL OR next_scrape_due <= NOW())
       ORDER BY (last_scraped_at IS NULL) DESC,  -- freshly spawned spiders first
                next_scrape_due ASC NULLS FIRST
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, url, name, city_name, state_name, scrape_interval_days, fail_count`
  );
  return rows[0] as
    | { id: number; url: string; name: string | null; city_name: string | null; state_name: string | null; scrape_interval_days: number | null; fail_count: number }
    | undefined;
}

async function recordLookupNeeded(
  name: string | undefined | null,
  type: string,
  ev: any,
  src: { id: number; url: string }
): Promise<boolean> {
  const n = (name || "").trim();
  if (!n || n === "Local Venue" || n.length < 2) return false;
  const r = await sql.query(
    `INSERT INTO spider_lookup_needed (entity_name, entity_type, city_name, state_name, found_on_source_id, found_on_url, sample_event_title)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (entity_type, entity_name, city_name)
     DO UPDATE SET times_seen = spider_lookup_needed.times_seen + 1, last_seen_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [n, type, ev.cityName || null, ev.stateName || null, src.id, src.url, ev.title || null]
  );
  return Boolean(r.rows[0]?.inserted);
}

async function crawlOneSource(
  src: NonNullable<Awaited<ReturnType<typeof claimNextSource>>>,
  stats: LifecycleStats,
  log: (m: string) => void
) {
  try {
    const crawl = await extractEventsFromUrl(src.url, src.city_name || "", src.state_name || "");
    stats.eventsFound += crawl.events.length;

    let ingested = 0;
    if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
      const r = await ingestDiscoveredEvents(crawl.events, crawl.extractedEmails, {
        cityName: src.city_name,
        stateName: src.state_name,
        sourceUrl: src.url,
        venueName: src.name,
      });
      ingested = r.ingested;
      stats.eventsIngested += r.ingested;
      stats.newEntities += r.newEntities;
      stats.emailsIngested += r.emailsIngested;
    }

    // Record entities we could only have followed with a paid Google lookup (no URL on the page).
    for (const ev of crawl.events as any[]) {
      if (ev.venue && !ev.venueUrl && (await recordLookupNeeded(ev.venue, "venue", ev, src))) stats.lookupsNeeded++;
      if (ev.performerName && !ev.performerUrl && (await recordLookupNeeded(ev.performerName, "performer", ev, src))) stats.lookupsNeeded++;
      if (ev.organizerName && ev.organizerName !== ev.venue && !ev.organizerUrl && (await recordLookupNeeded(ev.organizerName, "organization", ev, src))) stats.lookupsNeeded++;
    }

    // Spawn sub-page spiders (Option A gate: only real events/calendar pages).
    let spawned = 0;
    for (const subUrl of crawl.subUrls) {
      if (!isValidCalendarSourceUrl(subUrl)) continue;
      const r = await sql.query(
        `INSERT INTO sources (url, name, source_type, city_name, state_name, status, scrape_interval_days, scrape_horizon_months, next_scrape_due, created_at, updated_at)
         VALUES ($1, $2, 'venue', $3, $4, 'active', $5, 6, NOW(), NOW(), NOW())
         ON CONFLICT (url) DO NOTHING`,
        [subUrl, `${(src.name || "Discovered").replace(/(\s+(Sub-Event|Calendar Hub))+$/i, "").trim()} Calendar Hub`, src.city_name, src.state_name, DEFAULT_INTERVAL_DAYS]
      );
      spawned += r.rowCount ?? 0;
    }
    stats.subPagesSpawned += spawned;

    // 10-page cap hit: flag this source for admin review (extend case-by-case, or permanently ban).
    const subTotal = crawl.subUrlsTotal ?? crawl.subUrls.length;
    if (subTotal > 10) {
      await sql.query(
        `INSERT INTO spider_admin_review (source_id, url, name, reason, sub_pages_found)
         VALUES ($1, $2, $3, 'sub_page_cap_10', $4)
         ON CONFLICT (source_id, reason) DO UPDATE SET sub_pages_found = EXCLUDED.sub_pages_found, last_flagged_at = NOW(), times_flagged = spider_admin_review.times_flagged + 1`,
        [src.id, src.url, src.name, subTotal]
      );
      stats.flaggedForAdmin++;
      log(`#${src.id} hit the 10 sub-page cap (${subTotal} found) -> admin review`);
    }

    await sql.query(
      `UPDATE sources SET last_scraped_at = NOW(), fail_count = 0, last_error = NULL,
         next_scrape_due = NOW() + make_interval(days => $2::int), updated_at = NOW() WHERE id = $1`,
      [src.id, src.scrape_interval_days || DEFAULT_INTERVAL_DAYS]
    );
    stats.sourcesCrawled++;
    log(`#${src.id} ${src.name || src.url}: ${crawl.events.length} found, ${ingested} new, ${spawned} sub-spiders spawned`);
  } catch (err: any) {
    stats.sourcesFailed++;
    const msg = String(err?.message || err).slice(0, 1000);
    await sql.query(
      `UPDATE sources SET fail_count = fail_count + 1, last_error = $2, last_scraped_at = NOW(),
         status = CASE WHEN fail_count + 1 >= $3 THEN 'failed' ELSE status END,
         next_scrape_due = NOW() + interval '1 hour', updated_at = NOW() WHERE id = $1`,
      [src.id, msg, MAX_FAILS]
    );
    log(`#${src.id} ${src.name || src.url}: FAILED (${src.fail_count + 1}/${MAX_FAILS}) ${msg}`);
  }
}

/**
 * One generation of the lifecycle. Keeps taking one source at a time until the start window
 * closes; the job in progress always completes.
 */
export async function runLifecycleRound(opts: { startWindowMs?: number } = {}): Promise<LifecycleStats> {
  const startWindowMs = opts.startWindowMs ?? 8 * 60_000;
  const started = Date.now();
  const stats: LifecycleStats = {
    sourcesCrawled: 0, sourcesFailed: 0, eventsFound: 0, eventsIngested: 0,
    newEntities: 0, subPagesSpawned: 0, emailsIngested: 0, lookupsNeeded: 0, flaggedForAdmin: 0, log: [],
  };
  const log = (m: string) => stats.log.push(`[${new Date().toISOString()}] ${m}`);

  await ensureLifecycleSchema();

  while (Date.now() - started < startWindowMs) {
    const src = await claimNextSource();
    if (!src) { log("no due sources; generation complete"); break; }
    await crawlOneSource(src, stats, log);
  }

  await sql.query(
    `INSERT INTO spider_runs (started_at, finished_at, duration_ms, sources_crawled, sources_failed, events_found, events_ingested,
       new_entities, sub_pages_spawned, emails_ingested, lookups_needed, log)
     VALUES (to_timestamp($1 / 1000.0), NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [started, Date.now() - started, stats.sourcesCrawled, stats.sourcesFailed, stats.eventsFound, stats.eventsIngested,
     stats.newEntities, stats.subPagesSpawned, stats.emailsIngested, stats.lookupsNeeded, stats.log.join("\n")]
  );
  return stats;
}
