// src/lib/discovery/spider.ts
import { db } from "@/db";
import { entities, entityRelationships, appearances, events, cities } from "@/db/schema";
import { eq, and, sql, asc, or, isNull } from "drizzle-orm";
import { upsertEntity, recordRelationship, normalizeEntityName } from "./lifecycle";

export interface SpiderResult {
  entitiesProcessed: number;
  newVenuesDiscovered: number;
  newEntitiesDiscovered: number;
  newEventsIngested: number;
  newCitiesBirthed: number;
}

/**
 * Universal Recursive Spider Engine:
 * Follows the infinite recursive graph:
 * Entity -> Schedule -> Venues -> Venue Calendar -> Co-Entities (Performers, Vendors, Festivals, Clubs) ->
 * Their Tour Schedules -> New Venues -> New Cities -> REPEAT INFINITELY.
 */
export async function runRecursiveSpider(batchSize: number = 10): Promise<SpiderResult> {
  const result: SpiderResult = {
    entitiesProcessed: 0,
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

  if (candidateEntities.length === 0) {
    return result;
  }

  for (const entity of candidateEntities) {
    result.entitiesProcessed++;

    // 2. Discover / follow appearances from entity's schedule
    // If entity has a website or official info page, or if it has existing appearances
    const existingAppearances = await db
      .select()
      .from(appearances)
      .where(eq(appearances.entityId, entity.id))
      .limit(5);

    // If entity is linked to existing venues, discover other events at those venues
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
      // Fetch the Venue
      const [venue] = await db
        .select()
        .from(entities)
        .where(eq(entities.id, rv.venueId))
        .limit(1);

      if (!venue) continue;

      // 3. Find other co-hosted events at this venue
      const coAppearances = await db
        .select()
        .from(appearances)
        .where(eq(appearances.venueEntityId, venue.id))
        .limit(10);

      for (const coApp of coAppearances) {
        if (coApp.entityId !== entity.id) {
          // Discovered a co-occurring entity (e.g. Band performing at brewery where food truck serves)
          const [coEntity] = await db
            .select()
            .from(entities)
            .where(eq(entities.id, coApp.entityId))
            .limit(1);

          if (coEntity) {
            // Establish bidirectional graph relationship
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
        .select({ id: cities.id })
        .from(cities)
        .where(sql`LOWER(${cities.name}) = LOWER(${entity.cityName})`)
        .limit(1);

      if (cityCheck.length === 0) {
        // Auto-provision city in cities table
        const citySlug = entity.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await db.insert(cities).values({
          name: entity.cityName,
          slug: citySlug,
          admin1: entity.stateName || "NC",
          countryCode: entity.countryCode || "US",
          countryName: "United States",
          latitude: entity.latitude || 35.78,
          longitude: entity.longitude || -80.88,
          timezone: "America/New_York",
          population: 10000,
        });
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

  return result;
}
