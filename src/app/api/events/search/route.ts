import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveCategoriesFromKeywords, isPureCategoryQuery, extractSearchTokens } from "@/lib/search-taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", VI: "Virgin Islands", GU: "Guam"
};

function getStateVariations(stateInput: string): string[] {
  if (!stateInput) return [];
  const cleaned = stateInput.trim();
  const lower = cleaned.toLowerCase();
  const variations = new Set<string>([lower]);

  if (cleaned.length === 2) {
    const full = US_STATE_ABBREVIATIONS[cleaned.toUpperCase()];
    if (full) variations.add(full.toLowerCase());
  } else {
    for (const [abbr, full] of Object.entries(US_STATE_ABBREVIATIONS)) {
      if (full.toLowerCase() === lower) {
        variations.add(abbr.toLowerCase());
        break;
      }
    }
  }
  return Array.from(variations);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = (searchParams.get("q") || "").trim();
    const city = (searchParams.get("city") || "").trim();
    const state = (searchParams.get("state") || "").trim();
    const nearby = searchParams.get("nearby") === "true";
    const latParam = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
    const lonParam = searchParams.get("lon") ? parseFloat(searchParams.get("lon")!) : null;
    const hasCoords = latParam !== null && !isNaN(latParam) && lonParam !== null && !isNaN(lonParam);

    if (!rawQuery) {
      return NextResponse.json({ ok: false, error: "Search query 'q' is required." }, { status: 400 });
    }

    const qLower = rawQuery.toLowerCase();

    // 1. Check Banned Entities Quarantine
    // 1. Check Banned Entities Quarantine
    try {
      const bannedCheck = await sql`
        SELECT term, reason FROM banned_entities 
        WHERE LOWER(term) = ${qLower}
        LIMIT 1
      `;
      if (bannedCheck.rows.length > 0) {
        // Update hit count
        sql`
          UPDATE banned_entities 
          SET hit_count = hit_count + 1, last_attempted_at = NOW() 
          WHERE LOWER(term) = ${qLower}
        `.catch(() => {});

        return NextResponse.json({
          ok: true,
          banned: true,
          message: "This search query could not be located or is restricted from public directory listings.",
          localEvents: [],
          allEvents: []
        });
      }
    } catch (e) {
      console.warn("Banned entities lookup skipped:", e);
    }

    // 2. Multilingual Category Keyword Resolution & Token Extraction
    const matchedCategories = resolveCategoriesFromKeywords(rawQuery);
    const stateVars = getStateVariations(state);
    const tokens = extractSearchTokens(rawQuery);

    const GENERIC_CATEGORY_WORDS = new Set([
      'festival', 'festivals', 'fest', 'fair', 'fairs', 'carnival', 'fiesta',
      'concert', 'concerts', 'music', 'live', 'band', 'bands', 'show', 'shows',
      'food', 'truck', 'trucks', 'sports', 'sport', 'game', 'games', 'race',
      'event', 'events', 'sale', 'sales', 'class', 'classes', 'workshop', 'tour'
    ]);

    const specificTokens = tokens.filter(t => !GENERIC_CATEGORY_WORDS.has(t));
    const isPureCategory = isPureCategoryQuery(rawQuery) || (specificTokens.length === 0 && matchedCategories.length > 0);

    // 3. Entity Graph Lookup (strictly scoped to city when searching a city)
    const phrasePattern = '%' + qLower + '%';
    const specificPattern = specificTokens.length > 0 ? '%' + specificTokens[0] + '%' : phrasePattern;

    let matchedEntity: any = null;
    try {
      if (city) {
        // Look for entity ONLY in the specific city
        const entityResult = await sql`
          SELECT id, name, entity_type, subtype, city_name, state_name, website_url 
          FROM entities 
          WHERE LOWER(city_name) = LOWER(${city})
            AND (
              LOWER(name) = ${qLower} 
              OR LOWER(name) LIKE ${phrasePattern}
              OR LOWER(name) LIKE ${specificPattern}
            )
          ORDER BY 
            CASE 
              WHEN LOWER(name) = ${qLower} THEN 0 
              WHEN LOWER(name) LIKE ${phrasePattern} THEN 1
              ELSE 2 
            END ASC
          LIMIT 1
        `;
        if (entityResult.rows.length > 0) {
          matchedEntity = entityResult.rows[0];
        }
      } else {
        // Nationwide search if no city specified
        const entityResult = await sql`
          SELECT id, name, entity_type, subtype, city_name, state_name, website_url 
          FROM entities 
          WHERE LOWER(name) = ${qLower} 
             OR LOWER(name) LIKE ${phrasePattern}
             OR LOWER(name) LIKE ${specificPattern}
          ORDER BY 
            CASE 
              WHEN LOWER(name) = ${qLower} THEN 0 
              WHEN LOWER(name) LIKE ${phrasePattern} THEN 1
              ELSE 2 
            END ASC
          LIMIT 1
        `;
        if (entityResult.rows.length > 0) {
          matchedEntity = entityResult.rows[0];
        }
      }
    } catch (e) {
      console.warn("Entity lookup warning:", e);
    }

    // 4. Query Events
    const categoryFilterPatterns = matchedCategories.length > 0 
      ? matchedCategories.map(c => `%${c.toLowerCase()}%`) 
      : ['__NO_MATCH__'];

    let localRows: any[] = [];
    let allRows: any[] = [];

    // Local Search
    if (city) {
      if (nearby && hasCoords) {
        // Haversine Radius Search (30 miles)
        const localRes = isPureCategory
          ? await sql`
              SELECT e.* 
              FROM events e
              JOIN cities c ON LOWER(e.city_name) = LOWER(c.name)
              WHERE e.status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (e.event_date >= CURRENT_DATE - INTERVAL '1 day' OR e.event_date IS NULL)
                AND (
                  LOWER(e.title) LIKE ${phrasePattern}
                  OR LOWER(e.venue) LIKE ${phrasePattern}
                  OR LOWER(e.category) LIKE ${phrasePattern}
                  OR LOWER(e.category) LIKE ANY(${categoryFilterPatterns})
                  OR LOWER(COALESCE(e.hosting_entity, '')) LIKE ${phrasePattern}
                  OR LOWER(COALESCE(e.details, '')) LIKE ${phrasePattern}
                )
                AND 3959 * acos(
                      LEAST(1.0, GREATEST(-1.0,
                        cos(radians(${latParam})) * cos(radians(c.latitude)) * 
                        cos(radians(c.longitude) - radians(${lonParam})) + 
                        sin(radians(${latParam})) * sin(radians(c.latitude))
                      ))
                    ) <= 30
              ORDER BY 
                CASE WHEN LOWER(e.title) LIKE ${phrasePattern} THEN 0 ELSE 1 END ASC,
                e.event_date ASC, e.start_time ASC
              LIMIT 100
            `
          : await sql`
              SELECT e.* 
              FROM events e
              JOIN cities c ON LOWER(e.city_name) = LOWER(c.name)
              WHERE e.status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (e.event_date >= CURRENT_DATE - INTERVAL '1 day' OR e.event_date IS NULL)
                AND (
                  LOWER(e.title) LIKE ${phrasePattern}
                  OR LOWER(e.title) LIKE ${specificPattern}
                  OR LOWER(e.venue) LIKE ${phrasePattern}
                  OR LOWER(e.venue) LIKE ${specificPattern}
                  OR LOWER(COALESCE(e.hosting_entity, '')) LIKE ${specificPattern}
                  OR LOWER(COALESCE(e.details, '')) LIKE ${specificPattern}
                )
                AND 3959 * acos(
                      LEAST(1.0, GREATEST(-1.0,
                        cos(radians(${latParam})) * cos(radians(c.latitude)) * 
                        cos(radians(c.longitude) - radians(${lonParam})) + 
                        sin(radians(${latParam})) * sin(radians(c.latitude))
                      ))
                    ) <= 30
              ORDER BY 
                CASE 
                  WHEN LOWER(e.title) LIKE ${phrasePattern} THEN 0 
                  WHEN LOWER(e.title) LIKE ${specificPattern} THEN 1 
                  ELSE 2 
                END ASC,
                e.event_date ASC, e.start_time ASC
              LIMIT 100
            `;
        localRows = localRes.rows;
      } else if (state) {
        // Exact City Search with State
        const localRes = isPureCategory
          ? await sql`
              SELECT * FROM events 
              WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
                AND (
                  LOWER(state_name) = ANY(${stateVars})
                  OR state_name IS NULL 
                  OR state_name = ''
                )
                AND status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
                AND (
                  LOWER(title) LIKE ${phrasePattern}
                  OR LOWER(venue) LIKE ${phrasePattern}
                  OR LOWER(category) LIKE ${phrasePattern}
                  OR LOWER(category) LIKE ANY(${categoryFilterPatterns})
                  OR LOWER(COALESCE(hosting_entity, '')) LIKE ${phrasePattern}
                  OR LOWER(COALESCE(details, '')) LIKE ${phrasePattern}
                )
              ORDER BY 
                CASE WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 ELSE 1 END ASC,
                event_date ASC, start_time ASC
              LIMIT 100
            `
          : await sql`
              SELECT * FROM events 
              WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
                AND (
                  LOWER(state_name) = ANY(${stateVars})
                  OR state_name IS NULL 
                  OR state_name = ''
                )
                AND status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
                AND (
                  LOWER(title) LIKE ${phrasePattern}
                  OR LOWER(title) LIKE ${specificPattern}
                  OR LOWER(venue) LIKE ${phrasePattern}
                  OR LOWER(venue) LIKE ${specificPattern}
                  OR LOWER(COALESCE(hosting_entity, '')) LIKE ${specificPattern}
                  OR LOWER(COALESCE(details, '')) LIKE ${specificPattern}
                )
              ORDER BY 
                CASE 
                  WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 
                  WHEN LOWER(title) LIKE ${specificPattern} THEN 1 
                  ELSE 2 
                END ASC,
                event_date ASC, start_time ASC
              LIMIT 100
            `;
        localRows = localRes.rows;
      } else {
        // Exact City Search without State
        const localRes = isPureCategory
          ? await sql`
              SELECT * FROM events 
              WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
                AND status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
                AND (
                  LOWER(title) LIKE ${phrasePattern}
                  OR LOWER(venue) LIKE ${phrasePattern}
                  OR LOWER(category) LIKE ${phrasePattern}
                  OR LOWER(category) LIKE ANY(${categoryFilterPatterns})
                  OR LOWER(COALESCE(hosting_entity, '')) LIKE ${phrasePattern}
                  OR LOWER(COALESCE(details, '')) LIKE ${phrasePattern}
                )
              ORDER BY 
                CASE WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 ELSE 1 END ASC,
                event_date ASC, start_time ASC
              LIMIT 100
            `
          : await sql`
              SELECT * FROM events 
              WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
                AND status NOT IN ('pending', 'pending_review', 'legal_hold')
                AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
                AND (
                  LOWER(title) LIKE ${phrasePattern}
                  OR LOWER(title) LIKE ${specificPattern}
                  OR LOWER(venue) LIKE ${phrasePattern}
                  OR LOWER(venue) LIKE ${specificPattern}
                  OR LOWER(COALESCE(hosting_entity, '')) LIKE ${specificPattern}
                  OR LOWER(COALESCE(details, '')) LIKE ${specificPattern}
                )
              ORDER BY 
                CASE 
                  WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 
                  WHEN LOWER(title) LIKE ${specificPattern} THEN 1 
                  ELSE 2 
                END ASC,
                event_date ASC, start_time ASC
              LIMIT 100
            `;
        localRows = localRes.rows;
      }
    }

    // Full Everywhere Search (Chronological, across all cities)
    const allRes = isPureCategory
      ? await sql`
          SELECT * FROM events 
          WHERE status NOT IN ('pending', 'pending_review', 'legal_hold')
            AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
            AND (
              LOWER(title) LIKE ${phrasePattern}
              OR LOWER(venue) LIKE ${phrasePattern}
              OR LOWER(category) LIKE ${phrasePattern}
              OR LOWER(category) LIKE ANY(${categoryFilterPatterns})
              OR LOWER(COALESCE(hosting_entity, '')) LIKE ${phrasePattern}
              OR LOWER(COALESCE(details, '')) LIKE ${phrasePattern}
            )
          ORDER BY 
            CASE WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 ELSE 1 END ASC,
            event_date ASC, start_time ASC
          LIMIT 150
        `
      : await sql`
          SELECT * FROM events 
          WHERE status NOT IN ('pending', 'pending_review', 'legal_hold')
            AND (event_date >= CURRENT_DATE - INTERVAL '1 day' OR event_date IS NULL)
            AND (
              LOWER(title) LIKE ${phrasePattern}
              OR LOWER(title) LIKE ${specificPattern}
              OR LOWER(venue) LIKE ${phrasePattern}
              OR LOWER(venue) LIKE ${specificPattern}
              OR LOWER(COALESCE(hosting_entity, '')) LIKE ${specificPattern}
              OR LOWER(COALESCE(details, '')) LIKE ${specificPattern}
            )
          ORDER BY 
            CASE 
              WHEN LOWER(title) LIKE ${phrasePattern} THEN 0 
              WHEN LOWER(title) LIKE ${specificPattern} THEN 1 
              ELSE 2 
            END ASC,
            event_date ASC, start_time ASC
          LIMIT 150
        `;
    allRows = allRes.rows;

    // Format events for client
    const formatEvent = (row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      venue: row.venue,
      source: row.source,
      startTime: row.start_time,
      eventDate: row.event_date ? (row.event_date.toISOString ? row.event_date.toISOString() : String(row.event_date)) : null,
      details: row.details,
      affiliateUrl: row.affiliate_url,
      venue_address: row.venue_address,
      hosting_entity: row.hosting_entity,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      official_info_url: row.official_info_url,
      social_urls: row.social_urls,
      registration_url: row.registration_url,
      event_flyer_url: row.event_flyer_url,
      cityName: row.city_name,
      stateName: row.state_name
    });

    const localEvents = localRows.map(formatEvent);
    const allEvents = allRows.map(formatEvent);

    // 5. Asynchronous Search Logging
    sql`
      INSERT INTO search_logs (query_text, city_name, state_name, result_count, is_entity_match)
      VALUES (${rawQuery}, ${city || null}, ${state || null}, ${allEvents.length}, ${Boolean(matchedEntity)})
    `.catch((logErr) => console.warn("Search log error:", logErr));

    return NextResponse.json({
      ok: true,
      query: rawQuery,
      isEntity: Boolean(matchedEntity),
      entity: matchedEntity,
      matchedCategories,
      localEvents,
      allEvents
    });

  } catch (error: any) {
    console.error("Events search failed:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to search events" }, { status: 500 });
  }
}
