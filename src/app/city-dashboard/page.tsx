import CityDashboardClient from "./ui";
import CityJsonLd from "@/components/CityJsonLd";
import { resolveCityFromSlug } from "@/lib/cityResolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CityDashboardPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await props.params;
  const sp = await props.searchParams;
  const resolved = resolveCityFromSlug(p?.slug || (sp?.slug as string) || (sp?.name as string));

  const cityName = (sp?.name as string) || resolved.name;
  const stateName = sp?.admin1 !== undefined ? (sp.admin1 as string) : resolved.admin1;
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
      <CityJsonLd 
        cityName={cityName} 
        stateName={stateName} 
        countryName={country} 
        lat={lat} 
        lon={lon} 
        pageType="dashboard" 
      />
    </div>
  );
}