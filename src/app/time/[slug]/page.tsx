import CityDashboardClient from "../../city-dashboard/ui";
import type { Metadata, ResolvingMetadata } from "next";
import { resolveCityFromSlug } from "@/lib/cityResolver";

export async function generateMetadata(
  { params, searchParams }: { 
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const p = await params;
  const sp = await searchParams;
  const resolved = resolveCityFromSlug(p?.slug);

  const cityName = (sp?.name as string) || resolved.name;
  const stateName = sp?.admin1 ? `, ${sp.admin1}` : (resolved.admin1 ? `, ${resolved.admin1}` : "");
  const countryName = sp?.country ? `, ${sp.country}` : (resolved.country ? `, ${resolved.country}` : "");

  const title = `Local Time, Weather & Live Webcams in ${cityName}${stateName}${countryName} | LiveTimeData`;
  const description = `Current local time, 14-day weather forecast, live webcams, and upcoming events for ${cityName}${countryName}. Real-time municipal intelligence and city events.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function TimeSlugPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <CityDashboardClient params={props.params} searchParams={props.searchParams} />;
}
