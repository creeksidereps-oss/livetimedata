// src/lib/seo/cityCanonical.ts
//
// ONE rule for "which URL is the official page for this city?" Used by:
//   - the /time and /weather page canonical tags + robots
//   - the sitemap
//   - event intake (events link to the official city page)
// so the canonical tag, the sitemap, and event links can never disagree.
//
// Why: the `cities` table holds several rows for the same place (e.g. ashland-nh, ashland-new-hampshire,
// ashland-nh-united-states) and junk rows created from attack URLs (e.g. "1-and-11-union-select-null-bangkok").
// A place's official slug is chosen deterministically from CLEAN slugs only.

import { pool } from "@/lib/db";
import { findSitemapMatch, resolveCityFromSlug } from "@/lib/cityResolver";
import { INDEXABLE_CITIES } from "@/lib/indexableCities";
import { CITY_HAS_CONTENT_SQL } from "./cityIndexability";

export interface CityPlace {
  name: string;
  admin1?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat: number;
  lon: number;
  slug?: string | null;
}

const SAME_PLACE_KM = 25;
// SQL-injection probe fragments seen in real attack URLs. Specific enough not to hit real places
// (Union NJ, Sleepy Hollow, Selma ... are fine).
const JUNK_RE = /(union-all|union-select|-select-|select-null|concat0x|extractvalue|order-by-\d|sleep-?\d|waitfor|benchmark-?\d|sysibm|rdbdatabase|information-schema|0x[0-9a-f]{6}|-and-\d+-?\d*-(union|select)|ucypwh)/;

/** Same slugify as the search-landing branch of the city pages. */
export function landingSlugify(text: string): string {
  return String(text || "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

/** A slug that could legitimately be a city page URL (no attack strings, sane characters/length). */
export function isCleanCitySlug(slug?: string | null): boolean {
  const s = String(slug || "");
  return s.length >= 2 && s.length <= 80 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && !JUNK_RE.test(s);
}

const norm = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const near = (p: { lat: number; lon: number }, lat: any, lon: any) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && km(p.lat, p.lon, Number(lat), Number(lon)) <= SAME_PLACE_KM;

type Row = { slug: string; name: string; admin1: string | null; country_name: string | null; country_code: string | null; lat: number; lon: number };
let rowIndex: { at: number; byName: Map<string, Row[]>; bySlug: Map<string, Row> } | null = null;
const INDEX_TTL_MS = 10 * 60 * 1000;

async function cityIndex() {
  if (rowIndex && Date.now() - rowIndex.at < INDEX_TTL_MS) return rowIndex;
  const { rows } = await pool.query(
    `SELECT slug, name, admin1, country_name, country_code, latitude AS lat, longitude AS lon
       FROM cities WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
  );
  const byName = new Map<string, Row[]>(), bySlug = new Map<string, Row>();
  for (const r of rows as Row[]) {
    if (!r.slug || !r.name) continue;
    const k = norm(r.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(r);
    bySlug.set(String(r.slug).toLowerCase(), r);
  }
  rowIndex = { at: Date.now(), byName, bySlug };
  return rowIndex;
}

/** The official slug for a place. Deterministic; never returns a junk slug. */
export async function canonicalCitySlug(place: CityPlace): Promise<string> {
  // 1. Curated / dataset city (already-indexed, stable URLs) - only if it is really the same place.
  const m = findSitemapMatch(place.name, place.admin1 || null, place.country || null, place.countryCode || null);
  if (m?.slug && isCleanCitySlug(m.slug.toLowerCase()) && near(place, m.lat, m.lon)) return m.slug.toLowerCase();

  // 2. Same-place rows in the cities table (same name, within 25 km, clean slug that starts with the name).
  const nameSlug = landingSlugify(place.name);
  const preferred = place.admin1 ? `${nameSlug}-${landingSlugify(place.admin1)}` : nameSlug;
  const idx = await cityIndex();
  const rows = (idx.byName.get(norm(place.name)) || []).filter(
    (r) => isCleanCitySlug(String(r.slug).toLowerCase()) && String(r.slug).toLowerCase().startsWith(nameSlug) && near(place, r.lat, r.lon)
  );
  if (rows.length) {
    const slugs = rows.map((r) => String(r.slug).toLowerCase());
    if (slugs.includes(preferred)) return preferred;
    return slugs.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  // 3. No existing row: the page's own slug if clean, else the search-landing format.
  const own = String(place.slug || "").toLowerCase();
  return isCleanCitySlug(own) ? own : preferred;
}

/** Resolve a stored/curated slug to its place, in the SAME order the city page uses:
 *  exact dataset slug -> exact cities-table row -> loose dataset match. */
export async function placeForSlug(slug: string): Promise<CityPlace | null> {
  const s = String(slug || "").toLowerCase();
  const m = resolveCityFromSlug(s, false);
  const mOk = !!m && (m.lat !== 0 || m.lon !== 0);
  const fromMemory = (): CityPlace => ({ name: m!.name, admin1: m!.admin1, country: m!.country, countryCode: m!.country_code, lat: m!.lat, lon: m!.lon, slug: m!.slug });
  if (mOk && m!.slug && m!.slug.toLowerCase() === s) return fromMemory();
  const r = isCleanCitySlug(s) ? (await cityIndex()).bySlug.get(s) : undefined;
  if (r && (Number(r.lat) !== 0 || Number(r.lon) !== 0)) return { name: r.name, admin1: r.admin1, country: r.country_name, countryCode: r.country_code, lat: Number(r.lat), lon: Number(r.lon), slug: r.slug };
  return mOk ? fromMemory() : null;
}

let curatedCache: { at: number; set: Set<string> } | null = null;
/** Official slugs of every curated city (indexableCities.json + homepage top-100). */
export async function curatedCanonicalSlugs(): Promise<Set<string>> {
  if (curatedCache && Date.now() - curatedCache.at < INDEX_TTL_MS) return curatedCache.set;
  const set = new Set<string>();
  for (const c of INDEXABLE_CITIES) {
    const p = await placeForSlug(c.slug);
    if (!p) continue; // page can't resolve this city (it would 404) - never list it
    const canon = await canonicalCitySlug(p);
    if (isCleanCitySlug(canon)) set.add(canon);
  }
  curatedCache = { at: Date.now(), set };
  return set;
}

/**
 * Should this place's official page be indexed? Curated, OR any row for the same place has real content.
 * Same rule the sitemap uses, so robots tags and the sitemap agree.
 */
export async function isPlaceIndexable(place: CityPlace, canonicalSlug: string): Promise<boolean> {
  if ((await curatedCanonicalSlugs()).has(canonicalSlug)) return true;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM cities c
        WHERE LOWER(c.name) = LOWER($1)
          AND c.latitude BETWEEN $2::float8 - 0.25 AND $2::float8 + 0.25
          AND c.longitude BETWEEN $3::float8 - 0.25 AND $3::float8 + 0.25
          AND ${CITY_HAS_CONTENT_SQL}
        LIMIT 1`,
      [place.name, place.lat, place.lon]
    );
    return rows.length > 0;
  } catch (e) {
    console.warn("[cityCanonical] indexability check failed:", (e as any)?.message);
    return false;
  }
}
