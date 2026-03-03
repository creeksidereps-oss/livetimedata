// src/app/weather/[slug]/page.tsx
import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WeatherSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  void slugToQuery(params.slug);
  return <CityDashboardClient />;
}