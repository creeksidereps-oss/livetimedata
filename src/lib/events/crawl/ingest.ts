// src/lib/events/crawl/ingest.ts
//
// ingestCrawledEvents(): hand every crawled event to publishEvent() — the only writer of `events` —
// then record the graph (venue / performer / organizer entities, relationships, appearances, spawned
// sources) and contact emails.
//
// Location rules:
//   - publishEvent() receives ONLY the location the source page stated (ev.city/region/country/address/lat/lon),
//     or the venue's own stated address on its own site (ev.locationProvenance = 'venue_site', owner decision
//     2026-11-10). It is still verified by resolveLocation() inside publishEvent().
//   - Entities get a city ONLY from publishEvent's verified location for that event (never inherited from the
//     parent source). No verified location => entity has no city.
//   - Spawned sources are stored with city_name / state_name NULL.
//   - No city rows are created here (resolveLocation() owns cities).
//
// Cascade (spider repair 2026-11-10): venues / performers / organizers are recorded and spawned whatever the
// event's publish outcome was. A rejected event (e.g. no verified location) still names a real venue, and that
// venue still gets its own spider. An entity whose URL is already a source is not spawned again (job done).

import { db } from "@/db";
import { pool } from "@/lib/db";
import { appearances, emailContacts, entities, performers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { publishEvent, type IntakeOrigin, type IntakeOutcome } from "@/lib/events/intake/publishEvent";
import type { VerifiedLocation } from "@/lib/events/location/resolveLocation";
import { recordRelationship, upsertEntity } from "@/lib/discovery/lifecycle";
import type { ExtractedEvent, FoundEntity } from "./types";
import { isTicketBrokerUrl, isValidCalendarSourceUrl } from "./helpers";
import { canonicalUrl, pagingInfo } from "./discover";

export type CrawlOrigin = Extract<IntakeOrigin, "crawler" | "rescrape" | "spider_daemon" | "discover_entity">;

export interface IngestContext {
  origin: CrawlOrigin;
  /** URL of the source page that was crawled (used only for logging / email provenance, never for location). */
  sourceUrl: string;
  /** Entity that owns the crawled source, if any (emails are linked to it). */
  entityId?: number | null;
  /** Lineage of spawned sources (visibility only; nothing is pruned by depth). */
  parentSourceId?: number | null;
  rootSourceId?: number | null;
  depth?: number | null;
  /** Entities the page names outside of event records (e.g. the site's own venue pages). */
  entities?: FoundEntity[];
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
  /** Outcomes per handler (strategy, plus ':venue_site' when the venue's own address was used). */
  handlerOutcomes: Record<string, Record<string, number>>;
}

function entityLocation(loc?: VerifiedLocation): { cityName?: string; stateName?: string; countryCode?: string } {
  if (!loc) return {};
  return { cityName: loc.cityName, stateName: loc.admin1 || undefined, countryCode: loc.countryCode };
}

/** Register a real URL found on a page as a new source (due immediately, discovery phase). Returns 1 if new. */
export async function spawnSource(
  rawUrl: string | undefined,
  name: string,
  sourceType: string,
  horizonMonths: number,
  ctx: Pick<IngestContext, "parentSourceId" | "rootSourceId" | "depth">
): Promise<number> {
  if (!rawUrl || !rawUrl.startsWith("http") || isTicketBrokerUrl(rawUrl)) return 0;
  const url = canonicalUrl(rawUrl);
  if (!url || !isValidCalendarSourceUrl(url)) return 0;
  // Page / date variants of a calendar are never separate sources (and past months are never followed).
  if (pagingInfo(url).paged) return 0;
  const r = await pool.query(
    `INSERT INTO sources (url, name, source_type, city_name, state_name, status, scrape_interval_days, scrape_horizon_months,
                          next_scrape_due, phase, parent_source_id, root_source_id, depth, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, NULL, 'active', 30, $4, NOW(), 'discovery', $5, $6, $7, NOW(), NOW())
     ON CONFLICT (url) DO NOTHING`,
    [url, name.slice(0, 200), sourceType, horizonMonths, ctx.parentSourceId ?? null, ctx.rootSourceId ?? ctx.parentSourceId ?? null,
     ctx.depth != null ? ctx.depth + 1 : null]
  );
  return r.rowCount ?? 0;
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
    handlerOutcomes: {},
  };
  let lastVenueEntityId: number | undefined = ctx.entityId || undefined;
  const isIronPodium = Boolean(ctx.sourceUrl && /ironpodium\.com/i.test(ctx.sourceUrl));
  const verifiedCities = new Map<string, VerifiedLocation>();
  const spawnedUrls = new Set<string>();
  // One upsert per entity per page (a tour page can list the same venue for dozens of performances).
  const entityIds = new Map<string, number>();
  const upsertOnce = async (p: Parameters<typeof upsertEntity>[0]) => {
    const key = `${p.entityType}|${(p.name || "").toLowerCase().trim()}|${p.cityName || ""}`;
    const known = entityIds.get(key);
    if (known) return known;
    const id = await upsertEntity(p);
    if (!known) stats.newEntities++;
    entityIds.set(key, id);
    return id;
  };
  const spawn = async (url: string | undefined, name: string, type: string, horizon: number) => {
    const c = url ? canonicalUrl(url) : null;
    if (!c || spawnedUrls.has(c)) return;
    spawnedUrls.add(c);
    stats.sourcesSpawned += await spawnSource(c, name, type, horizon, ctx);
  };

  for (const ev of extracted) {
    try {
      // Ticket brokers are never used as the official link; the event's source page is.
      const officialInfoUrl = isTicketBrokerUrl(ev.officialInfoUrl) ? ev.sourceUrl : ev.officialInfoUrl;
      const handler = ev.strategy + (ev.locationProvenance === "venue_site" ? ":venue_site" : "");

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
        handler,
        locationProvenance: ev.locationProvenance || "event",
      });

      stats.outcomes[result.outcome]++;
      (stats.handlerOutcomes[handler] ||= {})[result.outcome] = (stats.handlerOutcomes[handler][result.outcome] || 0) + 1;
      for (const r of result.reasons) stats.reasons[r] = (stats.reasons[r] || 0) + 1;
      if (result.outcome === "retry") stats.retryNeeded = true;
      if (result.outcome === "published" || result.outcome === "pending_review") stats.ingested++;
      if (result.location) verifiedCities.set(result.location.citySlug, result.location);

      // Graph: recorded for every real event the page names, whatever the publish outcome.
      // Entity city only from this event's verified location (none for rejected events).
      const loc = entityLocation(result.location);
      const eventId = result.outcome === "published" || result.outcome === "pending_review" || result.outcome === "duplicate" ? result.id ?? null : null;

      // Venue entity (Iron Podium exception: tiny small gyms do not have calendars; do not spawn venue spiders)
      let venueEntityId: number | undefined;
      if (ev.venue) {
        venueEntityId = await upsertOnce({ name: ev.venue, entityType: "venue", subtype: "venue", websiteUrl: ev.venueUrl, ...loc });
        lastVenueEntityId = venueEntityId;
        if (!isIronPodium) {
          await spawn(ev.venueUrl, ev.venue, "venue", 12);
        }
      }

      // Performer entity
      if (ev.performerName) {
        const perfId = await upsertOnce({ name: ev.performerName, entityType: "performer", subtype: "performer", websiteUrl: ev.performerUrl, ...loc });
        await db
          .insert(performers)
          .values({ name: ev.performerName, type: "band", tourPageUrl: ev.performerUrl || null, officialSite: ev.performerUrl || null })
          .onConflictDoUpdate({
            target: performers.name,
            set: { tourPageUrl: ev.performerUrl || undefined, officialSite: ev.performerUrl || undefined, updatedAt: new Date() },
          });
        await spawn(ev.performerUrl, `${ev.performerName} Tour`, "artist_tour", 12);
        if (venueEntityId) {
          await recordRelationship(perfId, "performs_at", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
        }
        if (eventId) {
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
      }

      // Organizer entity
      if (ev.organizerName && ev.organizerName !== ev.venue) {
        const orgId = await upsertOnce({ name: ev.organizerName, entityType: "organization", subtype: "organization", websiteUrl: ev.organizerUrl, ...loc });
        if (venueEntityId) {
          await recordRelationship(orgId, "organized_by", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
        }
        await spawn(ev.organizerUrl, ev.organizerName, "organizer", 12);
      }

      // Food truck appearances link the mobile vendor to the venue (stored events only)
      if (eventId && ev.category === "Food Trucks" && venueEntityId) {
        const vendorId = await upsertOnce({ name: ev.title.split(" at ")[0] || ev.title, entityType: "mobile_food_vendor", subtype: "food_truck", ...loc });
        await recordRelationship(vendorId, "serves_at", venueEntityId, officialInfoUrl, { eventTitle: ev.title, date: ev.eventDate });
      }
    } catch (err: any) {
      stats.outcomes.error++;
      console.error(`[CRAWL_INGEST_ERROR] ${ev.title}: ${err?.message || err}`);
    }
  }

  // Entities named by the page outside of event records (e.g. the site's own venue pages).
  for (const ent of ctx.entities || []) {
    if (!ent.url) continue;
    if (isIronPodium && ent.type === "venue") continue;
    try {
      const c = canonicalUrl(ent.url);
      if (!c || spawnedUrls.has(c)) continue;
      if (ent.type === "venue") {
        await upsertOnce({ name: ent.name, entityType: "venue", subtype: "venue", websiteUrl: c });
      }
      await spawn(c, ent.name, ent.type === "performer" ? "artist_tour" : ent.type === "organization" ? "organizer" : "venue", 12);
    } catch (err: any) {
      console.error(`[CRAWL_ENTITY_ERROR] ${ent.name}: ${err?.message || err}`);
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
