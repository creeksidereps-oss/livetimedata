// src/app/city-dashboard/page.tsx
import CityDashboardClient from "./ui";

// ✅ Launch fix: prevent build-time prerender for /city-dashboard
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CityDashboardPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const initialQuery = (searchParams?.q ?? "").trim() ? (searchParams?.q as string) : " ";

  return <CityDashboardClient initialQuery={initialQuery} />;
}