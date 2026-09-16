// src/lib/discovery/spider.ts
import { db } from "@/db";
import { entities, entityRelationships, appearances, cities, sources } from "@/db/schema";
import { eq, and, sql, asc, or, isNull, lte } from "drizzle-orm";
import { recordRelationship } from "./lifecycle";
import { extractEventsFromUrl, ingestDiscoveredEvents } from "./calendar-crawler";

export interface SpiderResult {
  entitiesProcessed: number;
  sourcesProcessed: number;
  newVenuesDiscovered: number;
  newEntitiesDiscovered: number;
  newEventsIngested: number;
  newCitiesBirthed: number;
}

/**
 * Universal Recursive Spider Engine:
 * Follows the infinite recursive graph:
 * Entity -> Live Calendar URL -> Extract Events -> Ingest & Deduplicate ->
 * Venues -> Venue Calendars -> Co-Entities (Performers, Vendors, Festivals) ->
 * New Cities -> REPEAT INFINITELY.
 */
export async function runRecursiveSpider(batchSize: number = 10): Promise<SpiderResult> {
  const result: SpiderResult = {
    entitiesProcessed: 0,
    sourcesProcessed: 0,
    newVenuesDiscovered: 0,
    newEntitiesDiscovered: 0,
    newEventsIngested: 0,
    newCitiesBirthed: 0,
  };

  // 1. Fetch next batch of entities needing spidering (least recently updated first)
  const candidateEntities = await db
    .select()
    .from(entities)
    .where(
      or(
        eq(entities.verificationStatus, "discovered"),
        eq(entities.verificationStatus, "verified"),
        isNull(entities.updatedAt)
      )
    )
    .orderBy(asc(entities.updatedAt))
    .limit(batchSize);

  for (const entity of candidateEntities) {
    result.entitiesProcessed++;

    // 2. Active Web Crawl: If entity has a website/calendar, extract live events
    if (
      entity.websiteUrl &&
      entity.websiteUrl.startsWith("http") &&
      !entity.websiteUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i)
    ) {
      try {
        const crawl = await extractEventsFromUrl(
          entity.websiteUrl,
          entity.cityName || "Statesville",
          entity.stateName || "NC"
        );

        if (crawl.events.length > 0) {
          const ingestStats = await ingestDiscoveredEvents(crawl.events);
          result.newEventsIngested += ingestStats.ingested;
          result.newCitiesBirthed += ingestStats.birthedCities;
          result.newEntitiesDiscovered += ingestStats.newEntities;
        }

        // Register any discovered sub-calendar URLs into sources for future sweeps
        for (const subUrl of crawl.subUrls) {
          await db
            .insert(sources)
            .values({
              url: subUrl,
              name: `${entity.name} Sub-Event`,
              sourceType: "venue",
              cityName: entity.cityName,
              stateName: entity.stateName || "NC",
              scrapeIntervalDays: 14,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW() + interval '3 days'`,
            })
            .onConflictDoNothing();
        }
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering entity ${entity.name}:`, err.message);
      }
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

    // 4. Ensure city is registered in cities table
    if (entity.cityName) {
      const cityCheck = await db
        .select({ slug: cities.slug })
        .from(cities)
        .where(sql`LOWER(${cities.name}) = LOWER(${entity.cityName})`)
        .limit(1);

      if (cityCheck.length === 0) {
        const citySlug = entity.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await db
          .insert(cities)
          .values({
            name: entity.cityName,
            slug: citySlug,
            admin1: entity.stateName || "NC",
            countryCode: entity.countryCode || "US",
            countryName: "United States",
            latitude: entity.latitude || 35.78,
            longitude: entity.longitude || -80.88,
            timezone: "America/New_York",
            population: 10000,
          })
          .onConflictDoNothing();
        result.newCitiesBirthed++;
      }
    }

    // 5. Update entity lifecycle timestamp & status
    await db
      .update(entities)
      .set({
        updatedAt: new Date(),
        verificationStatus: "verified",
      })
      .where(eq(entities.id, entity.id));
  }

  // 6. Spider pending high-priority sources due for crawl (prioritizing open calendar sources)
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
      try {
        const crawl = await extractEventsFromUrl(
          src.url,
          src.cityName || "Statesville",
          src.stateName || "NC"
        );

        if (crawl.events.length > 0) {
          const stats = await ingestDiscoveredEvents(crawl.events);
          result.newEventsIngested += stats.ingested;
          result.newCitiesBirthed += stats.birthedCities;
          result.newEntitiesDiscovered += stats.newEntities;
        }

        // Register newly discovered sub-event URLs into sources
        for (const subUrl of crawl.subUrls) {
          await db
            .insert(sources)
            .values({
              url: subUrl,
              name: `${src.name || 'Discovered'} Sub-Event`,
              sourceType: "venue",
              cityName: src.cityName,
              stateName: src.stateName || "NC",
              scrapeIntervalDays: 14,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW() + interval '3 days'`,
            })
            .onConflictDoNothing();
        }
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering source ${src.name}:`, err.message);
      } finally {
        // Always advance next scrape due date so failing sources don't bottleneck the spider
        await db
          .update(sources)
          .set({
            lastScrapedAt: new Date(),
            nextScrapeDue: sql`NOW() + (${src.scrapeIntervalDays || 14} || ' days')::interval`,
            updatedAt: new Date(),
          })
          .where(eq(sources.id, src.id));
      }
    }
  }

  return result;
}
