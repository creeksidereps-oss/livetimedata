// src/lib/seo/cityIndexability.ts
//
// A city page becomes indexable automatically once it has REAL content (owner rule, Nov 8 2026):
//   - a verified upcoming event (events.city_slug), or
//   - a city report, approved fun fact, live photo, or live webcam for that city,
//   - or it is in the curated set (src/data/indexableCities.json + homepage top-100).
// Pages without content stay live but noindex. Used by city page robots tags AND the sitemap,
// so the two can never disagree.

import { pool } from "@/lib/db";
import { isIndexableCitySlug } from "@/lib/indexableCities";

/** SQL predicate (alias `c` = cities row) - true when the city has real content. */
export const CITY_HAS_CONTENT_SQL = `(
  EXISTS (SELECT 1 FROM events e
           WHERE e.city_slug = c.slug AND e.status IN ('live','published','approved','scheduled')
             AND e.event_date >= CURRENT_DATE)
  OR EXISTS (SELECT 1 FROM city_reports r
           WHERE r.lat BETWEEN c.latitude - 0.03 AND c.latitude + 0.03
             AND r.lng BETWEEN c.longitude - 0.03 AND c.longitude + 0.03)
  OR EXISTS (SELECT 1 FROM city_fun_facts f
           WHERE LOWER(f.city_name) = LOWER(c.name)
             AND (f.is_approved = true OR f.status IN ('approved','live'))
             AND (f.state_name IS NULL OR c.admin1 IS NULL OR LOWER(f.state_name) = LOWER(c.admin1)))
  OR EXISTS (SELECT 1 FROM photos ph
           WHERE ph.status = 'live' AND LOWER(ph.city_name) = LOWER(c.name)
             AND (ph.state_name IS NULL OR c.admin1 IS NULL OR LOWER(ph.state_name) = LOWER(c.admin1)))
  OR EXISTS (SELECT 1 FROM webcams w
           WHERE w.status = 'live' AND LOWER(w.city_name) = LOWER(c.name)
             AND (w.state_name IS NULL OR c.admin1 IS NULL OR LOWER(w.state_name) = LOWER(c.admin1)))
)`;

const cache = new Map<string, { v: boolean; at: number }>();
const TTL_MS = 10 * 60 * 1000;

/** Is this city page indexable right now? Never throws (falls back to the curated set). */
export async function isCityIndexable(slug: string | null | undefined): Promise<boolean> {
  if (!slug) return false;
  if (isIndexableCitySlug(slug)) return true;
  const key = slug.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM cities c
        WHERE LOWER(c.slug) = $1 AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
          AND ${CITY_HAS_CONTENT_SQL}
        LIMIT 1`,
      [key]
    );
    const v = rows.length > 0;
    cache.set(key, { v, at: Date.now() });
    return v;
  } catch (e) {
    console.warn("[cityIndexability] check failed:", (e as any)?.message);
    return false;
  }
}
