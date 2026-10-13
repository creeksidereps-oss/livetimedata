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

export const US_STATE_TO_CODE: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
  "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
  "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
  "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
  "montana": "MT", "nebraska": "NE", "nevada": "NV", "new-hampshire": "NH", "new hampshire": "NH",
  "new-jersey": "NJ", "new jersey": "NJ", "new-mexico": "NM", "new mexico": "NM",
  "new-york": "NY", "new york": "NY", "north-carolina": "NC", "north carolina": "NC",
  "north-dakota": "ND", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode-island": "RI", "rhode island": "RI", "south-carolina": "SC",
  "south carolina": "SC", "south-dakota": "SD", "south dakota": "SD", "tennessee": "TN",
  "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west-virginia": "WV", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  "district-of-columbia": "DC", "district of columbia": "DC"
};

export const CA_PROV_TO_CODE: Record<string, string> = {
  "ontario": "08", "quebec": "10", "british-columbia": "02", "british columbia": "02",
  "alberta": "01", "manitoba": "03", "saskatchewan": "11", "nova-scotia": "07",
  "new-brunswick": "04", "newfoundland": "05"
};

// Fast lookup cache built in-memory
const slugMap = new Map<string, ResolvedCity>();
const nameMap = new Map<string, ResolvedCity[]>();

export function normalizeDiacritics(str?: string | null): string {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function addToNameMap(name: string, entry: ResolvedCity) {
  const norm = normalizeDiacritics(name);
  if (!nameMap.has(norm)) nameMap.set(norm, []);
  nameMap.get(norm)!.push(entry);
}

// Dynamically populate all worldwide country names from the 10,000 city dataset
export const ALL_COUNTRIES_SET = new Set<string>();
for (const c of top10000Cities as any[]) {
  if (c.country) {
    ALL_COUNTRIES_SET.add(c.country.toLowerCase().trim());
    ALL_COUNTRIES_SET.add(normalizeDiacritics(c.country));
  }
}
// Universal country aliases & abbreviations
ALL_COUNTRIES_SET.add("united states");
ALL_COUNTRIES_SET.add("usa");
ALL_COUNTRIES_SET.add("us");
ALL_COUNTRIES_SET.add("united kingdom");
ALL_COUNTRIES_SET.add("uk");
ALL_COUNTRIES_SET.add("united arab emirates");
ALL_COUNTRIES_SET.add("uae");
ALL_COUNTRIES_SET.add("south korea");
ALL_COUNTRIES_SET.add("north korea");

// 1. Seed known community entries so their direct city pages resolve cleanly with correct coordinates
export const KNOWN_ENTRIES: (ResolvedCity & { aliases?: string[] })[] = [
  {
    name: "Statesville",
    admin1: "North Carolina",
    country: "United States",
    country_code: "US",
    lat: 35.78264,
    lon: -80.8873,
    timezone: "America/New_York",
    slug: "statesville-north-carolina",
    aliases: ["statesville", "statesville-nc", "statesville-nc-united-states"]
  },
  {
    name: "Mooresville",
    admin1: "North Carolina",
    country: "United States",
    country_code: "US",
    lat: 35.5851,
    lon: -80.8103,
    timezone: "America/New_York",
    slug: "mooresville-north-carolina",
    aliases: ["mooresville", "mooresville-nc"]
  },
  {
    name: "Troutman",
    admin1: "North Carolina",
    country: "United States",
    country_code: "US",
    lat: 35.7032,
    lon: -80.8906,
    timezone: "America/New_York",
    slug: "troutman-north-carolina",
    aliases: ["troutman", "troutman-nc"]
  },
  {
    name: "Galveston",
    admin1: "Texas",
    country: "United States",
    country_code: "US",
    lat: 29.30135,
    lon: -94.7977,
    timezone: "America/Chicago",
    slug: "galveston",
    aliases: ["galveston-tx", "galveston-texas", "galveston-tx-united-states"]
  },
  {
    name: "Paris",
    admin1: "Texas",
    country: "United States",
    country_code: "US",
    lat: 33.66094,
    lon: -95.55551,
    timezone: "America/Chicago",
    slug: "paris-texas",
    aliases: ["paris-tx", "paris-tx-united-states"]
  },
  {
    name: "Clayton",
    admin1: "North Carolina",
    country: "United States",
    country_code: "US",
    lat: 35.65071,
    lon: -78.45639,
    timezone: "America/New_York",
    slug: "clayton-north-carolina",
    aliases: ["clayton-nc", "clayton-nc-united-states"]
  },
  {
    name: "Stokesdale",
    admin1: "North Carolina",
    country: "United States",
    country_code: "US",
    lat: 36.23708,
    lon: -79.97948,
    timezone: "America/New_York",
    slug: "stokesdale-north-carolina",
    aliases: ["stokesdale", "stokesdale-nc", "stokesdale-nc-united-states"]
  }
];

for (const entry of KNOWN_ENTRIES) {
  slugMap.set(entry.slug.toLowerCase(), entry);
  for (const alias of (entry.aliases || [])) {
    slugMap.set(alias.toLowerCase(), entry);
  }
  addToNameMap(entry.name, entry);
}

// 2. Seed top 100 cities (highest metadata quality)
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
  if (c.slug && !slugMap.has(c.slug.toLowerCase())) {
    slugMap.set(c.slug.toLowerCase(), resolved);
  }
  addToNameMap(c.name, resolved);
}

