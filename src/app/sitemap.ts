// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { sql } from "@vercel/postgres";
import { INDEXABLE_CITIES } from "@/lib/indexableCities";

// Cache sitemap response for 24 hours (86,400s) for lightning-fast crawler delivery
export const revalidate = 86400;

/**
 * Curated sitemap (AdSense / indexing recovery).
 * Only lists:
 *  - static compliance pages
 *  - the curated, verified city set from src/data/indexableCities.json
 *  - upcoming, publicly visible event detail pages
 * Every other city page remains reachable but is served noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.livetimedata.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/legal`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = INDEXABLE_CITIES.flatMap((c) => [
    { url: `${base}/time/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${base}/weather/${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 },
  ]);

  let eventRoutes: MetadataRoute.Sitemap = [];
  try {
    const { rows } = await sql`
      SELECT id, updated_at FROM events
      WHERE event_date >= CURRENT_DATE
        AND status IN ('live', 'published', 'approved', 'scheduled')
        AND category NOT ILIKE '%yard%' AND category NOT ILIKE '%garage%'
        AND category NOT ILIKE '%estate sale%' AND category NOT ILIKE '%auction%'
      ORDER BY event_date ASC
      LIMIT 20000
    `;
    eventRoutes = rows.map((r) => ({
      url: `${base}/events/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch (err) {
    console.error("Sitemap: failed to load events:", err);
  }

  return [...staticRoutes, ...cityRoutes, ...eventRoutes];
}
