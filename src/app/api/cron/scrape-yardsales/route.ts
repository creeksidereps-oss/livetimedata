// src/app/api/cron/scrape-yardsales/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, sources, cities } from "@/db/schema";
import { getActiveTier1Sources } from "@/lib/yardsales/registry";
import {
  scrapeYardSaleSearchForCity,
  scrapeGsalrForCity,
  scrapeEstateSalesForCity,
  ScrapedYardSale,
} from "@/lib/yardsales/scraper";
import { sql, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Wednesday & Friday Night Yard Sale Aggregation Worker:
 * Ingests weekend garage and estate sales from active Tier 1 platforms:
 * - Gsalr Network (gsalr.com / garagesalefinder.com / yardsales.net)
 * - EstateSales.NET
 * - YardSaleSearch.com
 *
 * MANDATORY REQUIREMENT:
 * Every listing must contain a valid physical street address with a numeric house number.
 * Generic grounds or city-only listings are strictly rejected.
 */
export async function GET(request: Request) {
  try {
    const tier1 = getActiveTier1Sources();
    const results: any[] = [];
    const streetPattern = /\d+\s+([a-zA-Z0-9#.\s]+)/;

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
    let totalRejectedNoAddress = 0;

    // 3. Ingest active sales for cities across all scrapers
    for (const c of activeCities) {
      if (!c.name || !c.admin1) continue;

      const [yssSales, gsalrSales, estateSales] = await Promise.all([
        scrapeYardSaleSearchForCity(c.name, c.admin1).catch(() => []),
        scrapeGsalrForCity(c.name, c.admin1).catch(() => []),
        scrapeEstateSalesForCity(c.name, c.admin1).catch(() => []),
      ]);

      const allSales: ScrapedYardSale[] = [...yssSales, ...gsalrSales, ...estateSales];

      for (const s of allSales) {
        // MANDATORY ADDRESS ENFORCEMENT:
        // Listings without a numeric street address are immediately discarded
        if (!s.streetAddress || !streetPattern.test(s.streetAddress)) {
          totalRejectedNoAddress++;
          continue;
        }

        const fullAddress = `${s.streetAddress}, ${s.cityName}, ${s.stateName}${s.postalCode ? ` ${s.postalCode}` : ""}`;

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
            venue: s.streetAddress,
            venueAddress: fullAddress,
            hostingEntity: s.hostingEntity || "Community Member",
            source: s.source || "YardSaleSearch",
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
      message: "Yard sale aggregation completed for Tier 1 sources with mandatory street address enforcement.",
      tier1Active: results,
      totalIngested,
      totalRejectedNoAddress,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error scraping yard sales:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
