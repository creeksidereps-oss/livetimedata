import type { Metadata } from "next";
import CityDashboardClient from "../../city-dashboard/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const q = slugToQuery(params.slug);
  return {
    title: `Time in ${q} | LiveTimeData`,
    description: `Current local time in ${q}.`,
  };
}

export default function TimeSlugPage({ params }: { params: { slug: string } }) {
  const q = slugToQuery(params.slug);
  return <CityDashboardClient initialQuery={q} mode="time" />;
}