// src/lib/cityResolver.ts
import top100Cities from "../data/top100cities.json";
import top10000Cities from "../data/topCities.json";

export interface ResolvedCity {
  name: string;
  admin1: string;
  country: string;
  country_code: string;
  lat: number;
  lon: number;
  timezone?: string;
  slug: string;
}

// Global Prime Meridian fallback (Greenwich, UK) instead of any local city
export const DEFAULT_PRIME_MERIDIAN_CITY: ResolvedCity = {
  name: "Greenwich",
  admin1: "London",
  country: "United Kingdom",
  country_code: "GB",
  lat: 51.4826,
  lon: 0.0,
  timezone: "UTC",
  slug: "greenwich-london-united-kingdom",
};

// Fast lookup cache built in-memory
const slugMap = new Map<string, ResolvedCity>();
const nameMap = new Map<string, ResolvedCity>();

// 1. Seed top 100 cities (highest metadata quality)
for (const c of top100Cities as any[]) {
  const resolved: ResolvedCity = {
    name: c.name,
    admin1: c.admin1 || "",
    country: c.country,
    country_code: c.country_code || "",
    lat: Number(c.latitude),
    lon: Number(c.longitude),
    timezone: c.timezone,
    slug: c.slug,
  };
  if (c.slug) slugMap.set(c.slug.toLowerCase(), resolved);
  nameMap.set(c.name.toLowerCase(), resolved);
  nameMap.set(c.name.toLowerCase().replace(/[\s_]+/g, "-"), resolved);
}

// 2. Seed 10,000 global cities
for (const c of top10000Cities as any[]) {
  const s = (c.slug || "").toLowerCase();
  if (s && !slugMap.has(s)) {
    const resolved: ResolvedCity = {
      name: c.name,
      admin1: c.admin1 || "",
      country: c.country,
      country_code: c.country === "United States" ? "US" : "",
      lat: Number(c.lat),
      lon: Number(c.lon),
      slug: c.slug,
    };
    slugMap.set(s, resolved);
    const n = c.name.toLowerCase();
    if (!nameMap.has(n)) {
      nameMap.set(n, resolved);
      nameMap.set(n.replace(/[\s_]+/g, "-"), resolved);
    }
  }
}

// Special known cities (e.g. Statesville, NC)
const STATESVILLE_ENTRY: ResolvedCity = {
  name: "Statesville",
  admin1: "North Carolina",
  country: "United States",
  country_code: "US",
  lat: 35.7826,
  lon: -80.8873,
  timezone: "America/New_York",
  slug: "statesville",
};
slugMap.set("statesville", STATESVILLE_ENTRY);
slugMap.set("statesville-nc", STATESVILLE_ENTRY);
nameMap.set("statesville", STATESVILLE_ENTRY);

/**
 * Checks whether an admin1/region string is a valid human-readable region name
 * and filters out raw numeric FIPS/postal codes (e.g. "23", "06", "40").
 */
export function isValidRegionName(admin1?: string | null): boolean {
  if (!admin1) return false;
  const trimmed = admin1.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

/**
 * Resolves a city from a URL slug or query parameters.
 * When allowDefault is false, returns null if no valid city could be resolved,
 * allowing routes to emit a genuine HTTP 404 rather than silently defaulting to Greenwich.
 */
export function resolveCityFromSlug(slug?: string): ResolvedCity;
export function resolveCityFromSlug(slug: string | undefined, allowDefault: false): ResolvedCity | null;
export function resolveCityFromSlug(slug: string | undefined, allowDefault: true): ResolvedCity;
export function resolveCityFromSlug(slug?: string, allowDefault = true): ResolvedCity | null {
  if (!slug) return allowDefault ? DEFAULT_PRIME_MERIDIAN_CITY : null;

  const clean = decodeURIComponent(slug).toLowerCase().trim();

  // 1. Direct slug match
  if (slugMap.has(clean)) {
    return slugMap.get(clean)!;
  }

  // 2. Direct name match (e.g. "paris", "london", "charlotte")
  if (nameMap.has(clean)) {
    return nameMap.get(clean)!;
  }

  // 3. Prefix match on slug (e.g. "statesville" in "statesville-north-carolina")
  for (const [k, v] of slugMap.entries()) {
    if (k.startsWith(clean + "-") || clean.startsWith(k + "-")) {
      return v;
    }
  }

  // 4. Parse hyphenated slug: [city]-[admin1]-[country]
  const parts = clean.split("-");
  if (parts.length >= 2) {
    const candidateName = parts[0];
    if (nameMap.has(candidateName)) {
      return nameMap.get(candidateName)!;
    }
  }

  // Fallback to Prime Meridian (Greenwich) only when explicitly allowed
  return allowDefault ? DEFAULT_PRIME_MERIDIAN_CITY : null;
}
