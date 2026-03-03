// src/app/weather/[slug]/page.tsx
import type { Metadata } from "next";
import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const q = slugToQuery(slug);
  return {
    title: `Weather in ${q} | LiveTimeData`,
    description: `Current weather and 7-day forecast for ${q}.`,
    alternates: { canonical: `/weather/${slug}` },
  };
}

export default async function WeatherSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const q = slugToQuery(slug);

  return <CityDashboardClient initialQuery={q} mode="weather" />;
}