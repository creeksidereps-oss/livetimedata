// src/app/api/cron/scrape-yardsales/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, sources, cities } from "@/db/schema";
import { getActiveTier1Sources } from "@/lib/yardsales/registry";
import {
  scrapeYardSaleSearchForCity,
  scrapeGsalrForCity,
  scrapeEstateSalesForCity,
  scrapeStorageTreasuresLiveAuctions,
  ScrapedYardSale,
} from "@/lib/yardsales/scraper";
import { sql, eq, and, or, isNotNull, isNull, ne, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Wednesday & Friday Night Yard Sale & Live Auction Aggregation Worker:
 * Ingests weekend garage and estate sales from active Tier 1 platforms:
 * - Gsalr Network (gsalr.com / garagesalefinder.com / yardsales.net)
 * - EstateSales.NET
 * - YardSaleSearch.com
 * - StorageTreasures Live In-Person Auctions (Physical unit lien sales)
 *
 * MANDATORY REQUIREMENT:
 * Every listing must contain a valid physical street address with a numeric house number.
 * Online auctions, virtual sales, and city-only listings are strictly rejected.
 * Residential and auction addresses go into the public event calendar ONLY (never into entities/venues).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetCity = url.searchParams.get("city");
    const targetState = url.searchParams.get("state");
    const limitParam = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);
    const offsetParam = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const includeAuctions = url.searchParams.get("auctions") !== "false";

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

    let totalIngested = 0;
    let totalAuctionsIngested = 0;
    let totalRejectedNoAddress = 0;

    // 2. Nationwide In-Person Storage Auctions (StorageTreasures)
    // Only live on-site auctions with physical addresses are processed
    if (includeAuctions) {
      const storageAuctions = await scrapeStorageTreasuresLiveAuctions().catch(() => []);
      for (const s of storageAuctions) {
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
            hostingEntity: s.hostingEntity || "Storage Facility",
            source: s.source || "StorageTreasures",
            startTime: s.startTime || "10:00 AM",
            eventDate: new Date(s.startDate + "T12:00:00Z"),
            details: s.description,
            officialInfoUrl: s.url,
            status: "live",
          });
          totalAuctionsIngested++;
        }
      }
    }

    // 3. Fetch target cities to scrape for Yard / Estate Sales
    let activeCities: { name: string; admin1: string | null }[] = [];

    if (targetCity) {
      // On-demand single city scrape
      activeCities = [{ name: targetCity, admin1: targetState || "" }];
    } else {
      // Prioritize top populated US cities first with offset support for multi-batch rotation
      activeCities = await db
        .select({ name: cities.name, admin1: cities.admin1 })
        .from(cities)
        .where(
          and(
            or(eq(cities.countryCode, "US"), isNull(cities.countryCode)),
            isNotNull(cities.admin1),
            ne(cities.admin1, ""),
            sql`${cities.name} !~ '^[0-9]+'`
          )
        )
        .orderBy(desc(cities.population), asc(cities.name))
        .offset(offsetParam)
        .limit(limitParam);
    }

    // 4. Ingest active yard/estate sales for cities across all scrapers
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
            startTime: s.startTime || "8:00 AM",
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
      message: "Yard sale & live auction aggregation completed with mandatory street address enforcement.",
      tier1Active: results,
      citiesProcessed: activeCities.length,
      batchOffset: offsetParam,
      totalYardEstateSalesIngested: totalIngested,
      totalLiveAuctionsIngested: totalAuctionsIngested,
      totalRejectedNoAddress,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error scraping yard sales & auctions:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
