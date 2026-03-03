import CityDashboardClient from "../../city-dashboard/ui";

function slugToQuery(slug: string) {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TimeSlugPage({ params }: { params: { slug: string } }) {
  const q = slugToQuery(params.slug);
  return <CityDashboardClient initialQuery={q} autoPickFirst={true} mode="time" />;
}