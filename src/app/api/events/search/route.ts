// src/app/api/events/search/route.ts
// Event search for the EventsBlock search box. Verified events only, located by coordinates
// (src/lib/events/query.ts). No city-name prefix matching, no state-abbreviation heuristics.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveCategoriesFromKeywords, isPureCategoryQuery, extractSearchTokens } from "@/lib/search-taxonomy";
import { findPublicEvents, toEventDTO } from "@/lib/events/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_CATEGORY_WORDS = new Set([
  "festival", "festivals", "fest", "fair", "fairs", "carnival", "fiesta",
  "concert", "concerts", "music", "live", "band", "bands", "show", "shows",
  "food", "truck", "trucks", "sports", "sport", "game", "games", "race",
  "event", "events", "sale", "sales", "class", "classes", "workshop", "tour",
]);

const num = (v: string | null) => (v === null || v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = (searchParams.get("q") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const state = (searchParams.get("state") || "").trim();
    const nearby = searchParams.get("nearby") === "true";
    const lat = num(searchParams.get("lat"));
    const lon = num(searchParams.get("lon"));

    if (!rawQuery) {
      return NextResponse.json({ ok: false, error: "Search query 'q' is required." }, { status: 400 });
    }
    const qLower = rawQuery.toLowerCase();

    // 1. Banned entities quarantine
    try {
      const bannedCheck = await sql`SELECT term FROM banned_entities WHERE LOWER(term) = ${qLower} LIMIT 1`;
      if (bannedCheck.rows.length > 0) {
        sql`UPDATE banned_entities SET hit_count = hit_count + 1, last_attempted_at = NOW() WHERE LOWER(term) = ${qLower}`.catch(() => {});
        return NextResponse.json({
          ok: true, banned: true,
          message: "This search query could not be located or is restricted from public directory listings.",
          localEvents: [], allEvents: [],
        });
      }
    } catch (e) {
      console.warn("Banned entities lookup skipped:", e);
    }

    // 2. Category keywords + tokens
    const matchedCategories = resolveCategoriesFromKeywords(rawQuery);
    const tokens = extractSearchTokens(rawQuery);
    const specificTokens = tokens.filter((t) => !GENERIC_CATEGORY_WORDS.has(t));
    const isPureCategory = isPureCategoryQuery(rawQuery) || (specificTokens.length === 0 && matchedCategories.length > 0);
    const phrasePattern = `%${qLower}%`;
    const specificPattern = specificTokens.length > 0 ? `%${specificTokens[0]}%` : phrasePattern;
    const textPatterns = Array.from(new Set([phrasePattern, specificPattern]));
    const categoryPatterns = isPureCategory ? [phrasePattern, ...matchedCategories.map((c) => `%${c.toLowerCase()}%`)] : [];

    // 3. Entity lookup (scoped to the city name when one is given; entities are informational only)
    let matchedEntity: any = null;
    try {
      const entityResult = city
        ? await sql`
            SELECT id, name, entity_type, subtype, city_name, state_name, website_url FROM entities
            WHERE LOWER(city_name) = LOWER(${city})
              AND (LOWER(name) = ${qLower} OR LOWER(name) LIKE ${phrasePattern} OR LOWER(name) LIKE ${specificPattern})
            ORDER BY CASE WHEN LOWER(name) = ${qLower} THEN 0 WHEN LOWER(name) LIKE ${phrasePattern} THEN 1 ELSE 2 END
            LIMIT 1`
        : await sql`
            SELECT id, name, entity_type, subtype, city_name, state_name, website_url FROM entities
            WHERE LOWER(name) = ${qLower} OR LOWER(name) LIKE ${phrasePattern} OR LOWER(name) LIKE ${specificPattern}
            ORDER BY CASE WHEN LOWER(name) = ${qLower} THEN 0 WHEN LOWER(name) LIKE ${phrasePattern} THEN 1 ELSE 2 END
            LIMIT 1`;
      matchedEntity = entityResult.rows[0] || null;
    } catch (e) {
      console.warn("Entity lookup warning:", e);
    }

    // 4. Events: local (this city / nearby, by coordinates) + everywhere
    const localRows = lat !== null && lon !== null
      ? await findPublicEvents({ lat, lon, nearby, textPatterns, categoryPatterns, limit: 100 })
      : [];
    const allRows = await findPublicEvents({ everywhere: true, textPatterns, categoryPatterns, limit: 150 });

    const localEvents = localRows.map(toEventDTO);
    const allEvents = allRows.map(toEventDTO);

    // 5. Search logging (async)
    sql`
      INSERT INTO search_logs (query_text, city_name, state_name, result_count, is_entity_match)
      VALUES (${rawQuery}, ${city || null}, ${state || null}, ${allEvents.length}, ${Boolean(matchedEntity)})
    `.catch((logErr) => console.warn("Search log error:", logErr));

    return NextResponse.json({
      ok: true, query: rawQuery, isEntity: Boolean(matchedEntity), entity: matchedEntity,
      matchedCategories, localEvents, allEvents,
    });
  } catch (error: any) {
    console.error("Events search failed:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to search events" }, { status: 500 });
  }
}
