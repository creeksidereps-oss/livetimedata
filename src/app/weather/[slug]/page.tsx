import CityDashboardClient from "../../city-dashboard/ui";
import CityEditorialGuide from "@/components/CityEditorialGuide";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { resolveCityFromSlug, isValidRegionName } from "@/lib/cityResolver";

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

export default async function WeatherSlugPage(props: {
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
  const timezone = (sp?.timezone as string) || resolved.timezone || "auto";

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
      />
      <CityEditorialGuide 
        cityName={cityName} 
        stateName={stateName} 
        countryName={country} 
        lat={lat} 
        lon={lon} 
        timezone={timezone} 
        pageType="weather" 
      />
    </div>
  );
}
