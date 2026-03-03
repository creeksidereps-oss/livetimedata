// src/app/time/[slug]/page.tsx
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
    title: `Current Time in ${q} | LiveTimeData`,
    description: `See the current local time in ${q} right now.`,
    alternates: { canonical: `/time/${slug}` },
  };
}

export default async function TimeSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const q = slugToQuery(slug);

  return <CityDashboardClient initialQuery={q} mode="time" />;
}