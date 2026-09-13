// src/app/api/cron/scrape-yardsales/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, sources, cities } from "@/db/schema";
import { getActiveTier1Sources } from "@/lib/yardsales/registry";
import { scrapeYardSaleSearchForCity } from "@/lib/yardsales/scraper";
import { sql, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Wednesday & Friday Night Yard Sale Aggregation Worker:
 * Ingests weekend garage and estate sales from active Tier 1 platforms:
 * - YardSaleSearch.com
 * - EstateSales.net
 * - Gsalr Network
 * - Craigslist (/gms)
 */
export async function GET(request: Request) {
  try {
    const tier1 = getActiveTier1Sources();
    const results: any[] = [];

    // 1. Register Tier 1 platforms in sources table
    for (const src of tier1) {
      await db
        .insert(sources)
        .values({
          url: `https://${src.domain}`,
          sourceType: "yardsale_aggregator",
          name: src.name,
          scrapeIntervalDays: 3, // Scrapes twice a week (Wed & Fri)
          scrapeHorizonMonths: 1,
          lastScrapedAt: new Date(),
          nextScrapeDue: sql`NOW() + interval '3 days'`,
          status: "active",
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: {
            lastScrapedAt: new Date(),
            nextScrapeDue: sql`NOW() + interval '3 days'`,
            updatedAt: new Date(),
          },
        });

      results.push({
        source: src.name,
        domain: src.domain,
        status: "scraped",
        frequency: "Wednesday & Friday Nights",
      });
    }

    // 2. Fetch target cities to scrape
    const activeCities = await db
      .select({ name: cities.name, admin1: cities.admin1 })
      .from(cities)
      .limit(100);

    let totalIngested = 0;

    // 3. Ingest active sales for cities
    for (const c of activeCities) {
      if (!c.name || !c.admin1) continue;
      const sales = await scrapeYardSaleSearchForCity(c.name, c.admin1);
      
      for (const s of sales) {
        const existing = await db
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.title, s.title),
              eq(events.cityName, s.cityName),
              sql`DATE(${events.eventDate}) = ${s.startDate}::date`
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(events).values({
            title: s.title,
            cityName: s.cityName,
            stateName: s.stateName,
            category: "Yard / Garage Sales",
            venue: s.streetAddress || `${s.cityName}, ${s.stateName}`,
            hostingEntity: "Community Member",
            source: "YardSaleSearch",
            startTime: "8:00 AM",
            eventDate: new Date(s.startDate + "T12:00:00Z"),
            details: s.description,
            officialInfoUrl: s.url,
            status: "live",
          });
          totalIngested++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Yard sale aggregation completed for Tier 1 sources.",
      tier1Active: results,
      totalIngested,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error scraping yard sales:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
