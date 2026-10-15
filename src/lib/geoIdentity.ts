// src/lib/geoIdentity.ts

export const US_STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia"
};

export const REVERSE_US_STATE_MAP: Record<string, string> = Object.entries(US_STATE_MAP).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>
);

export const CA_PROV_MAP: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", ON: "Ontario",
  PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan",
  NT: "Northwest Territories", NU: "Nunavut", YT: "Yukon"
};

export const REVERSE_CA_PROV_MAP: Record<string, string> = Object.entries(CA_PROV_MAP).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>
);

export function cleanGeoString(val?: any): string {
  return String(val || "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standardizes administrative region into full name and abbreviation (if available)
 */
export function normalizeAdminRegion(admin?: string, country?: string, countryCode?: string): {
  fullName: string;
  code: string;
} {
  const cleaned = cleanGeoString(admin);
  const cCode = (countryCode || "").toUpperCase();
  const cName = (country || "").toLowerCase();

  const isUS = cCode === "US" || cName === "united states" || cName === "usa";
  const isCA = cCode === "CA" || cName === "canada";

  if (isUS) {
    const upper = cleaned.toUpperCase();
    if (US_STATE_MAP[upper]) {
      return { fullName: US_STATE_MAP[upper], code: upper };
    }
    const lower = cleaned.toLowerCase();
    if (REVERSE_US_STATE_MAP[lower]) {
      return { fullName: cleaned, code: REVERSE_US_STATE_MAP[lower] };
    }
  }

  if (isCA) {
    const upper = cleaned.toUpperCase();
    if (CA_PROV_MAP[upper]) {
      return { fullName: CA_PROV_MAP[upper], code: upper };
    }
    const lower = cleaned.toLowerCase();
    if (REVERSE_CA_PROV_MAP[lower]) {
      return { fullName: cleaned, code: REVERSE_CA_PROV_MAP[lower] };
    }
  }

  return { fullName: cleaned, code: "" };
}

/**
 * Calculates Haversine distance in kilometers between two geographic coordinates
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;
  if (lat1 === 0 && lon1 === 0 && lat2 === 0 && lon2 === 0) return 0;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks whether a candidate record is geographically consistent with the requested city
 */
export function isGeographicMatch(
  requestedCity: string,
  requestedAdmin: string,
  requestedCountry: string,
  requestedLat: number | undefined,
  requestedLng: number | undefined,
  candidateCity: string,
  candidateAdmin: string,
  candidateCountry?: string,
  candidateLat?: number,
  candidateLng?: number
): boolean {
  // 1. City Name check (case-insensitive & whitespace-normalized)
  const reqNorm = cleanGeoString(requestedCity).toLowerCase().replace(/[^a-z0-9]/g, "");
  const candNorm = cleanGeoString(candidateCity).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!reqNorm || !candNorm || reqNorm !== candNorm) {
    return false;
  }

  // 2. Coordinate check (if both records have valid non-zero coordinates)
  if (
    typeof requestedLat === "number" &&
    typeof requestedLng === "number" &&
    typeof candidateLat === "number" &&
    typeof candidateLng === "number" &&
    (requestedLat !== 0 || requestedLng !== 0) &&
    (candidateLat !== 0 || candidateLng !== 0)
  ) {
    const dist = calculateDistanceKm(requestedLat, requestedLng, candidateLat, candidateLng);
    // If distance is greater than 160 km (100 miles), they are definitely different cities!
    if (dist > 160) {
      return false;
    }
  }

  // 3. State / Province / Region check
  const reqAdminNorm = cleanGeoString(requestedAdmin).toLowerCase();
  const candAdminNorm = cleanGeoString(candidateAdmin).toLowerCase();

  const reqNormObj = normalizeAdminRegion(requestedAdmin, requestedCountry);
  const candNormObj = normalizeAdminRegion(candidateAdmin, candidateCountry);

  // If the requested city has an administrative region (e.g. US state, Canadian province, regional department):
  if (reqNormObj.fullName || reqAdminNorm) {
    // If candidate has NO admin region, it cannot be considered a match for a region-specified city
    if (!candNormObj.fullName && !candAdminNorm) {
      return false;
    }

    if (reqNormObj.fullName && candNormObj.fullName) {
      const reqFull = reqNormObj.fullName.toLowerCase();
      const candFull = candNormObj.fullName.toLowerCase();
      const reqCode = reqNormObj.code.toLowerCase();
      const candCode = candNormObj.code.toLowerCase();

      const matchesState =
        reqFull === candFull ||
        (reqCode && reqCode === candCode) ||
        (reqCode && reqCode === candFull) ||
        (candCode && candCode === reqFull);

      if (!matchesState) {
        return false;
      }
    } else if (reqAdminNorm && candAdminNorm) {
      if (reqAdminNorm !== candAdminNorm && !reqAdminNorm.includes(candAdminNorm) && !candAdminNorm.includes(reqAdminNorm)) {
        return false;
      }
    }
  } else if (candAdminNorm) {
    // If requested city has NO admin region (e.g. Paris, France), but candidate has one (e.g. Île-de-France):
    // Allow if candidate admin is a known region of the requested country, otherwise require caution
    const reqCountryNorm = cleanGeoString(requestedCountry).toLowerCase();
    if (reqCountryNorm.includes("united states") || reqCountryNorm === "us") {
      // For US cities, state is always required
      return false;
    }
  }

  // 4. Country check (if both specified)
  const reqCountryNorm = cleanGeoString(requestedCountry).toLowerCase();
  const candCountryNorm = cleanGeoString(candidateCountry).toLowerCase();
  if (reqCountryNorm && candCountryNorm) {
    // Check if candidate admin clearly belongs to requested country (e.g. Île-de-France in France)
    const isSpecialAdminMatch =
      (candAdminNorm.includes("île-de-france") || candAdminNorm.includes("ile-de-france")) &&
      (reqCountryNorm.includes("france") || reqCountryNorm === "fr");

    if (
      !isSpecialAdminMatch &&
      reqCountryNorm !== candCountryNorm &&
      !(reqCountryNorm.includes("united states") && candCountryNorm.includes("united states")) &&
      !(reqCountryNorm === "us" && candCountryNorm.includes("united states"))
    ) {
      return false;
    }
  }

  return true;
}
