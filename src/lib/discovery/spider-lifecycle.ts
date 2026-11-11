// src/lib/discovery/spider-lifecycle.ts
//
// Living Spider Lifecycle (Vercel cron, every 15 minutes). NEVER run on the owner's laptop.
//
// Each firing is a fresh generation of spiders:
//   - Unfinished pagination from earlier runs (crawl_frontier) is finished first (Rule 12).
//   - Then ONE due source at a time: discovery-phase sources (new / spawned) before monthly recrawls.
//   - Crawl it through the fetch layer (src/lib/events/crawl/fetch.ts); follow its own pagination.
//   - Ingest its events through publishEvent() (ingestCrawledEvents). Venues / performers / organizers named by
//     the page are recorded and spawned as new spiders WHATEVER the event's publish outcome (spider repair
//     2026-11-10: rejected events used to drop their venues, which starved the cascade).
//   - Same-site listing pages (hubs) are spawned; single-event detail pages are not (they are read for data).
//   - Owner rule: only pages that produced current/future events or venues spawn anything. Pages with neither
//     go to `spider_problem_queue` (status 'problem'); that queue decides pruning, not the crawler.
//   - No caps on events / emails / sub-pages (GEMINI.md Rule 10). No pruning for low yield.
//   - The spider dies; the next due source (often a freshly spawned one) is picked up next.
//   - A job that is started is always finished. No new job is started once the start window closes.
//
// Location: a crawl is called with the URL only. Events carry only the location their page states, or the
// venue's own stated address on its own site (owner decision 2026-11-10, verified by resolveLocation()).
// The source row's city/state is never passed down; spawned sources get city_name/state_name NULL.
//
// $0 Google: this engine NEVER calls Gemini or Google Search Grounding. Entities with no URL on the page are
// recorded in `spider_lookup_needed`.
//
// No hardcoded sites. Seeds live in the `sources` table.

import { sql } from "@vercel/postgres";
import { crawlUrl, ingestCrawledEvents, type UrlCrawlResult } from "@/lib/events/crawl";
import { spawnSource } from "@/lib/events/crawl/ingest";
import { looksLikeStreetAddress, type VenueVerifier } from "@/lib/events/crawl/venueLocation";
import { resolveLocation } from "@/lib/events/location/resolveLocation";

export type LifecycleStats = {
  sourcesCrawled: number;
  sourcesFailed: number;
  frontierPagesCrawled: number;
  eventsFound: number;
  eventsIngested: number;
  newEntities: number;
  /** Same-site hub pages registered as new sources. */
  subPagesSpawned: number;
  /** Venue / performer / organizer URLs registered as new sources by ingest. */
  entitySourcesSpawned: number;
  emailsIngested: number;
  lookupsNeeded: number;
  problemsQueued: number;
  /** publishEvent() outcomes: published / pending_review / rejected / duplicate / retry / error. */
  outcomes: Record<string, number>;
  /** publishEvent() outcomes per handler / strategy. */
  handlerOutcomes: Record<string, Record<string, number>>;
  fetchStatus: Record<string, number>;
  log: string[];
};

const DEFAULT_INTERVAL_DAYS = 30; // all new spiders run monthly unless otherwise directed
const MAX_FAILS = 5; // failed task rule: retry in 1h, drop after 5 failures
const HORIZON_MONTHS = 12; // owner: events can be listed up to 12 months ahead (all source types)

export async function ensureLifecycleSchema() {
  // Columns / tables are created by scripts/migrations/2026-11-10_spider_repair.sql. These guards keep an
  // un-migrated database from failing the cron outright.
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
}

type SourceRow = {
  id: number; url: string; name: string | null; scrape_interval_days: number | null; scrape_horizon_months: number | null; fail_count: number;
  parent_source_id: number | null; root_source_id: number | null; depth: number | null;
};

