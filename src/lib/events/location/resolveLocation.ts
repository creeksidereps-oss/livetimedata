// src/lib/events/location/resolveLocation.ts
//
// THE ONLY place an event gets a location.
//   - Input: what the SOURCE PAGE itself says (city / region / country / address / coordinates).
//   - Output: a verified city (canonical slug + real coordinates + country) or a reason it failed.
// There are NO defaults: no parent-source city, no "Local", no "NC", no "US", no Statesville, no Greenwich.
// A 2-letter region is never assumed to be a US state; a ccTLD is only used to break a tie.

import { geocodeCityName, nearestPlace, type GeoCandidate } from "./geocoder";
import { ensureCanonicalCity } from "./citySlug";
import {
  admin1Matches, ccTldCountry, countryToCode, distanceKm, isCountryName, isIsoCountryCode, isKnownRegionName, isRealCoordinate, normalizeGeoText, regionMeanings,
} from "./geoReference";

export interface LocationHints {
  /** City/locality exactly as written on the source page. */
  city?: string | null;
  /** State / province / region as written on the source page (full name or abbreviation). */
  region?: string | null;
  /** Country as written on the source page (name or ISO-2). */
  country?: string | null;
  /** Full venue address as written on the source page. */
  address?: string | null;
  /** Venue coordinates published by the source page (e.g. JSON-LD geo). */
  lat?: number | string | null;
  lon?: number | string | null;
  /** URL the event was found on (ccTLD used ONLY as a tie-breaker). */
  sourceUrl?: string | null;
}

export interface VerifiedLocation {
  citySlug: string;
  cityName: string;
  admin1: string | null;
  countryCode: string;
  countryName: string | null;
  lat: number;
  lon: number;
  timezone: string | null;
  provider: GeoCandidate["provider"];
  method: string;
}

export type LocationFailure =
  | "no_location_info"
  | "not_found"
  | "ambiguous"
  | "region_mismatch"
  | "provider_unavailable";

export type LocationResult =
  | { ok: true; location: VerifiedLocation }
  | { ok: false; reason: LocationFailure; detail: string };

const CLUSTER_KM = 30;
const COORD_MATCH_KM = 50;

const PLACEHOLDER = /^(local|local city|unknown|n\/?a|tbd|tba|online|virtual|various|multiple|see website|none|null|undefined|-+)$/i;

function cleanToken(s?: string | null): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/** Pull city/region/country hints out of a free-text address WITHOUT inventing anything. */
export function parseAddressHints(address: string): { cityTokens: string[]; region: string | null; country: string | null } {
  const parts = address.split(/[,\n|]+/).map(cleanToken).filter(Boolean);
  let country: string | null = null;
  let region: string | null = null;
  const cityTokens: string[] = [];
  // Country is usually last.
  if (parts.length > 1 && isCountryName(parts[parts.length - 1])) country = parts.pop()!;
  parts.forEach((p, idx) => {
    // "AK 99827" / "NSW 2000" / "ON M5V 2T6"
    const regionPostal = p.match(/^([A-Za-z]{2,3})\s+[A-Za-z0-9]{3,}(?:\s?[A-Za-z0-9]{3})?$/);
    if (regionPostal && regionMeanings(regionPostal[1]).length > 1) { region = regionPostal[1]; return; }
    if (/^[A-Za-z]{2,3}$/.test(p) && regionMeanings(p).length > 1) { region = p; return; }
    // Other 2-letter tokens: an ISO country code ("MP" = Northern Mariana Islands, "GU" = Guam) is a country hint,
    // and no 2-letter token is ever treated as a city name.
    if (/^[A-Za-z]{2}$/.test(p)) { if (isIsoCountryCode(p) && !country) country = p.toUpperCase(); return; }
    // Full region names ("North Carolina", "Ontario") are regions, never city candidates.
    if (isKnownRegionName(p)) { region = region || p; return; }
    // "North Carolina 28677" -> region
    const regionWithPostal = p.match(/^(.+?)\s+[A-Za-z0-9]{3,}(?:[\s-][A-Za-z0-9]{3,4})?$/);
    if (regionWithPostal && isKnownRegionName(regionWithPostal[1])) { region = region || regionWithPostal[1]; return; }
    if (idx === 0 && parts.length > 1 && /\d/.test(p)) return; // street line
    // strip postal codes: "111 22 Stockholm", "75001 Paris", "Stockholm 111 22", "SW1A 1AA"
    const stripped = p.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, " ").replace(/\b\d[\d\s-]{2,}\b/g, " ").replace(/\s+/g, " ").trim();
    if (stripped && !/\d/.test(stripped) && stripped.length >= 3) cityTokens.push(stripped);
  });
  // Later tokens are more likely to be the locality than earlier ones (venue name, street).
  return { cityTokens: cityTokens.reverse(), region, country };
}

function nameMatches(query: string, list: GeoCandidate[]): { cands: GeoCandidate[]; exact: boolean } {
  const q = normalizeGeoText(query);
  const exact = list.filter((c) => normalizeGeoText(c.name) === q);
  if (exact.length) return { cands: exact, exact: true };
  // No exact match: keep alternate-name hits (e.g. "Praha" -> "Prague"), drop simple prefix hits
  // (e.g. "Haines" must not become "Haines City").
  return { cands: list.filter((c) => !normalizeGeoText(c.name).startsWith(q)), exact: false };
}

