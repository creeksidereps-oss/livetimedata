import CityDashboardClient from "../../city-dashboard/ui";
import CityJsonLd from "@/components/CityJsonLd";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { resolveCityFromSlug, isValidRegionName, ResolvedCity } from "@/lib/cityResolver";
import { sql } from "@vercel/postgres";

async function resolveCityWithDb(
  slug?: string,
  searchParams?: { [key: string]: string | string[] | undefined }
): Promise<ResolvedCity | null> {
  if (!slug && !searchParams?.name && !searchParams?.lat) return null;

  // 1. In-memory fast cache lookup
  if (slug) {
    const memoryResolved = resolveCityFromSlug(slug, false);
    if (memoryResolved) return memoryResolved;
  }

  const slugClean = slug ? decodeURIComponent(slug).toLowerCase().trim() : "";
  const candidateName = slugClean.replace(/-[a-z]{2}$/, "").replace(/-/g, " ");

  // 2. Database `cities` table lookup
  if (slugClean) {
    try {
      const { rows } = await sql`
        SELECT name, admin1, country_name, country_code, latitude, longitude, timezone, slug
        FROM cities
        WHERE LOWER(slug) = ${slugClean} 
           OR LOWER(name) = ${slugClean}
           OR LOWER(slug) = ${candidateName.replace(/\s+/g, '-')}
           OR LOWER(name) = ${candidateName}
        LIMIT 1
      `;
      if (rows.length > 0) {
        const c = rows[0];
        return {
          name: c.name,
          admin1: c.admin1 || "",
          country: c.country_name || (c.country_code === "US" ? "United States" : ""),
          country_code: c.country_code || "",
          lat: Number(c.latitude) || 0,
          lon: Number(c.longitude) || 0,
          timezone: c.timezone || undefined,
          slug: c.slug || slugClean,
        };
      }
    } catch (err) {
      console.warn("DB city lookup error:", err);
    }
  }

  // 3. URL Search Parameters (e.g. from SearchBox autocomplete: ?lat=36.23708&lon=-79.97948&name=Stokesdale...)
  if (searchParams && searchParams.lat && searchParams.lon) {
    const lat = parseFloat(searchParams.lat as string);
    const lon = parseFloat(searchParams.lon as string);
    if (!isNaN(lat) && !isNaN(lon)) {
      const rawName = (searchParams.name as string) || candidateName || slugClean;
      const name = decodeURIComponent(rawName).replace(/\+/g, " ").trim();
      const rawAdmin = (searchParams.admin1 as string) || "";
      const admin1 = isValidRegionName(rawAdmin) ? decodeURIComponent(rawAdmin).replace(/\+/g, " ").trim() : "";
      const country = (searchParams.country as string) 
        ? decodeURIComponent(searchParams.country as string).replace(/\+/g, " ").trim() 
        : ((searchParams.country_code as string) === "US" ? "United States" : "");
      const country_code = (searchParams.country_code as string) || (country === "United States" ? "US" : "");
      const timezone = (searchParams.timezone as string) || undefined;
      const finalSlug = slugClean || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      // Auto-save to `cities` database so future direct visits resolve instantly
      try {
        await sql`
          INSERT INTO cities (slug, name, admin1, country_name, country_code, latitude, longitude, timezone)
          VALUES (${finalSlug}, ${name}, ${admin1}, ${country}, ${country_code}, ${lat}, ${lon}, ${timezone})
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            admin1 = COALESCE(NULLIF(EXCLUDED.admin1, ''), cities.admin1),
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

  // 4. Dynamic Open-Meteo Geocoding Lookup (Free, Zero Cost Fallback for unindexed slugs)
  if (slugClean) {
    try {
      const searchTerms = [
        candidateName,
        slugClean.replace(/-/g, " "),
      ];
      for (const term of searchTerms) {
        if (!term || term.length < 2) continue;
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=1&language=en&format=json`,
          { next: { revalidate: 86400 } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (Array.isArray(geoData?.results) && geoData.results.length > 0) {
            const first = geoData.results[0];
            const name = first.name;
            const admin1 = first.admin1 || "";
            const country = first.country || (first.country_code === "US" ? "United States" : "");
            const country_code = first.country_code || "";
            const lat = Number(first.latitude);
            const lon = Number(first.longitude);
            const timezone = first.timezone || undefined;
            const finalSlug = slugClean;

            // Auto-persist dynamically discovered city into database
            try {
              await sql`
                INSERT INTO cities (slug, name, admin1, country_name, country_code, latitude, longitude, timezone)
                VALUES (${finalSlug}, ${name}, ${admin1}, ${country}, ${country_code}, ${lat}, ${lon}, ${timezone})
                ON CONFLICT (slug) DO UPDATE SET
                  name = EXCLUDED.name,
                  admin1 = COALESCE(NULLIF(EXCLUDED.admin1, ''), cities.admin1),
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
  const validAdmin = isValidRegionName(rawAdmin) ? rawAdmin : undefined;

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

async function fetchInitialReport(cityName: string, stateName?: string) {
  try {
    const cName = String(cityName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const sName = String(stateName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const { rows } = await sql`
      SELECT content FROM city_reports 
      WHERE city_name = ${cName} 
        AND state_name = ${sName} 
        AND report_type = 'about'
      LIMIT 1
    `;
    if (rows.length > 0 && rows[0].content) {
      return rows[0].content as string;
    }
    if (sName) {
      const fallbackRows = await sql`
        SELECT content FROM city_reports 
        WHERE city_name = ${cName} 
          AND report_type = 'about'
        ORDER BY id DESC
        LIMIT 1
      `;
      if (fallbackRows.rows.length > 0 && fallbackRows.rows[0].content) {
        return fallbackRows.rows[0].content as string;
      }
    }
  } catch (err) {
    console.warn("SSR initial report fetch warning:", err);
  }
  return null;
}

async function fetchInitialFact(cityName: string, stateName?: string) {
  try {
    const cName = String(cityName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const sName = String(stateName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const normCity = cName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let { rows } = await sql`
      SELECT id, title, description, category, scope, source_attribution, contributed_by
      FROM city_fun_facts
      WHERE (
        LOWER(city_name) = LOWER(${cName})
        OR LOWER(REGEXP_REPLACE(city_name, '[^a-zA-Z0-9]', '', 'g')) = ${normCity}
      )
        AND is_approved = TRUE
      ORDER BY id ASC
      LIMIT 10
    `;
    if (rows.length === 0 && sName) {
      const stateResult = await sql`
        SELECT id, title, description, category, scope, source_attribution, contributed_by
        FROM city_fun_facts
        WHERE city_name = 'STATE_FACTS'
          AND LOWER(state_name) = LOWER(${sName})
          AND is_approved = TRUE
        ORDER BY id ASC
        LIMIT 10
      `;
      if (stateResult.rows.length > 0) {
        rows = stateResult.rows;
      }
    }
    if (rows.length > 0) {
      const allFacts = rows.map((r, idx) => ({
        ...r,
        factNumber: idx + 1,
        totalFacts: rows.length,
      }));
      return { featured: allFacts[0], allFacts };
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
    fetchInitialReport(cityName, stateName),
    fetchInitialFact(cityName, stateName),
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
      />
    </div>
  );
}
