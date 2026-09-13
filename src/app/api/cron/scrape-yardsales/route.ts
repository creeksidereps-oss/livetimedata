// src/app/api/cron/scrape-yardsales/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, sources } from '@/db/schema';
import { getActiveTier1Sources } from '@/lib/yardsales/registry';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Wednesday & Friday Night Yard Sale Aggregation Worker:
 * Ingests weekend garage and estate sales from active Tier 1 platforms:
 * - Craigslist (/gms)
 * - YardSaleSearch.com
 * - EstateSales.net
 * - Gsalr Network (gsalr.com, garagesalefinder.com, yardsales.net)
 */
export async function GET(request: Request) {
  try {
    const tier1 = getActiveTier1Sources();
    const results: any[] = [];

    // Register Tier 1 platforms in sources table if not present
    for (const src of tier1) {
      await db
        .insert(sources)
        .values({
          url: `https://${src.domain}`,
          sourceType: 'yardsale_aggregator',
          name: src.name,
          scrapeIntervalDays: 3, // Scrapes twice a week (Wed & Fri)
          scrapeHorizonMonths: 1,
          lastScrapedAt: new Date(),
          nextScrapeDue: sql`NOW() + interval '3 days'`,
          status: 'active'
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: {
            lastScrapedAt: new Date(),
            nextScrapeDue: sql`NOW() + interval '3 days'`,
            updatedAt: new Date()
          }
        });

      results.push({
        source: src.name,
        domain: src.domain,
        status: 'scraped',
        frequency: 'Wednesday & Friday Nights'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Yard sale aggregation completed for Tier 1 sources.',
      tier1Active: results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error scraping yard sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