// 3. Seed 10,000 global cities
for (const c of top10000Cities as any[]) {
  const s = (c.slug || "").toLowerCase();
  const resolved: ResolvedCity = {
    name: c.name,
    admin1: c.admin1 || "",
    country: c.country,
    country_code: c.country === "United States" ? "US" : "",
    lat: Number(c.lat),
    lon: Number(c.lon),
    slug: c.slug,
  };
  if (s && !slugMap.has(s)) {
    slugMap.set(s, resolved);
  }
  addToNameMap(c.name, resolved);
}

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
 * Finds an exact matching slug in the 10,000 sitemap cities (topCities.json)
 * or top 100 cities based on city name, admin1/state, and country.
 */
export function findSitemapMatch(
  name: string,
  admin1?: string | null,
  country?: string | null,
  countryCode?: string | null
): ResolvedCity | null {
  const normName = normalizeDiacritics(name);
  if (!normName) return null;
  const normCountry = (country || "").toLowerCase().trim();
  const normAdmin = (admin1 || "").toLowerCase().trim();
  const stateCode = US_STATE_TO_CODE[normAdmin] || (normAdmin.length === 2 ? normAdmin.toUpperCase() : null);
  const caCode = CA_PROV_TO_CODE[normAdmin];

  const list = nameMap.get(normName) || [];
  for (const cand of list) {
    const candCountry = cand.country.toLowerCase();
    const candAdmin = (cand.admin1 || "").toLowerCase();
    const candAdminUpper = (cand.admin1 || "").toUpperCase();

    if (countryCode === "US" || normCountry === "united states" || candCountry === "united states") {
      if (stateCode && cand.admin1 && candAdminUpper === stateCode) {
        return cand;
      }
      if (normAdmin && cand.admin1 && candAdmin === normAdmin) {
        return cand;
      }
    } else if (countryCode === "CA" || normCountry === "canada" || candCountry === "canada") {
      if (caCode && cand.admin1 && (candAdminUpper === caCode || candAdmin === caCode.toLowerCase())) {
        return cand;
      }
      if (normAdmin && cand.admin1 && (candAdmin === normAdmin || candAdminUpper === normAdmin.toUpperCase())) {
        return cand;
      }
      if (normCountry && candCountry === normCountry) {
        return cand;
      }
    } else {
      if (normCountry && candCountry === normCountry) {
        return cand;
      }
    }
  }
  return null;
}

export interface SlugGeographicContext {
  cityName: string;
  qualifier: string;
  country: string;
}

/**
 * Parses hyphenated slugs to identify city name, region/state qualifier, and country suffix.
 * Generalized to support all worldwide countries and Canadian/US administrative regions.
 */
