// src/lib/events/location/geoReference.ts
//
// Reference data used ONLY to DISAMBIGUATE geocoder candidates.
// Nothing in this file may ever be used to ASSIGN a city, region or country to an event.
// If the source does not say where an event is, the event has no location (see resolveLocation.ts).

const norm = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export { norm as normalizeGeoText };

/**
 * Region abbreviations -> every admin1 name they can mean, across countries.
 * Ambiguous codes intentionally map to multiple places (e.g. WA = Washington OR Western Australia).
 */
const REGION_ABBREVIATIONS: Record<string, { cc: string; admin1: string }[]> = {};
function addRegions(cc: string, map: Record<string, string>) {
  for (const [abbr, name] of Object.entries(map)) {
    (REGION_ABBREVIATIONS[abbr.toUpperCase()] ||= []).push({ cc, admin1: name });
  }
}
addRegions("US", {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico",
});
addRegions("CA", {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island",
  QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
});
addRegions("AU", {
  NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia",
  TAS: "Tasmania", NT: "Northern Territory", ACT: "Australian Capital Territory",
});
addRegions("DE", {
  BW: "Baden-Wurttemberg", BY: "Bavaria", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg", HE: "Hesse",
  MV: "Mecklenburg-Vorpommern", NI: "Lower Saxony", NRW: "North Rhine-Westphalia", NW: "North Rhine-Westphalia",
  RP: "Rheinland-Pfalz", SL: "Saarland", SN: "Saxony", ST: "Saxony-Anhalt", SH: "Schleswig-Holstein", TH: "Thuringia",
});

/** Possible {country, admin1} meanings of a region string (abbreviation or full name). */
export function regionMeanings(region?: string | null): { cc: string | null; admin1Norm: string }[] {
  if (!region) return [];
  const raw = region.trim();
  if (!raw || /^\d+$/.test(raw)) return []; // numeric FIPS / admin codes are not usable
  const abbr = REGION_ABBREVIATIONS[raw.toUpperCase().replace(/\./g, "")];
  const out: { cc: string | null; admin1Norm: string }[] = abbr ? abbr.map((r) => ({ cc: r.cc, admin1Norm: norm(r.admin1) })) : [];
  out.push({ cc: null, admin1Norm: norm(raw) });
  return out;
}

/** Is this string a known full region name (e.g. "North Carolina", "Ontario", "Western Australia")? */
const KNOWN_REGION_NAMES = new Set<string>(
  Object.values(REGION_ABBREVIATIONS).flat().map((r) => norm(r.admin1))
);
export function isKnownRegionName(token: string): boolean {
  return KNOWN_REGION_NAMES.has(norm(token));
}

/** Does a candidate's admin1 match a region string? Compares full names, accent/case-insensitive. */
export function admin1Matches(candidateAdmin1: string | null | undefined, candidateCc: string, region: string): boolean {
  // US territories etc. are their own ISO countries: "Rincón, PR" means country PR (Puerto Rico).
  if (/^[A-Za-z]{2}$/.test(region.trim()) && region.trim().toUpperCase() === candidateCc) return true;
  const cand = norm(candidateAdmin1 || "");
  if (!cand) return false;
  return regionMeanings(region).some((m) => {
    if ((m.cc && m.cc !== candidateCc) || !m.admin1Norm) return false;
    if (cand === m.admin1Norm) return true;
    // Prefix matching only for real names (>= 4 chars), never for short codes ("pr" must not match "Provincia ...").
    const shorter = cand.length < m.admin1Norm.length ? cand : m.admin1Norm;
    return shorter.length >= 4 && (cand.startsWith(m.admin1Norm) || m.admin1Norm.startsWith(cand));
  });
}

/** ISO country names (+ common aliases / native names) -> ISO alpha-2. */
const COUNTRY_NAME_TO_CODE = new Map<string, string>();
const ISO_CODES = new Set<string>();
(() => {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of A) for (const b of A) {
      const code = a + b;
      const name = dn.of(code);
      if (name && name !== code) { COUNTRY_NAME_TO_CODE.set(norm(name), code); ISO_CODES.add(code); }
    }
  } catch { /* Intl unavailable: aliases below still work */ }
  const aliases: Record<string, string> = {
    "usa": "US", "u s a": "US", "united states of america": "US", "us": "US", "america": "US",
    "uk": "GB", "u k": "GB", "great britain": "GB", "britain": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB",
    "deutschland": "DE", "espana": "ES", "sverige": "SE", "norge": "NO", "danmark": "DK", "suomi": "FI", "nederland": "NL",
    "the netherlands": "NL", "holland": "NL", "belgie": "BE", "belgique": "BE", "osterreich": "AT", "schweiz": "CH", "suisse": "CH",
    "italia": "IT", "polska": "PL", "cesko": "CZ", "czech republic": "CZ", "magyarorszag": "HU", "eesti": "EE", "latvija": "LV",
    "lietuva": "LT", "hrvatska": "HR", "slovenija": "SI", "srbija": "RS", "bulgaria": "BG", "romania": "RO", "ellada": "GR",
    "turkiye": "TR", "turkey": "TR", "brasil": "BR", "mexico": "MX", "republic of ireland": "IE", "eire": "IE",
    "south korea": "KR", "korea": "KR", "russia": "RU", "uae": "AE",
  };
  for (const [k, v] of Object.entries(aliases)) COUNTRY_NAME_TO_CODE.set(norm(k), v);
})();

/** Resolve an explicit country string (name or ISO-2 code) to ISO-2. Returns null if unknown. */
export function countryToCode(country?: string | null): string | null {
  if (!country) return null;
  const raw = country.trim();
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const up = raw.toUpperCase();
    return up === "UK" ? "GB" : up;
  }
  return COUNTRY_NAME_TO_CODE.get(norm(raw)) || null;
}

export function isCountryName(token: string): boolean {
  return COUNTRY_NAME_TO_CODE.has(norm(token));
}

/** A real ISO 3166 alpha-2 code (e.g. "MP", "GU", "SE"). */
export function isIsoCountryCode(token: string): boolean {
  return /^[A-Za-z]{2}$/.test(token) && ISO_CODES.has(token.toUpperCase());
}

/**
 * Country-code TLD of a URL (e.g. https://borsen.se -> SE).
 * Vanity / generic-use ccTLDs are ignored. Used ONLY as a tie-breaker between candidates.
 */
const VANITY_CCTLDS = new Set(["co", "io", "tv", "me", "fm", "ai", "ly", "cc", "ws", "to", "gg", "am", "la", "nu", "tk", "ml", "ga", "cf", "gq", "app", "dev", "eu", "su"]);
export function ccTldCountry(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const tld = host.split(".").pop() || "";
    if (tld.length !== 2 || VANITY_CCTLDS.has(tld)) return null;
    return tld === "uk" ? "GB" : tld.toUpperCase();
  } catch {
    return null;
  }
}

/** Haversine distance in km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** A real coordinate pair (0 is valid; NaN / out-of-range / exactly 0,0 "null island" is not). */
export function isRealCoordinate(lat: unknown, lon: unknown): boolean {
  const a = Number(lat), b = Number(lon);
  if (lat === null || lat === undefined || lon === null || lon === undefined || lat === "" || lon === "") return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return !(a === 0 && b === 0);
}
