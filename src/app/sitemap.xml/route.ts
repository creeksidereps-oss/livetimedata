// src/app/sitemap.xml/route.ts
// Sitemap INDEX. Grows automatically: one cities part per 40k cities, one events part per 40k events.
import { getIndexableCitySlugs, countIndexableEvents, PART_SIZE, SITE, XML_HEADERS, xmlEscape } from "@/lib/seo/sitemapData";

export const dynamic = "force-dynamic";

export async function GET() {
  const [citySlugs, eventCount] = await Promise.all([getIndexableCitySlugs(), countIndexableEvents().catch(() => 0)]);
  const parts = ["static"];
  // each city contributes 2 URLs (/time and /weather)
  for (let i = 0; i < Math.max(1, Math.ceil((citySlugs.length * 2) / PART_SIZE)); i++) parts.push(`cities-${i}`);
  for (let i = 0; i < Math.ceil(eventCount / PART_SIZE); i++) parts.push(`events-${i}`);
  const now = new Date().toISOString();
  const body = parts.map((p) => `<sitemap><loc>${xmlEscape(`${SITE}/sitemaps/${p}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`).join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`,
    { headers: XML_HEADERS }
  );
}
