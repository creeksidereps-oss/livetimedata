// src/app/api/cron/discover-entities/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { entities, entityRelationships, appearances } from "@/db/schema";
import { runRecursiveSpider } from "@/lib/discovery/spider";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Universal Discovery Lifecycle Worker:
 * Recursively spiders the entity graph:
 * ENTITY -> SCHEDULE -> VENUES -> VENUE CALENDAR -> CO-HOSTS/PERFORMERS -> NEW CITIES -> REPEAT
 */
export async function GET(request: Request) {
  try {
    // Seeds live in the `sources` table (GEMINI.md rule 9) - no hardcoded seed list here.

    // 1. Feed unlinked venues from VERIFIED events into the entities graph.
    //    City/state/country come from the event's verified location (publishEvent); nothing is defaulted.
    await db.execute(sql`
      INSERT INTO entities (
        name,
        normalized_name,
        entity_type,
        subtype,
        city_name,
        state_name,
        country_code,
        verification_status,
        created_at
      )
      SELECT DISTINCT ON (LOWER(TRIM(e.venue)))
        TRIM(e.venue) AS name,
        LOWER(REGEXP_REPLACE(TRIM(e.venue), '[^a-zA-Z0-9 ]', '', 'g')) AS normalized_name,
        'venue' AS entity_type,
        'venue' AS subtype,
        e.city_name,
        e.state_name,
        e.country_code,
        'discovered' AS verification_status,
        NOW() AS created_at
      FROM events e
      WHERE e.city_slug IS NOT NULL
        AND e.venue IS NOT NULL
        AND TRIM(e.venue) != ''
        AND TRIM(e.venue) != 'Local Venue'
        AND TRIM(e.venue) != 'Unknown Venue'
        AND e.source NOT IN ('EstateSales.NET', 'YardSaleSearch', 'Gsalr Network')
        AND (e.category IS NULL OR e.category NOT IN ('Yard Sale', 'Estate Sale', 'Garage Sale'))
        AND TRIM(e.venue) !~ '^[0-9]+\\s+[A-Za-z]'
        AND TRIM(e.venue) !~ '^#[0-9]+'
        AND NOT EXISTS (
          SELECT 1 FROM entities ent 
          WHERE LOWER(TRIM(ent.name)) = LOWER(TRIM(e.venue))
        )
      ORDER BY LOWER(TRIM(e.venue)), e.event_date DESC
      LIMIT 100;
    `);

    // 2. Execute the Recursive Spider Cycle
    const spiderStats = await runRecursiveSpider(25);

    const totalEntities = await db.select({ count: sql`count(*)` }).from(entities);
    const totalRelationships = await db.select({ count: sql`count(*)` }).from(entityRelationships);
    const totalAppearances = await db.select({ count: sql`count(*)` }).from(appearances);

    return NextResponse.json({
      success: true,
      message: "Discovery Lifecycle spider active and expanding.",
      spiderStats,
      totalEntitiesInGraph: Number(totalEntities[0]?.count || 0),
      totalRelationshipsInGraph: Number(totalRelationships[0]?.count || 0),
      totalAppearancesInGraph: Number(totalAppearances[0]?.count || 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in discover-entities cron:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
