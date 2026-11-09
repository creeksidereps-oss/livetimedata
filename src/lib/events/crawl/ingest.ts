// src/lib/events/crawl/ingest.ts
//
// ingestCrawledEvents(): hand every crawled event to publishEvent() — the only writer of `events` —
// then record the graph (venue / performer / organizer entities, relationships, appearances, spawned
// sources) and contact emails.
//
// Location rules:
//   - publishEvent() receives ONLY the location the source page stated (ev.city/region/country/address/lat/lon).
//   - Entities get a city ONLY from publishEvent's verified location for that event (never inherited from the
//     parent source). No verified location => entity has no city.
//   - Spawned sources are stored with city_name / state_name NULL.
//   - No city rows are created here (resolveLocation() owns cities).

import { db } from "@/db";
import { appearances, emailContacts, entities, performers, sources } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { publishEvent, type IntakeOrigin, type IntakeOutcome } from "@/lib/events/intake/publishEvent";
import type { VerifiedLocation } from "@/lib/events/location/resolveLocation";
import { recordRelationship, upsertEntity } from "@/lib/discovery/lifecycle";
import type { ExtractedEvent } from "./types";
import { isTicketBrokerUrl, isValidCalendarSourceUrl } from "./helpers";

export type CrawlOrigin = Extract<IntakeOrigin, "crawler" | "rescrape" | "spider_daemon" | "discover_entity">;

export interface IngestContext {
  origin: CrawlOrigin;
  /** URL of the source page that was crawled (used only for logging / email provenance, never for location). */
  sourceUrl: string;
  /** Entity that owns the crawled source, if any (emails are linked to it). */
  entityId?: number | null;
}

export interface IngestStats {
  outcomes: Record<IntakeOutcome | "error", number>;
  /** Convenience: published + pending_review (new rows written). */
  ingested: number;
  newEntities: number;
  sourcesSpawned: number;
  emailsIngested: number;
  /** True if any event came back `retry` (geocoder unavailable): leave the source due for a retry. */
  retryNeeded: boolean;
  reasons: Record<string, number>;
}

function entityLocation(loc?: VerifiedLocation): { cityName?: string; stateName?: string; countryCode?: string } {
  if (!loc) return {};
  return { cityName: loc.cityName, stateName: loc.admin1 || undefined, countryCode: loc.countryCode };
}

async function spawnSource(url: string | undefined, name: string, sourceType: string, horizonMonths: number): Promise<number> {
  if (!url || !url.startsWith("http") || !isValidCalendarSourceUrl(url)) return 0;
  const r = await db
    .insert(sources)
    .values({
      url,
      name,
      sourceType,
      cityName: null,
      stateName: null,
      scrapeIntervalDays: 30,
      scrapeHorizonMonths: horizonMonths,
      status: "active",
      nextScrapeDue: sql`NOW()`,
    })
    .onConflictDoNothing()
    .returning({ id: sources.id });
  return r.length;
}

