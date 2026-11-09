// src/app/sitemaps/[part]/route.ts
// Sitemap parts: /sitemaps/static.xml, /sitemaps/cities-N.xml, /sitemaps/events-N.xml
import { getIndexableCitySlugs, getIndexableEvents, PART_SIZE, SITE, STATIC_PATHS, XML_HEADERS, urlset } from "@/lib/seo/sitemapData";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ part: string }> }) {
  const { part } = await ctx.params;
  const m = String(part).replace(/\.xml$/, "").match(/^(static|cities|events)(?:-(\d+))?$/);
  if (!m) return new Response("Not found", { status: 404 });
  const kind = m[1];
  const n = Number(m[2] || 0);

  if (kind === "static") {
    return new Response(
      urlset(STATIC_PATHS.map((p) => ({ loc: `${SITE}${p}`, changefreq: p === "/" ? "daily" : "monthly", priority: p === "/" ? 1.0 : 0.4 }))),
      { headers: XML_HEADERS }
    );
  }

  if (kind === "cities") {
    const all = (await getIndexableCitySlugs()).flatMap((slug) => [
      { loc: `${SITE}/time/${slug}`, changefreq: "daily", priority: 0.8 },
      { loc: `${SITE}/weather/${slug}`, changefreq: "daily", priority: 0.6 },
    ]);
    const slice = all.slice(n * PART_SIZE, (n + 1) * PART_SIZE);
    if (!slice.length && n > 0) return new Response("Not found", { status: 404 });
    return new Response(urlset(slice), { headers: XML_HEADERS });
  }

  const rows = await getIndexableEvents(n);
  if (!rows.length && n > 0) return new Response("Not found", { status: 404 });
  return new Response(
    urlset(rows.map((r) => ({ loc: `${SITE}/events/${r.id}`, lastmod: r.updated_at, changefreq: "weekly", priority: 0.5 }))),
    { headers: XML_HEADERS }
  );
}
