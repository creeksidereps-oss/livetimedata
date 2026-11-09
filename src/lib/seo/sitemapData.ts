// src/lib/seo/sitemapData.ts
// Data for the growing sitemap (index + parts). Same rules as page robots tags:
//   cities  -> curated set + any city with real content (src/lib/seo/cityIndexability.ts)
//   events  -> verified (city_slug), public, upcoming, NOT sale-type (sales are deleted after 7 days)
import { pool } from "@/lib/db";
import { INDEXABLE_CITIES } from "@/lib/indexableCities";
import { CITY_HAS_CONTENT_SQL } from "./cityIndexability";

export const SITE = "https://www.livetimedata.com";
export const PART_SIZE = 40000; // under Google's 50,000-URL limit per file

export const STATIC_PATHS = ["/", "/about", "/contact", "/privacy", "/legal", "/terms"];

const SALE_SQL = `(e.listing_kind = 'sale' OR (e.listing_kind IS NULL AND (e.category || ' ' || e.title) ~* '(yard sale|garage sale|estate sale|car boot|boot sale|rummage sale|tag sale|moving sale|flea market|auction|vide.grenier|brocante)'))`;

export const INDEXABLE_EVENTS_WHERE = `
  e.city_slug IS NOT NULL
  AND e.status IN ('live','published','approved','scheduled')
  AND e.event_date >= CURRENT_DATE
  AND NOT ${SALE_SQL}`;

export async function getIndexableCitySlugs(): Promise<string[]> {
  const slugs = new Set(INDEXABLE_CITIES.map((c) => c.slug.toLowerCase()));
  try {
    const { rows } = await pool.query(
      `SELECT c.slug FROM cities c
        WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND ${CITY_HAS_CONTENT_SQL}`
    );
    for (const r of rows) if (r.slug) slugs.add(String(r.slug).toLowerCase());
  } catch (e) {
    console.error("[sitemap] content-city query failed, using curated set only:", (e as any)?.message);
  }
  return [...slugs].sort();
}

export async function countIndexableEvents(): Promise<number> {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM events e WHERE ${INDEXABLE_EVENTS_WHERE}`);
  return rows[0]?.n || 0;
}

export async function getIndexableEvents(part: number): Promise<{ id: number; updated_at: Date | null }[]> {
  const { rows } = await pool.query(
    `SELECT e.id, e.updated_at FROM events e WHERE ${INDEXABLE_EVENTS_WHERE}
      ORDER BY e.id LIMIT $1 OFFSET $2`,
    [PART_SIZE, part * PART_SIZE]
  );
  return rows;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function urlset(urls: { loc: string; lastmod?: Date | null; changefreq?: string; priority?: number }[]): string {
  const body = urls
    .map((u) =>
      `<url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ""}${u.priority !== undefined ? `<priority>${u.priority}</priority>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};
