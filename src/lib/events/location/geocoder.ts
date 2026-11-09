// src/lib/events/location/geocoder.ts
//
// Event-intake geocoder. Mirrors the City Search strategy (Open-Meteo first, GeoNames API backup)
// but is a SEPARATE module: it does not import or modify src/app/api/search/route.ts.
// Results are cached in `geo_lookup_cache` so repeated cities cost no API calls.

import { pool } from "@/lib/db";

export interface GeoCandidate {
  name: string;
  admin1: string | null;
  countryCode: string;
  countryName: string | null;
  lat: number;
  lon: number;
  timezone: string | null;
  population: number;
  geonameId: number | null;
  provider: "openmeteo" | "geonames";
}

const memory = new Map<string, GeoCandidate[]>();
const CACHE_DAYS = 90;

async function readCache(key: string): Promise<GeoCandidate[] | null> {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const { rows } = await pool.query(
      `SELECT result FROM geo_lookup_cache WHERE query_key = $1 AND created_at > NOW() - ($2 || ' days')::interval`,
      [key, String(CACHE_DAYS)]
    );
    if (rows[0]) {
      memory.set(key, rows[0].result);
      return rows[0].result;
    }
  } catch { /* cache table missing -> behave as cache miss */ }
  return null;
}

async function writeCache(key: string, result: GeoCandidate[]) {
  memory.set(key, result);
  try {
    await pool.query(
      `INSERT INTO geo_lookup_cache (query_key, result, created_at) VALUES ($1, $2, NOW())
       ON CONFLICT (query_key) DO UPDATE SET result = EXCLUDED.result, created_at = NOW()`,
      [key, JSON.stringify(result)]
    );
  } catch { /* non-fatal */ }
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function openMeteo(name: string, countryCode?: string | null): Promise<GeoCandidate[] | null> {
  let url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=50&language=en&format=json`;
  if (countryCode) url += `&countryCode=${encodeURIComponent(countryCode)}`;
  const data = await fetchJson(url);
  if (!data) return null; // provider failure (distinct from "no results")
  const results: any[] = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((r) => String(r.feature_code || "").startsWith("PPL") && r.country_code)
    .map((r) => ({
      name: String(r.name),
      admin1: r.admin1 ? String(r.admin1) : null,
      countryCode: String(r.country_code).toUpperCase(),
      countryName: r.country ? String(r.country) : null,
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      timezone: r.timezone || null,
      population: Number(r.population) || 0,
      geonameId: Number(r.id) || null,
      provider: "openmeteo" as const,
    }));
}

async function geoNames(name: string, countryCode?: string | null): Promise<GeoCandidate[] | null> {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) return null;
  let url = `https://secure.geonames.org/searchJSON?name_equals=${encodeURIComponent(name)}&maxRows=50&featureClass=P&style=FULL&username=${encodeURIComponent(username)}`;
  if (countryCode) url += `&country=${encodeURIComponent(countryCode)}`;
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data.geonames)) return null;
  return data.geonames
    .filter((r: any) => r.countryCode)
    .map((r: any) => ({
      name: String(r.name),
      admin1: r.adminName1 ? String(r.adminName1) : null,
      countryCode: String(r.countryCode).toUpperCase(),
      countryName: r.countryName ? String(r.countryName) : null,
      lat: Number(r.lat),
      lon: Number(r.lng),
      timezone: r.timezone?.timeZoneId || null,
      population: Number(r.population) || 0,
      geonameId: Number(r.geonameId) || null,
      provider: "geonames" as const,
    }));
}

/**
 * Nearest populated place to real coordinates (from a page's own geo data). GeoNames only, since
 * Open-Meteo has no reverse lookup. Returns null when unavailable or nothing within ~25 km.
 */
export async function nearestPlace(lat: number, lon: number): Promise<GeoCandidate | null> {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) return null;
  const key = `rev1|${lat.toFixed(3)}|${lon.toFixed(3)}`;
  const cached = await readCache(key);
  if (cached) return cached[0] || null;
  const data = await fetchJson(
    `https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lon}&cities=cities1000&radius=25&maxRows=1&style=FULL&username=${encodeURIComponent(username)}`
  );
  if (!data || !Array.isArray(data.geonames)) return null;
  const r = data.geonames[0];
  const out: GeoCandidate[] = r && r.countryCode ? [{
    name: String(r.name),
    admin1: r.adminName1 ? String(r.adminName1) : null,
    countryCode: String(r.countryCode).toUpperCase(),
    countryName: r.countryName ? String(r.countryName) : null,
    lat: Number(r.lat),
    lon: Number(r.lng),
    timezone: r.timezone?.timeZoneId || null,
    population: Number(r.population) || 0,
    geonameId: Number(r.geonameId) || null,
    provider: "geonames",
  }] : [];
  await writeCache(key, out);
  return out[0] || null;
}

/**
 * Look up populated places matching `name` (optionally restricted to one country).
 * Returns [] when nothing matches. Returns null only if BOTH providers failed (network/outage),
 * so callers can retry later instead of discarding a real event.
 */
export async function geocodeCityName(name: string, countryCode?: string | null): Promise<GeoCandidate[] | null> {
  const clean = name.trim();
  if (clean.length < 2) return [];
  const key = `v1|${clean.toLowerCase()}|${(countryCode || "").toUpperCase()}`;
  const cached = await readCache(key);
  if (cached) return cached;

  const primary = await openMeteo(clean, countryCode);
  if (primary && primary.length) {
    await writeCache(key, primary);
    return primary;
  }
  const backup = await geoNames(clean, countryCode);
  if (backup && backup.length) {
    await writeCache(key, backup);
    return backup;
  }
  // Primary failed (outage) and backup had nothing: don't cache, let the caller retry later.
  if (primary === null) return null;
  // Primary answered "no such place" (and backup agreed or is unavailable): cache the empty answer.
  await writeCache(key, []);
  return [];
}
