// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { sql } from "@vercel/postgres";

// Cache sitemap response for 24 hours (86,400s) for lightning-fast crawler delivery
export const revalidate = 86400;

function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function norm(str?: string | null): string {
  return (str || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function isJunkCityName(name?: string | null): boolean {
  if (!name || name.trim().length < 2) return true;
  const t = name.trim();
  if (/^\d+$/.test(t)) return true; // purely numeric
  if (/^https?:\/\//i.test(t)) return true; // URL
  if (["unknown", "various", "online", "virtual", "tba", "tbd"].includes(t.toLowerCase())) return true;
  if (t.toLowerCase().startsWith("region_holiday") || t.toLowerCase().startsWith("regionholiday")) return true;
  return false;
}

interface CityCandidate {
  name: string;
  admin1: string;
  country: string;
  country_code: string;
  lat: number | null;
  lon: number | null;
  slug: string;
  sources: Set<string>;
}

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

  try {
    // 1. Concurrently fetch all 5 content-bearing sources from PostgreSQL
    const [citiesRes, reportsRes, factsRes, eventsRes, webcamsRes] = await Promise.all([
      sql`
        SELECT slug, name, admin1, country_name, country_code, latitude, longitude
        FROM cities
        WHERE name IS NOT NULL AND TRIM(name) != '';
      `,
      sql`
        SELECT city_name, state_name, lat, lng
        FROM city_reports
        WHERE content IS NOT NULL AND LENGTH(content) > 150;
      `,
      sql`
        SELECT city_name, state_name, country_name, COUNT(*) as count
        FROM city_fun_facts
        WHERE is_approved = TRUE
        GROUP BY city_name, state_name, country_name;
      `,
      sql`
        SELECT city_name, state_name, country_code, COUNT(*) as count
        FROM events
        WHERE city_name IS NOT NULL AND TRIM(city_name) != ''
        GROUP BY city_name, state_name, country_code;
      `,
      sql`
        SELECT city_name, state_name, country, COUNT(*) as count
        FROM webcams
        WHERE city_name IS NOT NULL AND TRIM(city_name) != ''
        GROUP BY city_name, state_name, country;
      `
    ]);

    const inventory = new Map<string, CityCandidate>();
    const baseKeyMap = new Map<string, CityCandidate>();

    function registerCity(params: {
      name?: string | null;
      admin1?: string | null;
      country?: string | null;
      country_code?: string | null;
      lat?: number | null;
      lon?: number | null;
      slug?: string | null;
      source: string;
    }) {
      const { name, admin1, country, country_code, lat, lon, slug, source } = params;
      if (!name || isJunkCityName(name)) return;

      const cleanName = name.trim();
      const cleanAdmin = (admin1 || "").trim();
      const cleanCountry = (country || (country_code === "US" ? "United States" : (country_code || ""))).trim();
      const cleanCountryCode = (country_code || (cleanCountry === "United States" ? "US" : "")).trim();

      // Require at least a state/province or country to ensure distinct geographic identity
      if (!cleanAdmin && !cleanCountry) return;

      // Filter out raw state placeholder entries (e.g. "ALABAMA" with no admin)
      if (!cleanAdmin && cleanName === cleanName.toUpperCase() && cleanName.length > 3) return;

      const normKey = `${norm(cleanName)}|${norm(cleanAdmin)}|${norm(cleanCountry || cleanCountryCode)}`;
      const baseKey = cleanAdmin ? `${norm(cleanName)}|${norm(cleanAdmin)}` : null;

      let existing = inventory.get(normKey);
      if (!existing && baseKey && baseKeyMap.has(baseKey)) {
        existing = baseKeyMap.get(baseKey);
      }

      if (!existing) {
        let finalSlug = slug;
        if (!finalSlug || finalSlug.length < 2) {
          if (cleanAdmin) {
            finalSlug = `${slugify(cleanName)}-${slugify(cleanAdmin)}`;
          } else if (cleanCountry && cleanCountry.toLowerCase() !== "united states") {
            finalSlug = `${slugify(cleanName)}-${slugify(cleanCountry)}`;
          } else {
            finalSlug = slugify(cleanName);
          }
        }

        existing = {
          name: cleanName,
          admin1: cleanAdmin,
          country: cleanCountry,
          country_code: cleanCountryCode,
          lat: lat ? Number(lat) : null,
          lon: lon ? Number(lon) : null,
          slug: finalSlug.toLowerCase(),
          sources: new Set<string>(),
        };
        inventory.set(normKey, existing);
        if (baseKey) baseKeyMap.set(baseKey, existing);
      }

      existing.sources.add(source);
      if (!existing.lat && lat) existing.lat = Number(lat);
      if (!existing.lon && lon) existing.lon = Number(lon);
      if (!existing.slug && slug) existing.slug = slug.toLowerCase();
    }

    // 1. Process cities table (authoritative registered slugs and coordinates)
    for (const c of citiesRes.rows) {
      registerCity({
        name: c.name,
        admin1: c.admin1,
        country: c.country_name,
        country_code: c.country_code,
        lat: c.latitude ? Number(c.latitude) : null,
        lon: c.longitude ? Number(c.longitude) : null,
        slug: c.slug,
        source: "cities"
      });
    }

    // 2. Process city_reports
    for (const r of reportsRes.rows) {
      registerCity({
        name: r.city_name,
        admin1: r.state_name,
        lat: r.lat && r.lat != 0 ? Number(r.lat) : null,
        lon: r.lng && r.lng != 0 ? Number(r.lng) : null,
        source: "city_reports"
      });
    }

    // 3. Process city_fun_facts
    for (const f of factsRes.rows) {
      registerCity({
        name: f.city_name,
        admin1: f.state_name,
        country: f.country_name,
        source: "city_fun_facts"
      });
    }

    // 4. Process events
    for (const ev of eventsRes.rows) {
      registerCity({
        name: ev.city_name,
        admin1: ev.state_name,
        country_code: ev.country_code,
        source: "events"
      });
    }

    // 5. Process webcams
    for (const w of webcamsRes.rows) {
      registerCity({
        name: w.city_name,
        admin1: w.state_name,
        country: w.country,
        source: "webcams"
      });
    }

    // Deduplicate slugs to guarantee 100% uniqueness across all URLs
    const slugCounts = new Map<string, number>();
    const eligibleSlugs: string[] = [];

    for (const city of inventory.values()) {
      let finalSlug = city.slug;

      // Disambiguate if slug collides with another city
      if (slugCounts.has(finalSlug)) {
        if (city.admin1) {
          finalSlug = `${slugify(city.name)}-${slugify(city.admin1)}`;
        } else if (city.country) {
          finalSlug = `${slugify(city.name)}-${slugify(city.country)}`;
        }
      }

      if (!slugCounts.has(finalSlug)) {
        slugCounts.set(finalSlug, 1);
        eligibleSlugs.push(finalSlug);
      } else {
        if (city.country && !finalSlug.includes(slugify(city.country))) {
          finalSlug = `${finalSlug}-${slugify(city.country)}`;
        }
        if (!slugCounts.has(finalSlug)) {
          slugCounts.set(finalSlug, 1);
          eligibleSlugs.push(finalSlug);
        }
      }
    }

    // Generate canonical /time/ and /weather/ URLs for all qualifying cities
    const cityRoutes: MetadataRoute.Sitemap = eligibleSlugs.flatMap((slug) => [
      { url: `${base}/time/${slug}`, changeFrequency: "daily", priority: 0.8 },
      { url: `${base}/weather/${slug}`, changeFrequency: "daily", priority: 0.8 },
    ]);

    return [...staticRoutes, ...cityRoutes];
  } catch (err) {
    console.error("Failed to build dynamic database sitemap, falling back to static routes:", err);
    return staticRoutes;
  }
}