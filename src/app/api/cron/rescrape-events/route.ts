// src/app/api/cron/rescrape-events/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, performers } from '@/db/schema';
import { eq, lte, and, sql, asc } from 'drizzle-orm';
import { extractEventsFromUrl, ingestCrawledEvents, isValidCalendarSourceUrl } from '@/lib/events/crawl';

export const dynamic = 'force-dynamic';

/**
 * Rescrape Lifecycle Worker:
 * Actively crawls registered venue, hub, and ticketing sources due for scraping.
 * - Extracts live Schema.org JSON-LD and calendar event feeds (page-stated locations only)
 * - Every event goes through publishEvent() (dedup, location verification, publishing rules)
 * - Discovers co-entities and advances rescrape schedule
 * Sources' own city/state are never passed to the crawler; spawned sources get no city/state.
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
    let totalEntitiesDiscovered = 0;
    let totalEmailsIngested = 0;
    const totalOutcomes: Record<string, number> = {};

    for (const src of dueSources) {
      const intervalDays = src.scrapeIntervalDays || 14;
      let eventsIngested = 0;
      let emailsFound = 0;
      let retryNeeded = false;
      let outcomes: Record<string, number> = {};

      if (src.url && src.url.startsWith('http')) {
        try {
          // URL only: no parent-source location is handed to the crawler.
          const crawl = await extractEventsFromUrl(src.url);

          if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
            const stats = await ingestCrawledEvents(crawl.events, crawl.extractedEmails, {
              origin: 'rescrape',
              sourceUrl: src.url,
            });
            eventsIngested = stats.ingested;
            emailsFound = stats.emailsIngested;
            retryNeeded = stats.retryNeeded;
            outcomes = stats.outcomes;
            totalIngested += stats.ingested;
            totalEntitiesDiscovered += stats.newEntities;
            totalEmailsIngested += stats.emailsIngested;
            for (const [k, v] of Object.entries(stats.outcomes)) totalOutcomes[k] = (totalOutcomes[k] || 0) + v;
          }

          // Register newly discovered sub-event URLs into sources (no inherited city/state)
          for (const subUrl of crawl.subUrls) {
            if (!isValidCalendarSourceUrl(subUrl)) continue;
            const cleanBaseName = (src.name || 'Discovered').replace(/(\s+Sub-Event)+$/i, '').trim();
            await db
              .insert(sources)
              .values({
                url: subUrl,
                name: `${cleanBaseName} Calendar Hub`,
                sourceType: 'venue',
                cityName: null,
                stateName: null,
                scrapeIntervalDays: 30,
                scrapeHorizonMonths: 12,
                status: 'active',
                nextScrapeDue: sql`NOW()`,
              })
              .onConflictDoNothing();
          }
        } catch (crawlErr: any) {
          console.error(`[RESCRAPE] Error scraping source ${src.id} (${src.url}):`, crawlErr.message);
        }
      }

      // Advance schedule for next lifecycle interval (geocoder unavailable => retry in 1 hour)
      await db
        .update(sources)
        .set({
          lastScrapedAt: new Date(),
          nextScrapeDue: retryNeeded ? sql`NOW() + interval '1 hour'` : sql`NOW() + (${intervalDays} || ' days')::interval`,
          updatedAt: new Date(),
        })
        .where(eq(sources.id, src.id));

      results.push({
        sourceId: src.id,
        name: src.name,
        url: src.url,
        eventsIngested,
        emailsFound,
        outcomes,
        status: retryNeeded ? 'retry_geocoder_unavailable' : 'scraped',
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
      message: `Rescraped ${results.length} sources: ${totalIngested} new events stored, ${totalEmailsIngested} emails extracted, ${totalEntitiesDiscovered} entities discovered.`,
      stats: {
        sourcesProcessed: results.length,
        eventsIngested: totalIngested,
        outcomes: totalOutcomes,
        emailsIngested: totalEmailsIngested,
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
