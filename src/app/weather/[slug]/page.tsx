// src/app/weather/[slug]/page.tsx
import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export default function WeatherSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const q = slugToQuery(params.slug);
  return <CityDashboardClient initialQuery={q} mode="weather" />;
}