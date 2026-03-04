// src/app/page.tsx
import CityDashboardClient from "./city-dashboard/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  return <CityDashboardClient initialQuery={searchParams?.q ?? ""} />;
}