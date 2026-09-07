import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SourceResult = {
  id?: number;
  geonameId?: number;
  name?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  country?: string;
  countryName?: string;
  country_code?: string;
  countryCode?: string;
  admin1?: string;
  adminName1?: string;
  timezone?: string | { timeZoneId?: string };
  population?: number | string;
};

type SearchResult = {
  slug: string;
  href: string;
  name: string;
  admin1: string | null;
  country_name: string | null;
  country_code: string | null;
  population: number | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  source: "openmeteo" | "geonames";
};

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSpaces(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function expandStateAbbreviation(value: string) {
  const cleaned = normalizeSpaces(value);
  const upper = cleaned.toUpperCase();
  return US_STATE_ABBREVIATIONS[upper] ?? cleaned;
}

function buildFallbackQueries(raw: string): string[] {
  const cleaned = normalizeSpaces(raw);
  const parts = cleaned.split(" ").filter(Boolean);
  const fallbacks: string[] = [];

  if (!cleaned) return fallbacks;

  if (cleaned.includes(",")) {
    fallbacks.push(cleaned);
    return fallbacks;
  }

  if (parts.length >= 2) {
    const city = parts.slice(0, -1).join(" ");
    const region = expandStateAbbreviation(parts[parts.length - 1]);
    const comma = `${city}, ${region}`;

    fallbacks.push(comma);
    fallbacks.push(`${comma}, United States`);
    fallbacks.push(`${comma}, US`);
    fallbacks.push(`${comma}, USA`);
  }

  return fallbacks;
}

function parseQuery(raw: string) {
  const cleaned = normalizeSpaces(raw);
  const normalized = normalizeText(cleaned);

  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((p) => normalizeSpaces(p)).filter(Boolean);
    const city = parts[0] || cleaned;
    const qualifiers = parts.slice(1).map(expandStateAbbreviation);

    return {
      city,
      qualifiers,
      normalized,
    };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return {
      city: cleaned,
      qualifiers: [] as string[],
      normalized,
    };
  }

  const city = parts.slice(0, -1).join(" ");
  const qualifier = expandStateAbbreviation(parts[parts.length - 1]);

  return {
    city,
    qualifiers: [qualifier],
    normalized,
  };
}

async function fetchOpenMeteo(name: string): Promise<SourceResult[]> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(name)}` +
    `&count=100&language=en&format=json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}

