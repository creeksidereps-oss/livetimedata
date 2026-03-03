import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  timezone?: string;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?\\|[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common region aliases → canonical match targets
const REGION_ALIASES: Record<string, { country?: string; admin1?: string }> = {
  // Countries
  usa: { country: "United States" },
  us: { country: "United States" },
  "u s": { country: "United States" },
  "u.s": { country: "United States" },
  "u.s.": { country: "United States" },
  "united states": { country: "United States" },
  uk: { country: "United Kingdom" },
  "u k": { country: "United Kingdom" },
  "united kingdom": { country: "United Kingdom" },
  uae: { country: "United Arab Emirates" },
  "united arab emirates": { country: "United Arab Emirates" },

  // A few common country shorthands
  germany: { country: "Germany" },
  france: { country: "France" },
  italy: { country: "Italy" },
  spain: { country: "Spain" },
  canada: { country: "Canada" },
  mexico: { country: "Mexico" },
  japan: { country: "Japan" },
  china: { country: "China" },
  india: { country: "India" },
  australia: { country: "Australia" },
};

// US state abbreviations → admin1
const US_STATE_ABBR: Record<string, string> = {
  al: "Alabama",
  ak: "Alaska",
  az: "Arizona",
  ar: "Arkansas",
  ca: "California",
  co: "Colorado",
  ct: "Connecticut",
  de: "Delaware",
  fl: "Florida",
  ga: "Georgia",
  hi: "Hawaii",
  id: "Idaho",
  il: "Illinois",
  in: "Indiana",
  ia: "Iowa",
  ks: "Kansas",
  ky: "Kentucky",
  la: "Louisiana",
  me: "Maine",
  md: "Maryland",
  ma: "Massachusetts",
  mi: "Michigan",
  mn: "Minnesota",
  ms: "Mississippi",
  mo: "Missouri",
  mt: "Montana",
  ne: "Nebraska",
  nv: "Nevada",
  nh: "New Hampshire",
  nj: "New Jersey",
  nm: "New Mexico",
  ny: "New York",
  nc: "North Carolina",
  nd: "North Dakota",
  oh: "Ohio",
  ok: "Oklahoma",
  or: "Oregon",
  pa: "Pennsylvania",
  ri: "Rhode Island",
  sc: "South Carolina",
  sd: "South Dakota",
  tn: "Tennessee",
  tx: "Texas",
  ut: "Utah",
  vt: "Vermont",
  va: "Virginia",
  wa: "Washington",
  wv: "West Virginia",
  wi: "Wisconsin",
  wy: "Wyoming",
  dc: "District of Columbia",
};

function pickRegionHint(tokens: string[]) {
  // Try longest tail match: 3 words, then 2, then 1
  // Example: ["new","york","united","states"] should match "united states"
  for (const n of [3, 2, 1]) {
    if (tokens.length >= n) {
      const tail = tokens.slice(tokens.length - n).join(" ");
      if (REGION_ALIASES[tail]) {
        return { hint: REGION_ALIASES[tail], tailWords: n };
      }
      if (n === 1) {
        const one = tail;
        const ab = US_STATE_ABBR[one];
        if (ab) return { hint: { country: "United States", admin1: ab }, tailWords: 1 };
      }
    }
  }
  return { hint: null as null | { country?: string; admin1?: string }, tailWords: 0 };
}

function scoreRegionMatch(r: GeoResult, hint: { country?: string; admin1?: string } | null) {
  if (!hint) return 0;

  let score = 0;
  const country = (r.country || "").toLowerCase();
  const admin1 = (r.admin1 || "").toLowerCase();

  if (hint.country && country.includes(hint.country.toLowerCase())) score += 10;
  if (hint.admin1 && admin1.includes(hint.admin1.toLowerCase())) score += 10;

  // Extra boost if hint country is US and result country_code is US
  if (hint.country?.toLowerCase() === "united states" && r.country_code?.toLowerCase() === "us") {
    score += 3;
  }
  return score;
}

async function fetchGeocode(name: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return { ok: false, results: [] as GeoResult[] };

  const data = await res.json();
  const results: GeoResult[] = data?.results ?? [];
  return { ok: true, results };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") || "").trim();
  const q = norm(raw);

  if (!q) return NextResponse.json({ results: [] });

  const tokens = q.split(" ").filter(Boolean);
  const { hint, tailWords } = pickRegionHint(tokens);

  // City part = everything except the region tail words (only if we actually detected a hint)
  const cityPart =
    hint && tailWords > 0 ? tokens.slice(0, Math.max(1, tokens.length - tailWords)).join(" ") : q;

  // 1) Try full query first
  const full = await fetchGeocode(q);
  let results = full.results;

  // 2) If no results, fall back to city-only
  if (!results.length && cityPart && cityPart !== q) {
    const fallback = await fetchGeocode(cityPart);
    results = fallback.results;
  }

  // 3) If still no results, try first token as last ditch (rare)
  if (!results.length && tokens.length > 1) {
    const last = await fetchGeocode(tokens[0]);
    results = last.results;
  }

  // 4) Sort results by region match score (region priority)
  if (results.length && hint) {
    results = [...results].sort((a, b) => scoreRegionMatch(b, hint) - scoreRegionMatch(a, hint));
  }

  return NextResponse.json({ results });
}