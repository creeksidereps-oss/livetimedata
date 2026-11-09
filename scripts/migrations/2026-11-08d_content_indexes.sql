-- scripts/migrations/2026-11-08d_content_indexes.sql
-- Speeds up the "city has real content" check used by city robots tags and the sitemap. Additive only.
CREATE INDEX IF NOT EXISTS webcams_city_lower_idx        ON webcams ((LOWER(city_name)));
CREATE INDEX IF NOT EXISTS photos_city_lower_idx         ON photos ((LOWER(city_name)));
CREATE INDEX IF NOT EXISTS city_fun_facts_city_lower_idx ON city_fun_facts ((LOWER(city_name)));
CREATE INDEX IF NOT EXISTS city_reports_lat_lng_idx      ON city_reports (lat, lng);
CREATE INDEX IF NOT EXISTS cities_slug_lower_idx         ON cities ((LOWER(slug)));
