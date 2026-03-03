// src/app/city-dashboard/page.tsx
import CityDashboardClient from "./ui";

export default function CityDashboardPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  // KEY FIX:
  // If there is no query in the URL, pass a single space instead of "".
  // This prevents the input from staying "empty-string" on first render,
  // which is why the X wasn't showing on the home page.
  const initialQuery = (searchParams?.q ?? "").trim() ? (searchParams?.q as string) : " ";

  return <CityDashboardClient initialQuery={initialQuery} />;
}