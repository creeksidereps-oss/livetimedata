// src/lib/discovery/spider.ts
import { db } from "@/db";
import { entities, entityRelationships, appearances, cities, sources } from "@/db/schema";
import { eq, and, sql, asc, or, isNull, lte } from "drizzle-orm";
import { recordRelationship } from "./lifecycle";
import { extractEventsFromUrl, ingestDiscoveredEvents } from "./calendar-crawler";
import { GoogleGenAI } from "@google/genai";

export interface SpiderResult {
  entitiesProcessed: number;
  sourcesProcessed: number;
  entitiesWebSearched: number;
  newVenuesDiscovered: number;
  newEntitiesDiscovered: number;
  newEventsIngested: number;
  newCitiesBirthed: number;
  emailsIngested: number;
}

/**
 * Autonomous Web Search: When an entity (venue, artist, brewery, food truck)
 * enters the graph WITHOUT a website or calendar URL, the spider searches the open
 * web using Google Search grounding to discover its official website and calendar!
 */
export async function resolveEntityWebsiteAndCalendar(
  name: string,
  entityType: string,
  cityName?: string | null,
  stateName?: string | null
): Promise<{ officialWebsite?: string; calendarUrl?: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const locationStr = [cityName, stateName].filter(Boolean).join(", ");
    const prompt = `
      Search Google to find the official website and the events/calendar/tour page for this entity:
      Name: ${name}
      Type: ${entityType}
      ${locationStr ? `Location: ${locationStr}` : ""}

      Return ONLY a JSON object with:
      {
        "officialWebsite": "https://...",
        "calendarUrl": "https://..."
      }
      Do not use markdown formatting or backticks.
    `;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    if (!res.text) return null;
    const clean = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(clean);
    return {
      officialWebsite: data.officialWebsite?.startsWith("http")
        ? data.officialWebsite
        : undefined,
      calendarUrl: data.calendarUrl?.startsWith("http")
        ? data.calendarUrl
        : undefined,
    };
  } catch (err: any) {
    console.error(
      `[SPIDER_SEARCH] Error searching web for entity ${name}:`,
      err.message
    );
    return null;
  }
}

/**
 * Universal Recursive Spider Engine:
 * Follows the infinite recursive graph:
 * Entity (without website) -> Search Google Web for Official Calendar ->
 * Update Entity -> Add to Sources -> Crawl Calendar -> Ingest Events ->
 * Extract Co-Entities (Performers, Venues, Hosts) -> Repeat Forever!
 */
export async function runRecursiveSpider(batchSize: number = 10): Promise<SpiderResult> {
  const result: SpiderResult = {
    entitiesProcessed: 0,
    sourcesProcessed: 0,
    entitiesWebSearched: 0,
    newVenuesDiscovered: 0,
    newEntitiesDiscovered: 0,
    newEventsIngested: 0,
    newCitiesBirthed: 0,
    emailsIngested: 0,
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

  let searchBudget = 3; // Limit live AI web searches per batch to keep execution fast

  for (const entity of candidateEntities) {
    result.entitiesProcessed++;

    let targetUrl: string | null = entity.websiteUrl;
    const isMissingOrImage =
      !targetUrl ||
      !targetUrl.startsWith("http") ||
      Boolean(targetUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i));

    // 2. Proactive Web Search: If entity lacks a website/calendar, search Google for it!
    if (isMissingOrImage && searchBudget > 0) {
      searchBudget--;
      result.entitiesWebSearched++;
      console.log(
        `[SPIDER_SEARCH] Searching web for official calendar of: ${entity.name} (${entity.entityType}) in ${entity.cityName || "NC"}`
      );

      const found = await resolveEntityWebsiteAndCalendar(
        entity.name,
        entity.entityType,
        entity.cityName,
        entity.stateName
      );

      if (found?.calendarUrl || found?.officialWebsite) {
        targetUrl = found.calendarUrl || found.officialWebsite || null;

        // Persist discovered website into the entity record
        await db
          .update(entities)
          .set({ websiteUrl: targetUrl || null })
          .where(eq(entities.id, entity.id));

        // Queue newly found calendar into sources for perpetual tracking
        await db
          .insert(sources)
          .values({
            url: targetUrl!,
            name: `${entity.name} Official Calendar`,
            sourceType: entity.entityType === "performer" ? "artist_tour" : "venue",
            cityName: entity.cityName,
            stateName: entity.stateName || "NC",
            scrapeIntervalDays: entity.entityType === "performer" ? 30 : 14,
            scrapeHorizonMonths: entity.entityType === "performer" ? 12 : 6,
            status: "active",
            nextScrapeDue: sql`NOW()`,
          })
          .onConflictDoNothing();
      }
    }

    // 3. Active Web Crawl: Extract live events from the entity's calendar
    if (
      targetUrl &&
      targetUrl.startsWith("http") &&
      !targetUrl.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i)
    ) {
      try {
        const crawl = await extractEventsFromUrl(
          targetUrl,
          entity.cityName || "Statesville",
          entity.stateName || "NC"
        );

        if (crawl.events.length > 0 || crawl.extractedEmails.length > 0) {
          const ingestStats = await ingestDiscoveredEvents(
            crawl.events,
            crawl.extractedEmails,
            {
              cityName: entity.cityName,
              stateName: entity.stateName,
              sourceUrl: targetUrl,
              venueName: entity.name,
              entityId: entity.id,
            }
          );
          result.newEventsIngested += ingestStats.ingested;
          result.newCitiesBirthed += ingestStats.birthedCities;
          result.newEntitiesDiscovered += ingestStats.newEntities;
          result.emailsIngested += ingestStats.emailsIngested;
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
              scrapeIntervalDays: 30,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW()`,
            })
            .onConflictDoNothing();
        }
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering entity ${entity.name}:`, err.message);
      }
    }

    // 4. Connect co-entities via existing venue appearances
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

    // 5. Ensure city is registered in cities table
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
            countryCode: "US",
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

    // 6. Update entity lifecycle timestamp & status
    await db
      .update(entities)
      .set({
        updatedAt: new Date(),
        verificationStatus: "verified",
      })
      .where(eq(entities.id, entity.id));
  }

  // 7. Spider pending high-priority sources due for crawl
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
          result.newEventsIngested += stats.ingested;
          result.newCitiesBirthed += stats.birthedCities;
          result.newEntitiesDiscovered += stats.newEntities;
          result.emailsIngested += stats.emailsIngested;
        }

        // Register newly discovered sub-event URLs into sources
        for (const subUrl of crawl.subUrls) {
          await db
            .insert(sources)
            .values({
              url: subUrl,
              name: `${src.name || "Discovered"} Sub-Event`,
              sourceType: "venue",
              cityName: src.cityName,
              stateName: src.stateName || "NC",
              scrapeIntervalDays: 30,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW()`,
            })
            .onConflictDoNothing();
        }
      } catch (err: any) {
        console.error(`[SPIDER] Error spidering source ${src.name}:`, err.message);
      } finally {
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