/** Atomically claim the next due source so overlapping runs never crawl the same one. Discovery first. */
async function claimNextSource(): Promise<SourceRow | undefined> {
  const { rows } = await sql.query(
    `UPDATE sources SET next_scrape_due = NOW() + interval '30 minutes', updated_at = NOW()
     WHERE id = (
       SELECT id FROM sources
       WHERE status = 'active' AND url LIKE 'http%' AND (source_type IS NULL OR source_type != 'yardsale_aggregator')
         AND (next_scrape_due IS NULL OR next_scrape_due <= NOW())
       ORDER BY (phase = 'discovery') DESC NULLS LAST,
                (last_scraped_at IS NULL) DESC,
                next_scrape_due ASC NULLS FIRST
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, url, name, scrape_interval_days, scrape_horizon_months, fail_count, parent_source_id, root_source_id, depth`
  );
  return rows[0] as SourceRow | undefined;
}

/** Claim one unfinished pagination page left over by an earlier run. */
async function claimFrontierPage(): Promise<{ id: number; source_id: number; url: string; attempts: number } | undefined> {
  const { rows } = await sql.query(
    `UPDATE crawl_frontier SET status = 'running', attempts = attempts + 1, updated_at = NOW()
     WHERE id = (
       SELECT id FROM crawl_frontier
       WHERE (status = 'pending' OR (status = 'running' AND updated_at < NOW() - interval '30 minutes')) AND attempts < $1
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING id, source_id, url, attempts`,
    [MAX_FAILS]
  );
  return rows[0] as any;
}

