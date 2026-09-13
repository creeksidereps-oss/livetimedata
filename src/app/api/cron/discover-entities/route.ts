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

    // 2. Execute the Recursive Spider Cycle
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
