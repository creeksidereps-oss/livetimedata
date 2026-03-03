// src/app/time/[slug]/page.tsx
import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TimeSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  // For now we don’t pass props (keeps build green).
  // The client page can still search and select a city.
  // (We’ll restore auto-load-by-slug after deploy is stable.)
  void slugToQuery(params.slug);
  return <CityDashboardClient />;
}