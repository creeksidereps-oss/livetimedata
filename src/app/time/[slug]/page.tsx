import CityDashboardClient from "../../city-dashboard/ui";
import CityJsonLd from "@/components/CityJsonLd";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { resolveCityFromSlug, isValidRegionName } from "@/lib/cityResolver";
import { sql } from "@vercel/postgres";

export async function generateMetadata(
  { params, searchParams }: { 
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const p = await params;
  const sp = await searchParams;
  const resolved = resolveCityFromSlug(p?.slug, false);
  if (!resolved) {
    return {};
  }

  const rawAdmin = (sp?.admin1 as string) ?? resolved.admin1;
  const validAdmin = isValidRegionName(rawAdmin) ? rawAdmin : undefined;

  const cityName = (sp?.name as string) || resolved.name;
  const stateName = validAdmin ? `, ${validAdmin}` : "";
  const countryName = sp?.country ? `, ${sp.country}` : (resolved.country ? `, ${resolved.country}` : "");

  const title = `Local Time, Weather & Live Webcams in ${cityName}${stateName}${countryName}`;
  const description = `Current local time, 14-day weather forecast, live webcams, and upcoming events for ${cityName}${countryName}. Real-time municipal intelligence and city events.`;
  const canonicalUrl = `https://www.livetimedata.com/time/${resolved.slug}`;

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

async function fetchInitialFact(cityName: string) {
  try {
    const cName = String(cityName || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const normCity = cName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const { rows } = await sql`
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

export default async function TimeSlugPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await props.params;
  const sp = await props.searchParams;
  const resolved = resolveCityFromSlug(p?.slug, false);
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
    fetchInitialFact(cityName),
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
        defaultForecastOpen={false}
      />
      <CityJsonLd 
        cityName={cityName} 
        stateName={stateName} 
        countryName={country} 
        lat={lat} 
        lon={lon} 
        pageType="time" 
      />
    </div>
  );
}
