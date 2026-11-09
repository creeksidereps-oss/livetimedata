-- scripts/migrations/2026-11-08_events_location_integrity.sql
-- Phase 1 of the Events rewrite. ADDITIVE ONLY: no columns or rows are dropped here.

ALTER TABLE events ADD COLUMN IF NOT EXISTS city_slug            text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_name         text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude             double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude            double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_verified_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_method      text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS listing_kind         text;   -- 'event' | 'sale'

CREATE INDEX IF NOT EXISTS events_city_slug_date_idx ON events (city_slug, event_date);
CREATE INDEX IF NOT EXISTS events_status_date_idx    ON events (status, event_date);

-- Geocoder answers (Open-Meteo / GeoNames) so the same city is never looked up twice.
CREATE TABLE IF NOT EXISTS geo_lookup_cache (
  query_key  text PRIMARY KEY,
  result     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Every intake decision (published / pending / rejected / duplicate / retry) with its reason.
CREATE TABLE IF NOT EXISTS event_intake_log (
  id         bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  origin     text NOT NULL,
  outcome    text NOT NULL,
  reasons    text[] NOT NULL DEFAULT '{}',
  detail     text,
  event_id   integer,
  title      text,
  source     text,
  payload    jsonb
);
CREATE INDEX IF NOT EXISTS event_intake_log_created_idx ON event_intake_log (created_at);
CREATE INDEX IF NOT EXISTS event_intake_log_outcome_idx ON event_intake_log (outcome, created_at);
