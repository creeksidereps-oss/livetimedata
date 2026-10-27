import CityDashboardClient from "../../city-dashboard/ui";
import CityJsonLd from "@/components/CityJsonLd";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { 
  resolveCityFromSlug, 
  isValidRegionName, 
  findSitemapMatch, 
  parseSlugGeographicContext,
  KNOWN_ENTRIES, 
  US_STATE_TO_CODE, 
  CA_PROV_TO_CODE,
  ResolvedCity 
} from "@/lib/cityResolver";
import { isGeographicMatch, normalizeAdminRegion } from "@/lib/geoIdentity";
import { sql } from "@vercel/postgres";
import { isIndexableCitySlug } from "@/lib/indexableCities";

function slugify(text: string): string {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveCityWithDb(
  slug?: string,
  searchParams?: { [key: string]: string | string[] | undefined }
): Promise<ResolvedCity | null> {
  if (!slug && !searchParams?.name && !searchParams?.lat) return null;

  const slugClean = slug ? decodeURIComponent(slug).toLowerCase().trim() : "";

  // 1. URL Search Parameters with valid coordinates supplied by search (ground truth)
  if (searchParams && searchParams.lat && searchParams.lon) {
    const lat = parseFloat(searchParams.lat as string);
    const lon = parseFloat(searchParams.lon as string);
    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
      const rawName = (searchParams.name as string) || slugClean;
      const name = decodeURIComponent(rawName).replace(/\+/g, " ").trim();
      const rawAdmin = (searchParams.admin1 as string) || "";
      const admin1 = isValidRegionName(rawAdmin) ? decodeURIComponent(rawAdmin).replace(/\+/g, " ").trim() : "";
      const country = (searchParams.country as string) 
        ? decodeURIComponent(searchParams.country as string).replace(/\+/g, " ").trim() 
        : ((searchParams.country_code as string) === "US" ? "United States" : "");
      const country_code = (searchParams.country_code as string) || (country === "United States" ? "US" : "");
      const timezone = (searchParams.timezone as string) || undefined;

      // Check if this matches a sitemap city
      const sitemapMatch = findSitemapMatch(name, admin1, country, country_code);
      let finalSlug = sitemapMatch ? sitemapMatch.slug : "";

      // Check if matches known entries
      if (!finalSlug) {
        const normName = name.toLowerCase();
        const normAdmin = admin1.toLowerCase();
        const stateCode = US_STATE_TO_CODE[normAdmin] || (normAdmin.length === 2 ? normAdmin.toUpperCase() : "");
        for (const entry of KNOWN_ENTRIES) {
          if (entry.name.toLowerCase() === normName) {
            if (stateCode && entry.admin1 && (entry.admin1.toLowerCase() === normAdmin || entry.admin1.toUpperCase() === stateCode)) {
              finalSlug = entry.slug;
              break;
            }
          }
        }
      }

      // If still no canonical slug, construct an unambiguous slug using region if available
      if (!finalSlug) {
        if (admin1 && isValidRegionName(admin1)) {
          finalSlug = `${slugify(name)}-${slugify(admin1)}`;
        } else if (slugClean) {
          finalSlug = slugClean;
        } else {
          finalSlug = slugify(name);
        }
      }

      // Auto-save/update database with valid coordinates
      try {
        await sql`
          INSERT INTO cities (slug, name, admin1, country_name, country_code, latitude, longitude, timezone)
          VALUES (${finalSlug}, ${name}, ${admin1}, ${country}, ${country_code}, ${lat}, ${lon}, ${timezone})
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            admin1 = COALESCE(NULLIF(EXCLUDED.admin1, ''), cities.admin1),
            country_name = COALESCE(NULLIF(EXCLUDED.country_name, ''), cities.country_name),
            country_code = COALESCE(NULLIF(EXCLUDED.country_code, ''), cities.country_code),
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            timezone = COALESCE(EXCLUDED.timezone, cities.timezone)
        `;
      } catch (insertErr) {
        console.warn("Auto-insert city from searchParams warning:", insertErr);
      }

      return {
        name,
        admin1,
        country,
        country_code,
        lat,
        lon,
        timezone,
        slug: finalSlug,
      };
    }
  }

  // 2. In-memory fast cache lookup (for direct visits to clean slugs)
  if (slug) {
    const memoryResolved = resolveCityFromSlug(slug, false);
    if (memoryResolved && (memoryResolved.lat !== 0 || memoryResolved.lon !== 0)) {
      return memoryResolved;
    }
  }

  // 3. Database `cities` table lookup with geographic integrity validation
  const geoContext = parseSlugGeographicContext(slugClean);
  const candidateName = geoContext.cityName || slugClean.replace(/-[a-z]{2}$/, "").replace(/-/g, " ");
  let dbCityName = "";
  let dbAdmin1 = "";

  if (slugClean) {
    try {
      const { rows } = await sql`
        SELECT name, admin1, country_name, country_code, latitude, longitude, timezone, slug
        FROM cities
        WHERE LOWER(slug) = ${slugClean} 
           OR LOWER(name) = ${slugClean}
           OR LOWER(slug) = ${candidateName.replace(/\s+/g, '-')}
           OR LOWER(name) = ${candidateName}
        ORDER BY CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 0 ELSE 1 END
        LIMIT 1
      `;
      if (rows.length > 0) {
        const c = rows[0];
        const lat = Number(c.latitude);
        const lon = Number(c.longitude);
        dbCityName = c.name;
        dbAdmin1 = c.admin1 || "";

        // Integrity verification: reject corrupted rows that conflict with slug's country, state/region, or city name
        const dbCountry = (c.country_name || (c.country_code === "US" ? "united states" : "")).toLowerCase();
        const countryConflict = Boolean(geoContext.country && dbCountry && dbCountry !== geoContext.country);
        const nameConflict = Boolean(geoContext.cityName && !c.name.toLowerCase().includes(geoContext.cityName.split(" ")[0]));

        const qualNorm = geoContext.qualifier.toLowerCase();
        const expectedState = US_STATE_TO_CODE[qualNorm] || (qualNorm.length === 2 ? qualNorm.toUpperCase() : "");
        const expectedCaProv = CA_PROV_TO_CODE[qualNorm];
        const dbAdmin = (c.admin1 || "").toLowerCase();
        const dbAdminUpper = (c.admin1 || "").toUpperCase();

        let adminConflict = false;
        if (qualNorm && c.admin1) {
          if (expectedState) {
            adminConflict = (dbAdmin !== qualNorm && dbAdminUpper !== expectedState);
          } else if (expectedCaProv) {
            adminConflict = (dbAdmin !== qualNorm && dbAdminUpper !== expectedCaProv);
          } else if (!/^\d+$/.test(qualNorm)) {
            adminConflict = (dbAdmin !== qualNorm);
          }
        }

        if (!countryConflict && !nameConflict && !adminConflict && c.latitude !== null && c.longitude !== null && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
          return {
            name: c.name,
            admin1: c.admin1 || "",
            country: c.country_name || (c.country_code === "US" ? "United States" : ""),
            country_code: c.country_code || "",
            lat,
            lon,
            timezone: c.timezone || undefined,
            slug: c.slug || slugClean,
          };
        }
      }
    } catch (err) {
      console.warn("DB city lookup error:", err);
    }
  }

  // 4. Dynamic Open-Meteo Geocoding Lookup (when coordinates are missing or slug unindexed)
  if (slugClean) {
    try {
      let searchCity = geoContext.cityName || candidateName || slugClean;
      let qual = geoContext.qualifier;
      let expectedCountry = geoContext.country;

      if (!qual && dbAdmin1) {
        qual = dbAdmin1;
      }

      const searchTerms = [
        searchCity,
        slugClean.replace(/-/g, " "),
      ];

      for (const term of searchTerms) {
        if (!term || term.length < 2) continue;
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=10&language=en&format=json`,
          { next: { revalidate: 86400 } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (Array.isArray(geoData?.results) && geoData.results.length > 0) {
            let matched = geoData.results[0];

            // If expected country or region qualifier exists, match accurately against Open-Meteo results
            if (expectedCountry || qual) {
              const normQual = qual.toLowerCase();
              const stateCode = US_STATE_TO_CODE[normQual] || (normQual.length === 2 ? normQual.toUpperCase() : "");
              const caCode = CA_PROV_TO_CODE[normQual];

              const found = geoData.results.find((r: any) => {
                const rAdmin = (r.admin1 || "").toLowerCase();
                const rCountry = (r.country || (r.country_code === "US" ? "united states" : "")).toLowerCase();

                if (expectedCountry && rCountry !== expectedCountry) return false;
                if (stateCode && r.country_code === "US" && (rAdmin === normQual || r.admin1 === stateCode)) return true;
                if (caCode && r.country_code === "CA" && (rAdmin === normQual || r.admin1 === caCode)) return true;
                if (normQual && (rAdmin === normQual || rCountry === normQual)) return true;
                return !normQual;
              });
              if (found) matched = found;
            }

            const name = matched.name;
            const admin1 = matched.admin1 || "";
            const country = matched.country || (matched.country_code === "US" ? "United States" : "");
            const country_code = matched.country_code || "";
            const lat = Number(matched.latitude);
            const lon = Number(matched.longitude);
            const timezone = matched.timezone || undefined;

            const sitemapMatch = findSitemapMatch(name, admin1, country, country_code);
            const finalSlug = sitemapMatch ? sitemapMatch.slug : slugClean;

            if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
              continue;
            }

            // Auto-persist dynamically discovered city into database
            try {
              await sql`
                INSERT INTO cities (slug, name, admin1, country_name, country_code, latitude, longitude, timezone)
                VALUES (${finalSlug}, ${name}, ${admin1}, ${country}, ${country_code}, ${lat}, ${lon}, ${timezone})
                ON CONFLICT (slug) DO UPDATE SET
                  name = EXCLUDED.name,
                  admin1 = COALESCE(NULLIF(EXCLUDED.admin1, ''), cities.admin1),
                  country_name = COALESCE(NULLIF(EXCLUDED.country_name, ''), cities.country_name),
                  country_code = COALESCE(NULLIF(EXCLUDED.country_code, ''), cities.country_code),
                  latitude = EXCLUDED.latitude,
                  longitude = EXCLUDED.longitude,
                  timezone = COALESCE(EXCLUDED.timezone, cities.timezone)
              `;
            } catch (insertErr) {
              console.warn("Auto-insert discovered city warning:", insertErr);
            }

            return {
              name,
              admin1,
              country,
              country_code,
              lat,
              lon,
              timezone,
              slug: finalSlug,
            };
          }
        }
      }
    } catch (geoErr) {
      console.warn("Dynamic geocode resolution error:", geoErr);
    }
  }

  // Truly not a real place / city on earth
  return null;
}

export async function generateMetadata(
  { params, searchParams }: { 
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const p = await params;
  const sp = await searchParams;
  const resolved = await resolveCityWithDb(p?.slug, sp);
  if (!resolved) {
    return {};
  }

  const rawAdmin = (sp?.admin1 as string) ?? resolved.admin1;
  const validAdmin = isValidRegionName(rawAdmin) ? rawAdmin : (isValidRegionName(resolved.admin1) ? resolved.admin1 : undefined);

  const cityName = (sp?.name as string) || resolved.name;
  const stateName = validAdmin ? `, ${validAdmin}` : "";
  const countryName = sp?.country ? `, ${sp.country}` : (resolved.country ? `, ${resolved.country}` : "");

  const title = `Local Weather Forecast & Live Conditions in ${cityName}${stateName}${countryName}`;
  const description = `14-day weather forecast, current temperatures, wind, humidity, and atmospheric conditions for ${cityName}${countryName}. Real-time municipal intelligence.`;
  const canonicalUrl = `https://www.livetimedata.com/weather/${resolved.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    // Only the curated city set is submitted for indexing; all other city pages stay live but noindex.
    robots: isIndexableCitySlug(resolved.slug) ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

async function fetchInitialWeather(lat: number, lon: number) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=10`,
      { next: { revalidate: 900 } }
    );
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("SSR initial weather fetch warning:", err);
  }
  return null;
}

async function fetchInitialReport(
  cityName: string,
  stateName?: string,
  countryName?: string,
  lat?: number,
  lon?: number
) {
  try {
    const cName = String(cityName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    if (!cName) return null;

    const { rows } = await sql`
      SELECT content, state_name, lat, lng FROM city_reports 
      WHERE LOWER(city_name) = LOWER(${cName})
        AND report_type = 'about'
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    for (const row of rows) {
      if (!row.content || row.content.length < 50) continue;
      const isMatch = isGeographicMatch(
        cName,
        stateName || "",
        countryName || "",
        lat,
        lon,
        cName,
        row.state_name || "",
        countryName || "",
        Number(row.lat),
        Number(row.lng)
      );
      if (isMatch) {
        return row.content as string;
      }
    }
  } catch (err) {
    console.warn("SSR initial report fetch warning:", err);
  }
  return null;
}

async function fetchInitialFact(
  cityName: string,
  stateName?: string,
  countryName?: string,
  lat?: number,
  lon?: number
) {
  try {
    const cName = String(cityName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    if (!cName) return { featured: null, allFacts: [] };

    const { rows } = await sql`
      SELECT id, city_name, state_name, country_name, title, description, category, scope, source_attribution, contributed_by
      FROM city_fun_facts
      WHERE LOWER(city_name) = LOWER(${cName})
        AND is_approved = TRUE
      ORDER BY id ASC
    `;

    const matchingFacts = rows.filter((r) =>
      isGeographicMatch(
        cName,
        stateName || "",
        countryName || "",
        lat,
        lon,
        r.city_name,
        r.state_name || "",
        r.country_name || ""
      )
    );

    if (matchingFacts.length > 0) {
      const allFacts = matchingFacts.map((r, idx) => ({
        ...r,
        factNumber: idx + 1,
        totalFacts: matchingFacts.length,
      }));
      return { featured: allFacts[0], allFacts };
    }

    if (stateName) {
      const normAdmin = normalizeAdminRegion(stateName, countryName);
      const stateCandidate = normAdmin.fullName || stateName;
      const stateResult = await sql`
        SELECT id, title, description, category, scope, source_attribution, contributed_by
        FROM city_fun_facts
        WHERE city_name = 'STATE_FACTS'
          AND (
            LOWER(state_name) = LOWER(${stateCandidate})
            OR LOWER(state_name) = LOWER(${stateName})
          )
          AND is_approved = TRUE
        ORDER BY id ASC
        LIMIT 10
      `;
      if (stateResult.rows.length > 0) {
        const allFacts = stateResult.rows.map((r, idx) => ({
          ...r,
          scope: "state",
          factNumber: idx + 1,
          totalFacts: stateResult.rows.length,
        }));
        return { featured: allFacts[0], allFacts };
      }
    }
  } catch (err) {
    console.warn("SSR initial fact fetch warning:", err);
  }
  return { featured: null, allFacts: [] };
}

export default async function WeatherSlugPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await props.params;
  const sp = await props.searchParams;
  const resolved = await resolveCityWithDb(p?.slug, sp);
  if (!resolved) {
    notFound();
  }

  const rawAdmin = sp?.admin1 !== undefined ? (sp.admin1 as string) : resolved.admin1;
  const validAdmin = isValidRegionName(rawAdmin) ? rawAdmin : undefined;

  const cityName = (sp?.name as string) || resolved.name;
  const stateName = validAdmin;
  const country = (sp?.country as string) || resolved.country;
  const country_code = (sp?.country_code as string) || resolved.country_code;
  const lat = parseFloat(sp?.lat as string) || resolved.lat;
  const lon = parseFloat(sp?.lon as string) || resolved.lon;
  const initialTimestamp = Date.now();

  const [initialWeather, initialReport, factData] = await Promise.all([
    fetchInitialWeather(lat, lon),
    fetchInitialReport(cityName, stateName, country, lat, lon),
    fetchInitialFact(cityName, stateName, country, lat, lon),
  ]);

  const timezone = (sp?.timezone as string) || (resolved.timezone && resolved.timezone !== "auto" ? resolved.timezone : undefined) || initialWeather?.timezone || "UTC";

  const initialData = {
    ...sp,
    name: cityName,
    admin1: stateName,
    country,
    country_code,
    lat,
    lon,
    timezone,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      <CityDashboardClient 
        params={props.params} 
        searchParams={props.searchParams} 
        initialData={initialData}
        initialWeather={initialWeather}
        initialReport={initialReport}
        initialFact={factData.featured}
        initialAllFacts={factData.allFacts}
        initialTimestamp={initialTimestamp}
        defaultForecastOpen={true}
      />
      <CityJsonLd 
        cityName={cityName} 
        stateName={stateName} 
        countryName={country} 
        lat={lat} 
        lon={lon} 
        pageType="weather" 
        slug={resolved.slug}
      />
    </div>
  );
}