async function recordLookupNeeded(name: string | undefined | null, type: string, ev: any, src: { id: number; url: string }): Promise<boolean> {
  const n = (name || "").trim();
  if (!n || n.length < 2) return false;
  // city_name is the page-stated city or '' (never the parent source's city).
  const r = await sql.query(
    `INSERT INTO spider_lookup_needed (entity_name, entity_type, city_name, state_name, found_on_source_id, found_on_url, sample_event_title)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (entity_type, entity_name, city_name)
     DO UPDATE SET times_seen = spider_lookup_needed.times_seen + 1, last_seen_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [n, type, ev.city || "", ev.region || null, src.id, src.url, ev.title || null]
  );
  return Boolean(r.rows[0]?.inserted);
}

async function queueProblem(src: { id: number; url: string; name: string | null }, reason: string, detail: string | null): Promise<void> {
  await sql.query(
    `INSERT INTO spider_problem_queue (source_id, url, name, reason, detail)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_id, reason) DO UPDATE SET times_seen = spider_problem_queue.times_seen + 1, last_seen_at = NOW(), detail = EXCLUDED.detail`,
    [src.id, src.url, src.name, reason, detail]
  );
}

/** Venue-stated address check: must resolve to a verified city AND be street-level (or carry coordinates). */
const verifyVenue: VenueVerifier = async (c) => {
  const hasCoords = c.lat !== undefined && c.lon !== undefined;
  if (!looksLikeStreetAddress(c.street || c.address) && !hasCoords) return null;
  const r = await resolveLocation({ city: c.city ?? null, region: c.region ?? null, country: c.country ?? null, address: c.address, lat: c.lat ?? null, lon: c.lon ?? null, sourceUrl: c.evidenceUrl });
  return r.ok ? { citySlug: r.location.citySlug, cityName: r.location.cityName } : null;
};

function prettyName(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.slice(0, 200);
  } catch {
    return url.slice(0, 200);
  }
}

/** Ingest a crawl result for a source (shared by sources and frontier pages). */
async function ingestCrawl(crawl: UrlCrawlResult, src: SourceRow, stats: LifecycleStats) {
  const lineage = { parentSourceId: src.id, rootSourceId: src.root_source_id ?? src.id, depth: src.depth ?? 0 };
  let ingested = 0, retryNeeded = false, outcomeSummary = "", entitySpawned = 0;
  if (crawl.events.length > 0 || crawl.extractedEmails.length > 0 || crawl.entities.some((e) => e.url)) {
    const r = await ingestCrawledEvents(crawl.events, crawl.extractedEmails, { origin: "crawler", sourceUrl: src.url, entities: crawl.entities, ...lineage });
    ingested = r.ingested;
    retryNeeded = r.retryNeeded;
    entitySpawned = r.sourcesSpawned;
    stats.eventsIngested += r.ingested;
    stats.newEntities += r.newEntities;
    stats.emailsIngested += r.emailsIngested;
    stats.entitySourcesSpawned += r.sourcesSpawned;
    for (const [k, v] of Object.entries(r.outcomes)) stats.outcomes[k] = (stats.outcomes[k] || 0) + v;
    for (const [h, o] of Object.entries(r.handlerOutcomes)) {
      const t = (stats.handlerOutcomes[h] ||= {});
      for (const [k, v] of Object.entries(o)) t[k] = (t[k] || 0) + v;
    }
    outcomeSummary = Object.entries(r.outcomes).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(" ");
  }

  // Entities the page names without any URL: recorded for visibility ($0, no paid lookups).
  for (const ev of crawl.events) {
    if (ev.venue && !ev.venueUrl && (await recordLookupNeeded(ev.venue, "venue", ev, src))) stats.lookupsNeeded++;
    if (ev.performerName && !ev.performerUrl && (await recordLookupNeeded(ev.performerName, "performer", ev, src))) stats.lookupsNeeded++;
    if (ev.organizerName && ev.organizerName !== ev.venue && !ev.organizerUrl && (await recordLookupNeeded(ev.organizerName, "organization", ev, src))) stats.lookupsNeeded++;
  }

  // Same-site hubs (already filtered by the events-or-venues rule and the listing-shape rule). No cap.
  let hubsSpawned = 0;
  for (const hub of crawl.subUrls) hubsSpawned += await spawnSource(hub, prettyName(hub), "calendar_hub", HORIZON_MONTHS, lineage);
  stats.subPagesSpawned += hubsSpawned;

  // Pagination not reached inside this run: carried over to the next run.
  for (const p of crawl.paginationUrls) {
    await sql.query(`INSERT INTO crawl_frontier (source_id, url, kind) VALUES ($1, $2, 'pagination') ON CONFLICT (source_id, url) DO NOTHING`, [src.id, p]);
  }
  return { ingested, retryNeeded, outcomeSummary, hubsSpawned, entitySpawned };
}

async function crawlOneSource(src: SourceRow, stats: LifecycleStats, deadline: number, log: (m: string) => void) {
  try {
    // URL only: the source row's city/state is never handed to the crawler.
    const crawl = await crawlUrl(src.url, { deadline, verifyVenue, horizonMonths: src.scrape_horizon_months ?? HORIZON_MONTHS });
    stats.fetchStatus[crawl.fetchStatus] = (stats.fetchStatus[crawl.fetchStatus] || 0) + 1;
    const venueCount = crawl.entities.filter((e) => e.type === "venue").length + (crawl.siteVenues?.length || 0);

    // Fetch failed and no data API answered: failed-task rule (retry in 1h, drop after 5) + reason recorded.
    if (!crawl.events.length && crawl.fetchStatus !== "ok" && crawl.fetchStatus !== "js_shell") {
      stats.sourcesFailed++;
      const msg = `${crawl.fetchStatus}: ${crawl.fetchDetail || ""}`.slice(0, 1000);
      const { rows } = await sql.query(
        `UPDATE sources SET fail_count = fail_count + 1, last_error = $2, last_fetch_status = $4, last_scraped_at = NOW(),
           handler_queue = COALESCE($5, handler_queue),
           status = CASE WHEN fail_count + 1 >= $3 THEN 'failed' ELSE status END,
           next_scrape_due = NOW() + interval '1 hour', updated_at = NOW() WHERE id = $1
         RETURNING status`,
        [src.id, msg, MAX_FAILS, crawl.fetchStatus, crawl.handlerQueue || null]
      );
      if (rows[0]?.status === "failed") { await queueProblem(src, crawl.fetchStatus, msg); stats.problemsQueued++; }
      log(`#${src.id} ${src.name || src.url}: FAILED (${src.fail_count + 1}/${MAX_FAILS}) ${msg}`);
      return;
    }

    stats.eventsFound += crawl.events.length;
    const r = await ingestCrawl(crawl, src, stats);

    // What happens to this source next, by page class:
    //   hub / facility (has events or a venue) -> monthly recrawl
    //   detail (spawned single-event page)     -> 'detail_page' (its parent hub re-reads it)
    //   no events and no venues                -> 'problem' + spider_problem_queue (that queue decides pruning)
    let status = "active";
    let problem: string | null = null;
    if (!crawl.events.length && crawl.pageClass !== "facility") {
      status = "problem";
      problem = crawl.pageClass === "js_shell" ? "js_shell" : crawl.pageClass === "article" ? "article" : "empty";
    } else if (crawl.pageClass === "detail" && src.parent_source_id) {
      status = "detail_page";
    }
    if (problem) { await queueProblem(src, problem, `${crawl.pageTitle || ""} [${crawl.fetchStatus}]`.trim()); stats.problemsQueued++; }

    await sql.query(
      `UPDATE sources SET last_scraped_at = NOW(), fail_count = 0, last_error = NULL,
         last_fetch_status = $4, page_class = $5, handler_queue = $6, status = $7,
         venue_location = COALESCE($8::jsonb, venue_location), venue_location_status = COALESCE($9, venue_location_status),
         name = CASE WHEN parent_source_id IS NOT NULL AND $10::text IS NOT NULL THEN $10 ELSE name END,
         phase = 'recrawl',
         next_scrape_due = CASE WHEN $3::boolean THEN NOW() + interval '1 hour' ELSE NOW() + make_interval(days => $2::int) END,
         updated_at = NOW() WHERE id = $1`,
      [src.id, src.scrape_interval_days || DEFAULT_INTERVAL_DAYS, r.retryNeeded, crawl.fetchStatus, crawl.pageClass, crawl.handlerQueue || null, status,
       crawl.siteVenues?.length ? JSON.stringify({ venues: crawl.siteVenues, checkedAt: new Date().toISOString() }) : null,
       crawl.venueLocationStatus || null, crawl.pageTitle ? crawl.pageTitle.slice(0, 200) : null]
    );
    stats.sourcesCrawled++;
    log(`#${src.id} ${src.name || src.url}: ${crawl.events.length} found [${crawl.strategies.join(",") || "none"}] class=${crawl.pageClass}` +
      `${crawl.venueLocationStatus ? ` venue_loc=${crawl.venueLocationStatus}` : ""}, ${r.ingested} new${r.outcomeSummary ? ` (${r.outcomeSummary})` : ""}, ` +
      `${venueCount} venues, ${r.entitySpawned} entity + ${r.hubsSpawned} hub spiders spawned${crawl.paginationUrls.length ? `, ${crawl.paginationUrls.length} pages to frontier` : ""}` +
      `${problem ? `, -> problem queue (${problem})` : ""}${r.retryNeeded ? ", geocoder unavailable -> retry in 1h" : ""}`);
  } catch (err: any) {
    stats.sourcesFailed++;
    const msg = String(err?.message || err).slice(0, 1000);
    await sql.query(
      `UPDATE sources SET fail_count = fail_count + 1, last_error = $2, last_scraped_at = NOW(),
         status = CASE WHEN fail_count + 1 >= $3 THEN 'failed' ELSE status END,
         next_scrape_due = NOW() + interval '1 hour', updated_at = NOW() WHERE id = $1`,
      [src.id, msg, MAX_FAILS]
    );
    log(`#${src.id} ${src.name || src.url}: ERROR (${src.fail_count + 1}/${MAX_FAILS}) ${msg}`);
  }
}

