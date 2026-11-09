// src/lib/discovery/spider.ts
import { db } from "@/db";
import { entities, entityRelationships, appearances, sources } from "@/db/schema";
import { eq, and, sql, asc, or, isNull, lte } from "drizzle-orm";
import { recordRelationship } from "./lifecycle";
import { extractEventsFromUrl, ingestCrawledEvents, isValidCalendarSourceUrl } from "@/lib/events/crawl";

export interface SpiderResult {
  entitiesProcessed: number;
  sourcesProcessed: number;
  /** Entities skipped because they have no website on record ($0 rule: no paid web search). */
  entitiesWithoutWebsite: number;
  newEntitiesDiscovered: number;
  newEventsIngested: number;
  emailsIngested: number;
  /** publishEvent() outcomes across all crawls in this batch. */
  outcomes: Record<string, number>;
}

// resolveEntityWebsiteAndCalendar() (Gemini + Google Search Grounding) was removed:
// spiders run at $0 Google spend (GEMINI.md spider rule 1). Entities without a website are skipped;
// the spider-lifecycle engine logs such entities to `spider_lookup_needed` for the owner.

const isCrawlableUrl = (u?: string | null): u is string =>
  !!u && u.startsWith("http") && !/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(u);

function addOutcomes(into: Record<string, number>, from: Record<string, number>) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] || 0) + v;
}

/** Register sub-calendar URLs as new sources. Spawned sources never inherit a city/state. */
async function spawnSubSources(subUrls: string[], baseName: string, suffix: string) {
  const cleanBaseName = (baseName || "Discovered").replace(/(\s+(Sub-Event|Calendar Hub))+$/i, "").trim();
  for (const subUrl of subUrls) {
    if (!isValidCalendarSourceUrl(subUrl)) continue;
    await db
      .insert(sources)
      .values({
        url: subUrl,
        name: `${cleanBaseName} ${suffix}`,
        sourceType: "venue",
        cityName: null,
        stateName: null,
        scrapeIntervalDays: 30,
        scrapeHorizonMonths: 6,
        status: "active",
        nextScrapeDue: sql`NOW()`,
      })
      .onConflictDoNothing();
  }
}

/**
 * Universal Recursive Spider Engine:
 * Follows the recursive graph:
 * Entity (with a website on record) -> Crawl its calendar (URL only) -> publishEvent() each event ->
 * Extract Co-Entities (Performers, Venues, Hosts) -> Repeat.
 */