export function parseSlugGeographicContext(slug?: string): SlugGeographicContext {
  if (!slug) return { cityName: "", qualifier: "", country: "" };
  const clean = decodeURIComponent(slug).toLowerCase().trim();
  const parts = clean.split("-");
  if (parts.length < 2) return { cityName: clean, qualifier: "", country: "" };

  let country = "";
  let cityParts = [...parts];

  if (parts.length >= 4) {
    const threeWord = parts.slice(-3).join(" ");
    if (ALL_COUNTRIES_SET.has(threeWord)) {
      country = threeWord;
      cityParts = parts.slice(0, -3);
    }
  }

  if (!country && parts.length >= 3) {
    const twoWord = parts.slice(-2).join(" ");
    if (ALL_COUNTRIES_SET.has(twoWord)) {
      country = twoWord;
      cityParts = parts.slice(0, -2);
    }
  }

  if (!country && parts.length >= 2) {
    const oneWord = parts[parts.length - 1];
    if (ALL_COUNTRIES_SET.has(oneWord)) {
      country = oneWord;
      cityParts = parts.slice(0, -1);
    }
  }

  let qualifier = "";
  if (cityParts.length >= 2) {
    const lastPart = cityParts[cityParts.length - 1];
    const twoWordLast = cityParts.length >= 3 ? cityParts.slice(-2).join(" ") : "";
    const twoWordSlug = cityParts.length >= 3 ? cityParts.slice(-2).join("-") : "";

    if (twoWordLast && (US_STATE_TO_CODE[twoWordLast] || US_STATE_TO_CODE[twoWordSlug] || CA_PROV_TO_CODE[twoWordLast] || CA_PROV_TO_CODE[twoWordSlug])) {
      qualifier = twoWordLast;
      if (US_STATE_TO_CODE[twoWordLast] || US_STATE_TO_CODE[twoWordSlug]) country = country || "united states";
      if (CA_PROV_TO_CODE[twoWordLast] || CA_PROV_TO_CODE[twoWordSlug]) country = country || "canada";
      cityParts = cityParts.slice(0, -2);
    } else if (US_STATE_TO_CODE[lastPart] || (lastPart.length === 2 && Object.values(US_STATE_TO_CODE).includes(lastPart.toUpperCase()))) {
      qualifier = lastPart;
      country = country || "united states";
      cityParts = cityParts.slice(0, -1);
    } else if (CA_PROV_TO_CODE[lastPart]) {
      qualifier = lastPart;
      country = country || "canada";
      cityParts = cityParts.slice(0, -1);
    } else if (/^\d+$/.test(lastPart)) {
      qualifier = lastPart;
      cityParts = cityParts.slice(0, -1);
    }
  }

  const cityName = cityParts.join(" ");
  return { cityName, qualifier, country };
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

  // 2. Parse geographic context and match sitemap directly
  const geo = parseSlugGeographicContext(clean);
  if (geo.cityName) {
    const sitemapMatch = findSitemapMatch(geo.cityName, geo.qualifier, geo.country);
    if (sitemapMatch) {
      return sitemapMatch;
    }
  }

  // 3. Hyphenated qualifier match: [city]-[admin1] or [city]-[admin1]-[country]
  const parts = clean.split("-");
  if (parts.length >= 2) {
    for (let i = 1; i < parts.length; i++) {
      const cityCandidate = parts.slice(0, i).join(" ");
      const qualCandidate = parts.slice(i).join(" ");
      const qualSlug = parts.slice(i).join("-");
      const stateCode = US_STATE_TO_CODE[qualCandidate] || US_STATE_TO_CODE[qualSlug] || (qualCandidate.length === 2 ? qualCandidate.toUpperCase() : null);
      const caCode = CA_PROV_TO_CODE[qualCandidate] || CA_PROV_TO_CODE[qualSlug];

      const candidates = nameMap.get(normalizeDiacritics(cityCandidate)) || [];
      for (const cand of candidates) {
        if (stateCode && cand.admin1 && cand.admin1.toUpperCase() === stateCode) {
          return cand;
        }
        if (caCode && cand.admin1 === caCode && cand.country === "Canada") {
          return cand;
        }
        if (cand.admin1 && cand.admin1.toLowerCase() === qualCandidate) {
          return cand;
        }
        if (cand.country && (cand.country.toLowerCase() === qualCandidate || cand.country.toLowerCase() === qualSlug)) {
          return cand;
        }
      }
    }
  }

  // 4. Exact city name match if single entry or prominent global city
  const normClean = normalizeDiacritics(clean);
  if (nameMap.has(normClean)) {
    const list = nameMap.get(normClean)!;
    if (list.length === 1) return list[0];
    const top100Match = list.find(c => (top100Cities as any[]).some(t => t.slug === c.slug));
    if (top100Match) return top100Match;
    return list[0];
  }

  // 5. Safe prefix match ONLY when the slug has no qualifiers and is unique
  if (!clean.includes("-")) {
    for (const [k, v] of slugMap.entries()) {
      if (k.startsWith(clean + "-")) {
        return v;
      }
    }
  }

  // Fallback to Prime Meridian (Greenwich) only when explicitly allowed
  return allowDefault ? DEFAULT_PRIME_MERIDIAN_CITY : null;
}