async function crawlFrontierPage(page: { id: number; source_id: number; url: string; attempts: number }, stats: LifecycleStats, deadline: number, log: (m: string) => void) {
  const { rows } = await sql.query(`SELECT id, url, name, scrape_interval_days, scrape_horizon_months, fail_count, parent_source_id, root_source_id, depth FROM sources WHERE id = $1`, [page.source_id]);
  const src = rows[0] as SourceRow | undefined;
  if (!src) { await sql.query(`UPDATE crawl_frontier SET status = 'done', updated_at = NOW() WHERE id = $1`, [page.id]); return; }
  try {
    const crawl = await crawlUrl(page.url, { deadline, verifyVenue, horizonMonths: src.scrape_horizon_months ?? HORIZON_MONTHS });
    stats.fetchStatus[crawl.fetchStatus] = (stats.fetchStatus[crawl.fetchStatus] || 0) + 1;
    if (!crawl.events.length && crawl.fetchStatus !== "ok" && crawl.fetchStatus !== "js_shell") {
      await sql.query(`UPDATE crawl_frontier SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'pending' END, last_error = $3, updated_at = NOW() WHERE id = $1`,
        [page.id, MAX_FAILS, `${crawl.fetchStatus}: ${crawl.fetchDetail || ""}`.slice(0, 500)]);
      return;
    }
    stats.eventsFound += crawl.events.length;
    const r = await ingestCrawl(crawl, src, stats);
    await sql.query(`UPDATE crawl_frontier SET status = 'done', updated_at = NOW() WHERE id = $1`, [page.id]);
    stats.frontierPagesCrawled++;
    log(`frontier #${page.id} (source #${src.id}) ${page.url}: ${crawl.events.length} found, ${r.ingested} new${r.outcomeSummary ? ` (${r.outcomeSummary})` : ""}`);
  } catch (err: any) {
    await sql.query(`UPDATE crawl_frontier SET status = 'pending', last_error = $2, updated_at = NOW() WHERE id = $1`, [page.id, String(err?.message || err).slice(0, 500)]);
  }
}

