// src/app/city-dashboard/page.tsx
//
// LEGACY ROUTE. City pages live at the canonical /time/{slug}. Old /city-dashboard?slug=... links
// (and their trailing-hyphen variants like "stockholm-") are permanently redirected there.
// An unknown city returns 404. It never falls back to a default city.
import { notFound, permanentRedirect } from "next/navigation";
import { resolveCityFromSlug } from "@/lib/cityResolver";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CityDashboardLegacyPage(props: {
  params: Promise<{ slug?: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await props.params;
  const sp = await props.searchParams;

  // Old shared event links: /city-dashboard?slug=...&eventId=123 -> the event's own page.
  const eventId = typeof sp?.eventId === "string" && /^\d+$/.test(sp.eventId) ? sp.eventId : null;
  if (eventId) permanentRedirect(`/events/${eventId}`);

  const raw = String(p?.slug || sp?.slug || "").trim();
  if (!raw) permanentRedirect("/");
  const slug = decodeURIComponent(raw).toLowerCase().replace(/^-+|-+$/g, "");

  const memory = resolveCityFromSlug(slug, false);
  if (memory?.slug) permanentRedirect(`/time/${memory.slug}`);

  const { rows } = await sql`
    SELECT slug FROM cities
    WHERE LOWER(slug) = ${slug} AND latitude IS NOT NULL AND longitude IS NOT NULL
    LIMIT 1`;
  if (rows[0]?.slug) permanentRedirect(`/time/${rows[0].slug}`);

  notFound();
}