export async function runRecursiveSpider(batchSize: number = 10): Promise<SpiderResult> {
  const result: SpiderResult = {
    entitiesProcessed: 0,
    sourcesProcessed: 0,
    entitiesWithoutWebsite: 0,
    newEntitiesDiscovered: 0,
    newEventsIngested: 0,
    emailsIngested: 0,
    outcomes: {},
  };

  // 1. Fetch next batch of entities needing spidering (least recently updated first, business/cultural venues only)
  const candidateEntities = await db
    .select()
    .from(entities)
    .where(
      and(
        or(
          eq(entities.verificationStatus, "discovered"),
          eq(entities.verificationStatus, "verified"),
          isNull(entities.updatedAt)
        ),
        sql`TRIM(${entities.name}) !~ '^[0-9]+\\s+[A-Za-z]'`,
        sql`TRIM(${entities.name}) !~ '^#[0-9]+'`
      )
    )
    .orderBy(asc(entities.updatedAt))
    .limit(batchSize);

  for (const entity of candidateEntities) {
    result.entitiesProcessed++;
    const targetUrl = entity.websiteUrl;

    // 2. Active Web Crawl: Extract live events from the entity's own website/calendar (URL only)
    if (isCrawlableUrl(targetUrl)) {
      try {
        const crawl = await extractEventsFromUrl(targetUrl);
        if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
          const ingestStats = await ingestCrawledEvents(crawl.events, crawl.extractedEmails, {
            origin: "crawler",
            sourceUrl: targetUrl,
            entityId: entity.id,
          });
          result.newEventsIngested += ingestStats.ingested;
          result.newEntitiesDiscovered += ingestStats.newEntities;
          result.emailsIngested += ingestStats.emailsIngested;
          addOutcomes(result.outcomes, ingestStats.outcomes);
        }
        await spawnSubSources(crawl.subUrls, entity.name, "Calendar Hub");
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering entity ${entity.name}:`, err.message);
      }
    } else {
      result.entitiesWithoutWebsite++;
    }

    // 3. Connect co-entities via existing venue appearances
    const relatedVenues = await db
      .select({
        venueId: entityRelationships.targetEntityId,
      })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.sourceEntityId, entity.id),
          or(
            eq(entityRelationships.relationshipType, "serves_at"),
            eq(entityRelationships.relationshipType, "performs_at"),
            eq(entityRelationships.relationshipType, "located_at")
          )
        )
      )
      .limit(5);

    for (const rv of relatedVenues) {
      const [venue] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, rv.venueId))
        .limit(1);

      if (!venue) continue;

      const coAppearances = await db
        .select()
        .from(appearances)
        .where(eq(appearances.venueEntityId, venue.id))
        .limit(10);

      for (const coApp of coAppearances) {
        if (coApp.entityId !== entity.id) {
          const [coEntity] = await db
            .select()
            .from(entities)
            .where(eq(entities.id, coApp.entityId))
            .limit(1);

          if (coEntity) {
            const existingRel = await db
              .select()
              .from(entityRelationships)
              .where(
                and(
                  eq(entityRelationships.sourceEntityId, entity.id),
                  eq(entityRelationships.targetEntityId, coEntity.id)
                )
              )
              .limit(1);

            if (existingRel.length === 0) {
              await recordRelationship(
                entity.id,
                "co_located_with",
                coEntity.id,
                venue.websiteUrl || undefined,
                { venueName: venue.name, date: coApp.eventDate }
              );
              result.newEntitiesDiscovered++;
            }
          }
        }
      }
    }

    // (City auto-creation removed: cities are created only by resolveLocation() via publishEvent().)

    // 4. Update entity lifecycle timestamp & status
    await db
      .update(entities)
      .set({
        updatedAt: new Date(),
        verificationStatus: "verified",
      })
      .where(eq(entities.id, entity.id));
  }

  // 5. Spider pending high-priority sources due for crawl
  const dueSources = await db
    .select()
    .from(sources)
    .where(
      and(
        eq(sources.status, "active"),
        lte(sources.nextScrapeDue, new Date())
      )
    )
    .orderBy(
      sql`CASE WHEN ${sources.url} ILIKE '%ticketmaster%' OR ${sources.url} ILIKE '%seatgeek%' OR ${sources.url} ILIKE '%biletix%' THEN 1 ELSE 0 END ASC`,
      asc(sources.nextScrapeDue)
    )
    .limit(8);

  for (const src of dueSources) {
    result.sourcesProcessed++;
    if (src.url && src.url.startsWith("http")) {
      let retryNeeded = false;
      try {
        // URL only: the source row's city/state is never handed to the crawler.
        const crawl = await extractEventsFromUrl(src.url);
        if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
          const stats = await ingestCrawledEvents(crawl.events, crawl.extractedEmails, {
            origin: "crawler",
            sourceUrl: src.url,
          });
          retryNeeded = stats.retryNeeded;
          result.newEventsIngested += stats.ingested;
          result.newEntitiesDiscovered += stats.newEntities;
          result.emailsIngested += stats.emailsIngested;
          addOutcomes(result.outcomes, stats.outcomes);
        }

        // Register newly discovered sub-event URLs into sources
        await spawnSubSources(crawl.subUrls, src.name || "Discovered", "Sub-Event");
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering source ${src.name}:`, err.message);
      } finally {
        await db
          .update(sources)
          .set({
            lastScrapedAt: new Date(),
            nextScrapeDue: retryNeeded
              ? sql`NOW() + interval '1 hour'`
              : sql`NOW() + (${src.scrapeIntervalDays || 14} || ' days')::interval`,
            updatedAt: new Date(),
          })
          .where(eq(sources.id, src.id));
      }
    }
  }

  return result;
}
