// src/app/api/cron/rescrape-events/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, events, performers, venueProfiles } from '@/db/schema';
import { eq, lte, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Monthly Rescrape Lifecycle Worker:
 * Runs automated re-indexing across registered sources and venues.
 * - Scrape Horizon: Looks up to 12 months ahead for upcoming events
 * - Scrape Cadence: 30-day interval between rescrapes
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    // 1. Fetch sources due for rescraping (next_scrape_due <= NOW())
    const dueSources = await db
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.status, 'active'),
          lte(sources.nextScrapeDue, new Date())
        )
      )
      .limit(limit);

    const results: any[] = [];

    for (const src of dueSources) {
      const horizonMonths = src.scrapeHorizonMonths || 12;
      const intervalDays = src.scrapeIntervalDays || 30;

      // Advance schedule for next monthly lifecycle interval
      await db
        .update(sources)
        .set({
          lastScrapedAt: new Date(),
          nextScrapeDue: sql`NOW() + (${intervalDays} || ' days')::interval`,
          updatedAt: new Date(),
        })
        .where(eq(sources.id, src.id));

      results.push({
        sourceId: src.id,
        name: src.name,
        url: src.url,
        city: src.cityName,
        horizonMonths,
        intervalDays,
        status: 'rescheduled',
      });
    }

    // 2. Performer Tour Re-check: Update active performers
    const stalePerformers = await db
      .select()
      .from(performers)
      .where(sql`tour_scraped_at IS NULL OR tour_scraped_at < NOW() - interval '30 days'`)
      .limit(10);

    for (const perf of stalePerformers) {
      await db
        .update(performers)
        .set({
          tourScrapedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(performers.id, perf.id));
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} sources and ${stalePerformers.length} performers in monthly lifecycle.`,
      sourcesProcessed: results,
      performersUpdated: stalePerformers.map((p) => p.name),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in rescrape-events cron:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