export async function ingestCrawledEvents(
  extracted: ExtractedEvent[],
  extractedEmails: string[],
  ctx: IngestContext
): Promise<IngestStats> {
  const stats: IngestStats = {
    outcomes: { published: 0, pending_review: 0, rejected: 0, duplicate: 0, retry: 0, error: 0 },
    ingested: 0,
    newEntities: 0,
    sourcesSpawned: 0,
    emailsIngested: 0,
    retryNeeded: false,
    reasons: {},
  };
  let lastVenueEntityId: number | undefined = ctx.entityId || undefined;
  const verifiedCities = new Map<string, VerifiedLocation>();

  for (const ev of extracted) {
    try {
      // Ticket brokers are never used as the official link; the event's source page is.
      const officialInfoUrl = isTicketBrokerUrl(ev.officialInfoUrl) ? ev.sourceUrl : ev.officialInfoUrl;

      const result = await publishEvent({
        origin: ctx.origin,
        title: ev.title,
        details: ev.details,
        category: ev.category,
        venue: ev.venue,
        venueAddress: ev.address || null,
        startTime: ev.startTime,
        eventDate: ev.eventDate,
        location: {
          city: ev.city ?? null,
          region: ev.region ?? null,
          country: ev.country ?? null,
          address: ev.address ?? null,
          lat: ev.lat ?? null,
          lon: ev.lon ?? null,
          sourceUrl: ev.sourceUrl,
        },
        source: ev.sourceUrl,
        sourceUrl: ev.sourceUrl,
        hostingEntity: ev.organizerName || null,
        officialInfoUrl: officialInfoUrl || null,
        eventFlyerUrl: ev.eventFlyerUrl || null,
        contactPhone: ev.contactPhone || null,
        contactEmail: ev.contactEmail || null,
      });

      stats.outcomes[result.outcome]++;
      for (const r of result.reasons) stats.reasons[r] = (stats.reasons[r] || 0) + 1;
      if (result.outcome === "retry") stats.retryNeeded = true;
      if (result.outcome === "published" || result.outcome === "pending_review") stats.ingested++;
      if (result.location) verifiedCities.set(result.location.citySlug, result.location);

      // Graph recording only for events that are real and stored (new or existing duplicate).
      if (result.outcome === "rejected" || result.outcome === "retry") continue;
      const loc = entityLocation(result.location);
      const eventId = result.id ?? null;

      // Venue entity
      let venueEntityId: number | undefined;
      if (ev.venue) {
        venueEntityId = await upsertEntity({ name: ev.venue, entityType: "venue", websiteUrl: ev.venueUrl, ...loc });
        stats.newEntities++;
        lastVenueEntityId = venueEntityId;
        stats.sourcesSpawned += await spawnSource(ev.venueUrl, ev.venue, "venue", 6);
      }

      // Performer entity
      if (ev.performerName) {
        const perfId = await upsertEntity({ name: ev.performerName, entityType: "performer", websiteUrl: ev.performerUrl, ...loc });
        stats.newEntities++;
        await db
          .insert(performers)
          .values({ name: ev.performerName, type: "band", tourPageUrl: ev.performerUrl || null, officialSite: ev.performerUrl || null })
          .onConflictDoUpdate({
            target: performers.name,
            set: { tourPageUrl: ev.performerUrl || undefined, officialSite: ev.performerUrl || undefined, updatedAt: new Date() },
          });
        stats.sourcesSpawned += await spawnSource(ev.performerUrl, `${ev.performerName} Tour`, "artist_tour", 12);
        if (venueEntityId) {
          await recordRelationship(perfId, "performs_at", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
        }
        await db
          .insert(appearances)
          .values({
            entityId: perfId,
            venueEntityId: venueEntityId || null,
            eventId,
            eventDate: new Date(`${ev.eventDate}T12:00:00Z`),
            startTime: ev.startTime || null,
            sourceUrl: officialInfoUrl || ev.sourceUrl,
            status: "published",
          })
          .onConflictDoNothing();
      }

      // Organizer entity
      if (ev.organizerName && ev.organizerName !== ev.venue) {
        const orgId = await upsertEntity({ name: ev.organizerName, entityType: "organization", websiteUrl: ev.organizerUrl, ...loc });
        stats.newEntities++;
        if (venueEntityId) {
          await recordRelationship(orgId, "organized_by", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
        }
        stats.sourcesSpawned += await spawnSource(ev.organizerUrl, ev.organizerName, "organizer", 6);
      }

      // Food truck appearances link the mobile vendor to the venue
      if (ev.category === "Food Trucks" && venueEntityId) {
        const vendorId = await upsertEntity({ name: ev.title.split(" at ")[0] || ev.title, entityType: "mobile_food_vendor", subtype: "food_truck", ...loc });
        stats.newEntities++;
        await recordRelationship(vendorId, "serves_at", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
      }
    } catch (err: any) {
      stats.outcomes.error++;
      console.error(`[CRAWL_INGEST_ERROR] ${ev.title}: ${err?.message || err}`);
    }
  }

  // Contact emails. A city is attached only when every verified event on this page resolved to ONE city.
  if (extractedEmails.length) {
    const only = verifiedCities.size === 1 ? [...verifiedCities.values()][0] : undefined;
    const targetEntityId = ctx.entityId || lastVenueEntityId;
    for (const email of extractedEmails) {
      try {
        const r = await db
          .insert(emailContacts)
          .values({
            email,
            category: "Venues & Organizers",
            cityName: only?.cityName ?? null,
            stateName: only?.admin1 ?? null,
            countryCode: only?.countryCode ?? null,
            status: "active",
            source: ctx.sourceUrl,
            metadata: { sourceUrl: ctx.sourceUrl, discoveredAt: new Date().toISOString() },
          })
          .onConflictDoNothing()
          .returning({ id: emailContacts.id });
        stats.emailsIngested += r.length;
      } catch { /* duplicate / constraint */ }
      if (targetEntityId) {
        try {
          await db.update(entities).set({ email, updatedAt: new Date() }).where(and(eq(entities.id, targetEntityId), isNull(entities.email)));
        } catch { /* ignore */ }
      }
    }
  }

  return stats;
}