/** Merge entries that are the same place (same country, within 30 km). Keeps the most populous. */
function cluster(list: GeoCandidate[]): GeoCandidate[] {
  const sorted = [...list].sort((a, b) => b.population - a.population);
  const out: GeoCandidate[] = [];
  for (const c of sorted) {
    if (!out.some((o) => o.countryCode === c.countryCode && distanceKm(o.lat, o.lon, c.lat, c.lon) <= CLUSTER_KM)) out.push(c);
  }
  return out;
}

async function verify(c: GeoCandidate, method: string): Promise<LocationResult> {
  const citySlug = await ensureCanonicalCity(c);
  return {
    ok: true,
    location: {
      citySlug, cityName: c.name, admin1: c.admin1, countryCode: c.countryCode, countryName: c.countryName,
      lat: c.lat, lon: c.lon, timezone: c.timezone, provider: c.provider, method,
    },
  };
}

async function resolveName(
  name: string,
  ctx: { region: string | null; countryCode: string | null; lat: number | null; lon: number | null; tld: string | null },
  method: string
): Promise<LocationResult> {
  const raw = await geocodeCityName(name, ctx.countryCode);
  if (raw === null) return { ok: false, reason: "provider_unavailable", detail: `geocoder unavailable for "${name}"` };
  const nm = nameMatches(name, raw);
  let cands = nm.cands;
  if (!cands.length) return { ok: false, reason: "not_found", detail: `no populated place named "${name}"${ctx.countryCode ? ` in ${ctx.countryCode}` : ""}` };
  // Alternate-name hits (no place literally called `name`) are only trusted when the source also gives an
  // independent qualifier (country / region / coordinates / ccTLD). Prevents "Bank of America Stadium" or
  // "North Carolina" from matching some unrelated village that lists it as an alternate name.
  if (!nm.exact && !ctx.countryCode && !ctx.region && ctx.lat === null && !ctx.tld) {
    return { ok: false, reason: "not_found", detail: `"${name}" is only an alternate name and the source gives no country/region to confirm it` };
  }

  if (ctx.region) {
    const byRegion = cands.filter((c) => admin1Matches(c.admin1, c.countryCode, ctx.region!));
    if (byRegion.length) cands = byRegion;
    else {
      const regionAsCountry = countryToCode(ctx.region);
      const byCountry = regionAsCountry ? cands.filter((c) => c.countryCode === regionAsCountry) : [];
      if (byCountry.length) cands = byCountry;
      else return { ok: false, reason: "region_mismatch", detail: `"${name}" has no match in region "${ctx.region}"` };
    }
  }

  if (ctx.lat !== null && ctx.lon !== null) {
    const byCoord = cands
      .map((c) => ({ c, d: distanceKm(ctx.lat!, ctx.lon!, c.lat, c.lon) }))
      .filter((x) => x.d <= COORD_MATCH_KM)
      .sort((a, b) => a.d - b.d);
    if (byCoord.length) return verify(byCoord[0].c, `${method}+coords`);
  }

  let clusters = cluster(cands);
  if (clusters.length === 1) return verify(clusters[0], method);

  if (ctx.tld) {
    const byTld = clusters.filter((c) => c.countryCode === ctx.tld);
    if (byTld.length === 1) return verify(byTld[0], `${method}+cctld`);
  }

  const options = clusters.slice(0, 4).map((c) => `${c.name}, ${c.admin1 || "?"}, ${c.countryCode}`).join(" | ");
  return { ok: false, reason: "ambiguous", detail: `"${name}" matches ${clusters.length} places: ${options}` };
}

export async function resolveLocation(h: LocationHints): Promise<LocationResult> {
  const city = cleanToken(h.city);
  const address = cleanToken(h.address);
  const hasCoords = isRealCoordinate(h.lat, h.lon);
  const lat = hasCoords ? Number(h.lat) : null;
  const lon = hasCoords ? Number(h.lon) : null;

  const parsed = address ? parseAddressHints(address) : { cityTokens: [], region: null, country: null };
  const region = cleanToken(h.region) || parsed.region || null;
  const countryCode = countryToCode(h.country) || countryToCode(parsed.country) || null;
  const ctx = { region: region && !PLACEHOLDER.test(region) ? region : null, countryCode, lat, lon, tld: ccTldCountry(h.sourceUrl) };

  const names: { name: string; method: string }[] = [];
  if (city && !PLACEHOLDER.test(city) && !/^\d+$/.test(city)) names.push({ name: city, method: "source_city" });
  for (const t of parsed.cityTokens.slice(0, 3)) {
    if (!names.some((n) => normalizeGeoText(n.name) === normalizeGeoText(t)) && !PLACEHOLDER.test(t)) names.push({ name: t, method: "source_address" });
  }

  if (!names.length) {
    if (lat !== null && lon !== null) {
      const place = await nearestPlace(lat, lon);
      if (place) return verify(place, "source_coords");
      return { ok: false, reason: "provider_unavailable", detail: "coordinates given but reverse lookup unavailable" };
    }
    return { ok: false, reason: "no_location_info", detail: "source page gave no city, address or coordinates" };
  }

  let firstFailure: LocationResult | null = null;
  for (const n of names) {
    const r = await resolveName(n.name, ctx, n.method);
    if (r.ok) return r;
    if (r.reason === "provider_unavailable") return r; // retry later rather than mis-resolve
    firstFailure ||= r;
  }
  return firstFailure!;
}