async function fetchGeoNames(name: string): Promise<SourceResult[]> {
  const username = process.env.GEONAMES_USERNAME;
  if (!username) return [];

  const url =
    "https://secure.geonames.org/searchJSON" +
    `?q=${encodeURIComponent(name)}` +
    `&maxRows=100&featureClass=P&style=FULL&username=${encodeURIComponent(username)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data?.geonames) ? data.geonames : [];
}

function getName(r: SourceResult) {
  return String(r.name || "").trim();
}

function getAdmin1(r: SourceResult) {
  return String(r.admin1 || r.adminName1 || "").trim() || null;
}

function getCountryName(r: SourceResult) {
  return String(r.country || r.countryName || "").trim() || null;
}

function getCountryCode(r: SourceResult) {
  return String(r.country_code || r.countryCode || "").trim() || null;
}

function getLatitude(r: SourceResult) {
  const n = Number(r.latitude ?? r.lat);
  return Number.isFinite(n) ? n : null;
}

function getLongitude(r: SourceResult) {
  const n = Number(r.longitude ?? r.lng);
  return Number.isFinite(n) ? n : null;
}

function getTimezone(r: SourceResult) {
  if (typeof r.timezone === "string") return r.timezone;
  if (r.timezone && typeof r.timezone === "object") return r.timezone.timeZoneId || null;
  return null;
}

function getPopulation(r: SourceResult) {
  const n = Number(r.population);
  return Number.isFinite(n) ? n : 0;
}

function buildHref(r: SourceResult) {
  const name = getName(r);
  const latitude = getLatitude(r);
  const longitude = getLongitude(r);
  const admin1 = getAdmin1(r);
  const country = getCountryName(r);
  const countryCode = getCountryCode(r);
  const timezone = getTimezone(r);

  const slug = slugify(name);
  const params = new URLSearchParams();

  if (latitude !== null) params.set("lat", String(latitude));
  if (longitude !== null) params.set("lon", String(longitude));
  if (name) params.set("name", name);
  if (admin1) params.set("admin1", admin1);
  if (country) params.set("country", country);
  if (countryCode) params.set("country_code", countryCode);
  if (timezone) params.set("timezone", timezone);

  return `/time/${encodeURIComponent(slug)}?${params.toString()}`;
}

function toSearchResult(r: SourceResult, source: "openmeteo" | "geonames"): SearchResult | null {
  const name = getName(r);
  const latitude = getLatitude(r);
  const longitude = getLongitude(r);

  if (!name || latitude === null || longitude === null) return null;

  return {
    slug: slugify(name),
    href: buildHref(r),
    name,
    admin1: getAdmin1(r),
    country_name: getCountryName(r),
    country_code: getCountryCode(r),
    population: getPopulation(r) || null,
    latitude,
    longitude,
    timezone: getTimezone(r),
    source,
  };
}

function dedupeResults(items: SearchResult[]) {
  const seen = new Set<string>();
  const out: SearchResult[] = [];

  for (const item of items) {
    const key = [
      normalizeText(item.name),
      normalizeText(item.admin1 || ""),
      normalizeText(item.country_name || item.country_code || ""),
      item.latitude,
      item.longitude,
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function scoreResult(raw: string, r: SearchResult) {
  const parsed = parseQuery(raw);

  const cityQuery = normalizeText(parsed.city);
  const fullQuery = parsed.normalized;
  const qualifiers = parsed.qualifiers.map(normalizeText);

  const name = normalizeText(r.name);
  const admin1 = normalizeText(r.admin1 || "");
  const country = normalizeText(r.country_name || r.country_code || "");
  const population = Number(r.population || 0) || 0;

  let score = 0;

  if (name === fullQuery) score += 2200;
  else if (name.startsWith(fullQuery)) score += 1200;
  else if (name.includes(fullQuery)) score += 700;

  if (name === cityQuery) score += 1800;
  else if (name.startsWith(cityQuery)) score += 900;
  else if (name.includes(cityQuery)) score += 450;

  for (const qualifier of qualifiers) {
    if (!qualifier) continue;

    if (admin1 === qualifier) score += 1400;
    else if (admin1.startsWith(qualifier)) score += 900;
    else if (admin1.includes(qualifier)) score += 650;

    if (country === qualifier) score += 1400;
    else if (country.startsWith(qualifier)) score += 900;
    else if (country.includes(qualifier)) score += 650;
  }

  if (qualifiers.length > 0 && name === cityQuery) {
    const qualifierMatched = qualifiers.some(
      (q) => admin1.includes(q) || country.includes(q)
    );
    if (qualifierMatched) score += 1200;
  }

  score += Math.min(Math.floor(Math.log10(Math.max(population, 1))) * 12, 96);

  if (r.source === "openmeteo") score += 10;

  return score;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = normalizeSpaces(searchParams.get("q") || "");

    if (!raw) {
      return NextResponse.json({ ok: true, cities: [] });
    }

    const fallbackQueries = buildFallbackQueries(raw);
    const queries = [raw, ...fallbackQueries];

    const openMeteoLists = await Promise.all(queries.map((q) => fetchOpenMeteo(q)));
    const geoNamesLists = await Promise.all(queries.map((q) => fetchGeoNames(q)));

    const openMeteoResults = openMeteoLists
      .flat()
      .map((r) => toSearchResult(r, "openmeteo"))
      .filter((r): r is SearchResult => Boolean(r));

    const geoNamesResults = geoNamesLists
      .flat()
      .map((r) => toSearchResult(r, "geonames"))
      .filter((r): r is SearchResult => Boolean(r));

    const cities = dedupeResults([...openMeteoResults, ...geoNamesResults])
      .map((r) => ({ r, score: scoreResult(raw, r) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)
      .map(({ r }) => r);

    return NextResponse.json({ ok: true, cities });
  } catch (error) {
    console.error("Search API failed:", error);

    return NextResponse.json(
      { ok: false, error: "Search API failed" },
      { status: 500 }
    );
  }
}