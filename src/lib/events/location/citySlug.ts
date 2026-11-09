// src/lib/events/location/citySlug.ts
//
// Assigns the canonical /time/{slug} for a VERIFIED city (one that came back from the geocoder).
// The slug order deliberately mirrors the City Search landing branch in src/app/time/[slug]/page.tsx
// (sitemap match -> known entry -> name-admin1 -> name) so a city reached through an event and the
// same city reached through the search box end up on ONE page, not two competing ones.
// This file only READS from cityResolver; it does not change search behaviour.

import { pool } from "@/lib/db";
import { findSitemapMatch, KNOWN_ENTRIES, US_STATE_TO_CODE, isValidRegionName } from "@/lib/cityResolver";
import { distanceKm, isRealCoordinate } from "./geoReference";
import type { GeoCandidate } from "./geocoder";

// Same slugify as the search landing branch (time/[slug]/page.tsx) - must stay identical.
export function landingSlugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SAME_PLACE_KM = 75;

function near(a: { lat: number; lon: number }, lat: unknown, lon: unknown) {
  return isRealCoordinate(lat, lon) && distanceKm(a.lat, a.lon, Number(lat), Number(lon)) <= SAME_PLACE_KM;
}

function proposeSlug(c: GeoCandidate): string {
  // 1. Curated / dataset match - only if it really is the same place.
  const m = findSitemapMatch(c.name, c.admin1, c.countryName, c.countryCode);
  if (m && m.slug && near(c, m.lat, m.lon)) return m.slug;

  // 2. Hand-maintained known entries.
  const normName = c.name.toLowerCase();
  const normAdmin = (c.admin1 || "").toLowerCase();
  const stateCode = US_STATE_TO_CODE[normAdmin] || "";
  if (stateCode) {
    for (const e of KNOWN_ENTRIES) {
      if (e.name.toLowerCase() === normName && e.admin1 && (e.admin1.toLowerCase() === normAdmin || e.admin1.toUpperCase() === stateCode) && near(c, e.lat, e.lon)) {
        return e.slug;
      }
    }
  }

  // 3. Unambiguous name-region slug (same construction as the search landing).
  if (c.admin1 && isValidRegionName(c.admin1)) return `${landingSlugify(c.name)}-${landingSlugify(c.admin1)}`;
  return landingSlugify(c.name);
}

/**
 * Returns the canonical city slug for a verified place and makes sure the `cities` row exists with
 * real coordinates and country. Never overwrites a row that belongs to a different place.
 */
export async function ensureCanonicalCity(c: GeoCandidate): Promise<string> {
  let slug = proposeSlug(c);
  if (!slug) slug = `${landingSlugify(c.name)}-${(c.countryCode || "").toLowerCase()}`;

  const { rows } = await pool.query(`SELECT slug, latitude, longitude FROM cities WHERE slug = $1`, [slug]);
  const existing = rows[0];
  if (existing && isRealCoordinate(existing.latitude, existing.longitude) && !near(c, existing.latitude, existing.longitude)) {
    // Slug is taken by a different place with the same name+region: qualify with the country.
    slug = `${slug}-${landingSlugify(c.countryName || c.countryCode)}`;
  }

  await pool.query(
    `INSERT INTO cities (slug, name, admin1, country_code, country_name, latitude, longitude, timezone, population)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (slug) DO UPDATE SET
       -- only fill in / repair rows that have no verified coordinates; never move a real city
       name         = CASE WHEN cities.latitude IS NULL OR cities.longitude IS NULL THEN EXCLUDED.name ELSE cities.name END,
       admin1       = CASE WHEN cities.latitude IS NULL OR cities.longitude IS NULL THEN EXCLUDED.admin1 ELSE COALESCE(cities.admin1, EXCLUDED.admin1) END,
       country_code = CASE WHEN cities.latitude IS NULL OR cities.longitude IS NULL THEN EXCLUDED.country_code ELSE COALESCE(NULLIF(cities.country_code,''), EXCLUDED.country_code) END,
       country_name = COALESCE(NULLIF(cities.country_name,''), EXCLUDED.country_name),
       timezone     = COALESCE(cities.timezone, EXCLUDED.timezone),
       latitude     = COALESCE(cities.latitude, EXCLUDED.latitude),
       longitude    = COALESCE(cities.longitude, EXCLUDED.longitude)`,
    [slug, c.name, c.admin1, c.countryCode, c.countryName, c.lat, c.lon, c.timezone, c.population || null]
  );
  return slug;
}