/**
 * One generation of the lifecycle. Finishes leftover pagination first, then takes one source at a time until
 * the start window closes; the job in progress always completes.
 */
export async function runLifecycleRound(opts: { startWindowMs?: number; fetchDeadlineMs?: number } = {}): Promise<LifecycleStats> {
  const startWindowMs = opts.startWindowMs ?? 7 * 60_000;
  const started = Date.now();
  const deadline = started + (opts.fetchDeadlineMs ?? 10 * 60_000);
  const stats: LifecycleStats = {
    sourcesCrawled: 0, sourcesFailed: 0, frontierPagesCrawled: 0, eventsFound: 0, eventsIngested: 0,
    newEntities: 0, subPagesSpawned: 0, entitySourcesSpawned: 0, emailsIngested: 0, lookupsNeeded: 0, problemsQueued: 0,
    outcomes: {}, handlerOutcomes: {}, fetchStatus: {}, log: [],
  };
  const log = (m: string) => stats.log.push(`[${new Date().toISOString()}] ${m}`);

  await ensureLifecycleSchema();

  while (Date.now() - started < startWindowMs) {
    const page = await claimFrontierPage();
    if (page) { await crawlFrontierPage(page, stats, deadline, log); continue; }
    const src = await claimNextSource();
    if (!src) { log("no due sources; generation complete"); break; }
    await crawlOneSource(src, stats, deadline, log);
  }

  // Queue visibility: what is waiting, so a stall shows up in spider_runs.
  const q = await sql.query(
    `SELECT
       COUNT(*) FILTER (WHERE next_scrape_due IS NULL OR next_scrape_due <= NOW())::int AS due,
       COUNT(*) FILTER (WHERE phase = 'discovery')::int AS discovery,
       MIN(next_scrape_due) FILTER (WHERE next_scrape_due > NOW()) AS next_due
     FROM sources WHERE status = 'active' AND url LIKE 'http%' AND (source_type IS NULL OR source_type != 'yardsale_aggregator')`
  );
  const f = await sql.query(`SELECT COUNT(*)::int AS n FROM crawl_frontier WHERE status IN ('pending', 'running')`);
  const queue = q.rows[0] || {};
  log(`queue: ${queue.due ?? 0} due now, ${queue.discovery ?? 0} in discovery, ${f.rows[0]?.n ?? 0} frontier pages, next due ${queue.next_due ? new Date(queue.next_due).toISOString() : "none"}`);

  await sql.query(
    `INSERT INTO spider_runs (started_at, finished_at, duration_ms, sources_crawled, sources_failed, events_found, events_ingested,
       new_entities, sub_pages_spawned, emails_ingested, lookups_needed, log,
       queue_due, queue_discovery, frontier_pending, next_due_at, entity_sources_spawned, problems_queued, fetch_status, outcomes, handler_outcomes)
     VALUES (to_timestamp($1 / 1000.0), NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20::jsonb)`,
    [started, Date.now() - started, stats.sourcesCrawled, stats.sourcesFailed, stats.eventsFound, stats.eventsIngested,
     stats.newEntities, stats.subPagesSpawned, stats.emailsIngested, stats.lookupsNeeded, stats.log.join("\n"),
     queue.due ?? null, queue.discovery ?? null, f.rows[0]?.n ?? null, queue.next_due ?? null, stats.entitySourcesSpawned, stats.problemsQueued,
     JSON.stringify(stats.fetchStatus), JSON.stringify(stats.outcomes), JSON.stringify(stats.handlerOutcomes)]
  );
  return stats;
}
