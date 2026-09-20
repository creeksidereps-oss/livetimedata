// src/app/api/cron/discover-entities/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sources, entities, entityRelationships, appearances } from "@/db/schema";
import { MASTER_DISCOVERY_HUBS } from "@/lib/discovery/seed-sources";
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
    const results: any[] = [];

    // 1. Ensure master discovery hubs are registered in sources table
    for (const hub of MASTER_DISCOVERY_HUBS) {
      await db
        .insert(sources)
        .values({
          url: hub.url,
          sourceType: "discovery_hub",
          name: hub.name,
          scrapeIntervalDays: 7,
          scrapeHorizonMonths: 6,
          lastScrapedAt: new Date(),
          nextScrapeDue: sql`NOW() + interval '7 days'`,
          status: "active",
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: {
            lastScrapedAt: new Date(),
            nextScrapeDue: sql`NOW() + interval '7 days'`,
            updatedAt: new Date(),
          },
        });

      results.push({
        name: hub.name,
        scope: hub.scope,
        category: hub.category,
        url: hub.url,
      });
    }

    // 2. Feed unlinked venues and hosts from events into entities graph
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
        'US' AS country_code,
        'discovered' AS verification_status,
        NOW() AS created_at
      FROM events e
      WHERE e.venue IS NOT NULL
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

    // 3. Execute the Recursive Spider Cycle
    const spiderStats = await runRecursiveSpider(25);

    const totalEntities = await db.select({ count: sql`count(*)` }).from(entities);
    const totalRelationships = await db.select({ count: sql`count(*)` }).from(entityRelationships);
    const totalAppearances = await db.select({ count: sql`count(*)` }).from(appearances);

    return NextResponse.json({
      success: true,
      message: "Discovery Lifecycle spider active and expanding.",
      spiderStats,
      activeHubs: results,
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
