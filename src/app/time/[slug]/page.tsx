// src/app/time/[slug]/page.tsx
import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export default function TimeSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const q = slugToQuery(params.slug);
  return <CityDashboardClient initialQuery={q} mode="time" />;
}