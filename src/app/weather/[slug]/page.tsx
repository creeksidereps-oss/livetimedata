import CityDashboardClient from "../../city-dashboard/ui";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const sp = await searchParams;
  const cityName = (sp.name as string) || "Unknown City";
  const stateName = sp.admin1 ? `, ${sp.admin1}` : "";
  const countryName = sp.country ? `, ${sp.country}` : "";

  const title = `Local Time, Weather & Live Webcams in ${cityName}${stateName}${countryName} | LiveTimeData`;
  const description = `Current local time, 14-day weather forecast, live webcams, and upcoming events for ${cityName}.`;

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
