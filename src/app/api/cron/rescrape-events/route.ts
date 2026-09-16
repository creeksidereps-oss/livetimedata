// src/app/api/cron/rescrape-events/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, performers } from '@/db/schema';
import { eq, lte, and, sql, asc } from 'drizzle-orm';
import { extractEventsFromUrl, ingestDiscoveredEvents } from '@/lib/discovery/calendar-crawler';

export const dynamic = 'force-dynamic';

/**
 * Rescrape Lifecycle Worker:
 * Actively crawls registered venue, hub, and ticketing sources due for scraping.
 * - Extracts live Schema.org JSON-LD and calendar event feeds
 * - Deduplicates and ingests events directly into database
 * - Discovers co-entities, auto-provisions cities, and advances rescrape schedule
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
      .orderBy(asc(sources.nextScrapeDue))
      .limit(limit);

    const results: any[] = [];
    let totalIngested = 0;
    let totalSkipped = 0;
    let totalCitiesBirthed = 0;
    let totalEntitiesDiscovered = 0;
    let totalEmailsIngested = 0;

    for (const src of dueSources) {
      const intervalDays = src.scrapeIntervalDays || 14;
      let eventsIngested = 0;
      let emailsFound = 0;

      if (src.url && src.url.startsWith('http')) {
        try {
          const crawl = await extractEventsFromUrl(
            src.url,
            src.cityName || 'Statesville',
            src.stateName || 'NC'
          );

          if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
            const stats = await ingestDiscoveredEvents(
              crawl.events,
              crawl.extractedEmails,
              {
                cityName: src.cityName,
                stateName: src.stateName,
                sourceUrl: src.url,
                venueName: src.name,
              }
            );
            eventsIngested = stats.ingested;
            emailsFound = stats.emailsIngested;
            totalIngested += stats.ingested;
            totalSkipped += stats.skipped;
            totalCitiesBirthed += stats.birthedCities;
            totalEntitiesDiscovered += stats.newEntities;
            totalEmailsIngested += stats.emailsIngested;
          }

          // Register newly discovered sub-event URLs into sources
          for (const subUrl of crawl.subUrls) {
            await db
              .insert(sources)
              .values({
                url: subUrl,
                name: `${src.name || 'Discovered'} Sub-Event`,
                sourceType: 'venue',
                cityName: src.cityName,
                stateName: src.stateName || 'NC',
                scrapeIntervalDays: 14,
                scrapeHorizonMonths: 6,
                status: 'active',
                nextScrapeDue: sql`NOW() + interval '3 days'`,
              })
              .onConflictDoNothing();
          }
        } catch (crawlErr: any) {
          console.error(`[RESCRAPE] Error scraping source ${src.id} (${src.url}):`, crawlErr.message);
        }
      }

      // Advance schedule for next lifecycle interval
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
        eventsIngested,
        emailsFound,
        status: 'scraped',
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
      message: `Rescraped ${results.length} sources: ${totalIngested} new events ingested, ${totalEmailsIngested} emails extracted, ${totalCitiesBirthed} cities birthed, ${totalEntitiesDiscovered} entities discovered.`,
      stats: {
        sourcesProcessed: results.length,
        eventsIngested: totalIngested,
        eventsSkipped: totalSkipped,
        emailsIngested: totalEmailsIngested,
        citiesBirthed: totalCitiesBirthed,
        entitiesDiscovered: totalEntitiesDiscovered,
      },
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
