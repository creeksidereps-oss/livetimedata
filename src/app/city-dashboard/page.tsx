import CityDashboardClient from "./ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CityDashboardPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  return <CityDashboardClient initialQuery={searchParams?.q ?? ""} autoPickFirst={false} mode="time" />;
}