-- scripts/migrations/2026-11-10_spider_repair.sql
-- Spider repair (owner-approved plan, 2026-11-10):
--   A. venue-stated location stored on the source (the venue's own verified address)
--   B. fetch status per source (why a fetch failed)
--   C. page class + lineage (hub / detail / facility / article / js_shell / empty), crawl frontier for
--      pagination that did not finish inside one run, problem queue for pages with no events and no venues
--   D. discovery vs recrawl phase + queue visibility on spider_runs
-- Additive only. No row is deleted. legacy_hold rows are not touched.

ALTER TABLE sources ADD COLUMN IF NOT EXISTS fail_count INT NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS venue_location JSONB;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS venue_location_status TEXT;      -- verified | none | multi_venue
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_status TEXT;          -- ok | waf_blocked | not_found | timeout | network | http_error | js_shell
ALTER TABLE sources ADD COLUMN IF NOT EXISTS page_class TEXT;                 -- hub | detail | facility | article | js_shell | empty
ALTER TABLE sources ADD COLUMN IF NOT EXISTS handler_queue TEXT;              -- design-only handler that should take this source
ALTER TABLE sources ADD COLUMN IF NOT EXISTS phase TEXT;                      -- discovery | recrawl
ALTER TABLE sources ADD COLUMN IF NOT EXISTS parent_source_id INT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS root_source_id INT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS depth INT;

CREATE INDEX IF NOT EXISTS sources_lifecycle_due_idx ON sources (status, phase, next_scrape_due);

CREATE TABLE IF NOT EXISTS crawl_frontier (
  id SERIAL PRIMARY KEY,
  source_id INT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pagination',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | done | failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url)
);
CREATE INDEX IF NOT EXISTS crawl_frontier_pending_idx ON crawl_frontier (status, created_at);

CREATE TABLE IF NOT EXISTS spider_problem_queue (
  id SERIAL PRIMARY KEY,
  source_id INT NOT NULL,
  url TEXT,
  name TEXT,
  reason TEXT NOT NULL,          -- empty | article | js_shell | waf_blocked | not_found | timeout | network | http_error
  detail TEXT,
  times_seen INT NOT NULL DEFAULT 1,
  decision TEXT,                 -- NULL = awaiting review; 'retry' | 'prune' | 'handler'
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, reason)
);

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
);
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS queue_due INT;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS queue_discovery INT;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS frontier_pending INT;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS entity_sources_spawned INT;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS problems_queued INT;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS fetch_status JSONB;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS outcomes JSONB;
ALTER TABLE spider_runs ADD COLUMN IF NOT EXISTS handler_outcomes JSONB;

-- Existing active sources that were already crawled are in the monthly recrawl phase; never-crawled ones are discovery.
UPDATE sources SET phase = CASE WHEN last_scraped_at IS NULL THEN 'discovery' ELSE 'recrawl' END
 WHERE phase IS NULL AND status IN ('active', 'failed');
