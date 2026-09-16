// src/lib/discovery/calendar-crawler.ts
import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "@/db";
import { events, entities, entityRelationships, appearances, cities, sources } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { upsertEntity, recordRelationship } from "./lifecycle";

export interface ExtractedEvent {
  title: string;
  cityName: string;
  stateName?: string;
  venue: string;
  category: string;
  startTime: string;
  eventDate: Date;
  details: string;
  officialInfoUrl?: string;
  eventFlyerUrl?: string;
  source: string;
  latitude?: number;
  longitude?: number;
  performerName?: string;
  organizerName?: string;
  venueUrl?: string;
}

export interface CrawlResult {
  events: ExtractedEvent[];
  subUrls: string[];
}

/**
 * Normalizes event category based on title, description, and keywords.
 */
export function categorizeEvent(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  // Yard / Garage Sales & Auctions
  if (
    /\b(auction|estate auction|consignment auction|yard sale|garage sale|estate sale|moving sale|rummage sale|tag sale|barn sale|porch sale)\b/i.test(
      text
    )
  ) {
    return "Yard / Garage Sales";
  }

  // Food Trucks & Mobile Food
  if (
    /\b(food truck|food trucks|food truck rally|brewery food|mobile eats|food trailer|street food)\b/i.test(
      text
    )
  ) {
    return "Food Trucks";
  }

  // Concerts & Live Music
  if (
    /\b(music|concert|band|live music|acoustic|orchestra|choir|singer|jazz|blues|rock|country music|symphony|jam session|acoustic set)\b/i.test(
      text
    )
  ) {
    return "Concerts & Live Music";
  }

  // Festivals & Fairs
  if (
    /\b(festival|fest|carnival|parade|fair|fall fest|octoberfest|oktoberfest|spring fest|harvest fest)\b/i.test(
      text
    )
  ) {
    return "Festivals & Fairs";
  }

  // Classes & Workshops
  if (
    /\b(class|workshop|pottery|painting|cooking class|seminar|lesson|learn to|craft workshop|fitness class|yoga)\b/i.test(
      text
    )
  ) {
    return "Classes";
  }

  // Theatre & Performing Arts
  if (
    /\b(theater|theatre|comedy|stand-up|musical|play|improv|ballet|dance performance|opera|drama)\b/i.test(
      text
    )
  ) {
    return "Theatre & Performing Arts";
  }

  // Arts & Culture
  if (
    /\b(art|gallery|exhibition|craft fair|art crawl|museum|cultural|sculpture|pottery show)\b/i.test(
      text
    )
  ) {
    return "Arts & Culture";
  }

  // Sports & Recreation
  if (
    /\b(football|baseball|basketball|soccer|hockey|5k|10k|run|marathon|race|golf|wrestling|tournament|softball)\b/i.test(
      text
    )
  ) {
    return "Sports & Recreation";
  }

  // Family Friendly
  if (
    /\b(kids|family|storytime|puppet|trunk or treat|halloween for kids|family fun|children|toddler)\b/i.test(
      text
    )
  ) {
    return "Family Friendly";
  }

  // Nightlife & Social
  if (
    /\b(beer|wine|brewery|bar|nightlife|trivia|dj|club|cocktail|lounge|party|karaoke|pub crawl)\b/i.test(
      text
    )
  ) {
    return "Nightlife & Social";
  }

  return "Community & Civic";
}

/**
 * Parses a readable 12-hour time string from an ISO or date-time string.
 */
export function formatTimeFromDate(isoStr?: string): string {
  if (!isoStr) return "7:00 PM";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "7:00 PM";
    let hours = d.getHours();
    const minutes = d.getMinutes();
    if (hours === 0 && minutes === 0) return "All Day";
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minStr} ${ampm}`;
  } catch {
    return "7:00 PM";
  }
}

/**
 * Extracts Schema.org events and calendar links from any URL.
 */
export async function extractEventsFromUrl(
  url: string,
  fallbackCity: string = "Statesville",
  fallbackState: string = "NC"
): Promise<CrawlResult> {
  const eventsFound: ExtractedEvent[] = [];
  const subUrls: string[] = [];

  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 12000,
      maxRedirects: 3,
    });

    const html = res.data;
    if (typeof html !== "string") return { events: eventsFound, subUrls };

    const $ = cheerio.load(html);

    // 1. Process Schema.org JSON-LD scripts
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((_, el) => {
      try {
        const text = $(el).html();
        if (!text) return;
        const data = JSON.parse(text);

        function processObj(obj: any) {
          if (!obj || typeof obj !== "object") return;
          if (Array.isArray(obj)) {
            obj.forEach(processObj);
            return;
          }
          if (obj["@graph"] && Array.isArray(obj["@graph"])) {
            obj["@graph"].forEach(processObj);
            return;
          }
          if (obj.itemListElement && Array.isArray(obj.itemListElement)) {
            obj.itemListElement.forEach((item: any) => {
              processObj(item.item || item);
            });
            return;
          }

          const type = obj["@type"];
          const isEvent =
            type === "Event" || (Array.isArray(type) && type.includes("Event"));

          if (isEvent && obj.name && obj.startDate) {
            const title = String(obj.name).trim();
            const desc = String(obj.description || "")
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 800);
            const startDateStr = obj.startDate;
            const eventDate = new Date(startDateStr);
            if (isNaN(eventDate.getTime())) return;

            let venueName = "Local Venue";
            let cityName = fallbackCity;
            let stateName = fallbackState;
            let venueUrl: string | undefined;
            let latitude: number | undefined;
            let longitude: number | undefined;

            if (obj.location) {
              if (typeof obj.location === "string") {
                venueName = obj.location.trim();
              } else if (typeof obj.location === "object") {
                if (obj.location.name) venueName = String(obj.location.name).trim();
                if (obj.location.url || obj.location.sameAs) {
                  venueUrl = String(obj.location.url || obj.location.sameAs);
                }
                const addr = obj.location.address;
                if (addr) {
                  if (typeof addr === "string") {
                    const parts = addr.split(",").map((s: string) => s.trim());
                    if (parts.length >= 2) {
                      cityName = parts[parts.length - 2] || cityName;
                      stateName =
                        (parts[parts.length - 1] || "NC").split(" ")[0] || "NC";
                    }
                  } else if (typeof addr === "object") {
                    if (addr.addressLocality)
                      cityName = String(addr.addressLocality).trim();
                    if (addr.addressRegion)
                      stateName = String(addr.addressRegion).trim();
                  }
                }
                if (obj.location.geo) {
                  if (obj.location.geo.latitude) {
                    latitude = parseFloat(obj.location.geo.latitude);
                  }
                  if (obj.location.geo.longitude) {
                    longitude = parseFloat(obj.location.geo.longitude);
                  }
                }
              }
            }

            let flyerUrl: string | undefined;
            if (typeof obj.image === "string") flyerUrl = obj.image;
            else if (Array.isArray(obj.image) && obj.image[0]) {
              flyerUrl =
                typeof obj.image[0] === "string"
                  ? obj.image[0]
                  : obj.image[0]?.url;
            } else if (obj.image && typeof obj.image === "object") {
              flyerUrl = obj.image.url || obj.image.contentUrl;
            }

            let performerName: string | undefined;
            if (obj.performer) {
              if (typeof obj.performer === "string") {
                performerName = obj.performer.trim();
              } else if (Array.isArray(obj.performer) && obj.performer[0]) {
                performerName =
                  typeof obj.performer[0] === "string"
                    ? obj.performer[0]
                    : obj.performer[0]?.name;
              } else if (typeof obj.performer === "object" && obj.performer.name) {
                performerName = String(obj.performer.name).trim();
              }
            }

            let organizerName: string | undefined;
            if (obj.organizer) {
              if (typeof obj.organizer === "string") {
                organizerName = obj.organizer.trim();
              } else if (typeof obj.organizer === "object" && obj.organizer.name) {
                organizerName = String(obj.organizer.name).trim();
              }
            }

            const officialUrl =
              obj.url || (obj.offers && obj.offers.url) || url;
            const startTime = formatTimeFromDate(startDateStr);
            const category = categorizeEvent(title, desc);

            eventsFound.push({
              title,
              cityName,
              stateName,
              venue: venueName,
              category,
              startTime,
              eventDate,
              details: desc || `${title} at ${venueName}.`,
              officialInfoUrl: officialUrl,
              eventFlyerUrl: flyerUrl,
              source: url,
              latitude,
              longitude,
              performerName,
              organizerName,
              venueUrl,
            });
          }
        }

        processObj(data);
      } catch {}
    });

    // 2. Discover sub-links for deeper recursive calendar crawling
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (
        href &&
        (href.includes("/event/") ||
          href.includes("/events/") ||
          href.includes("/calendar/") ||
          href.includes("/shows/") ||
          href.includes("/happenings/"))
      ) {
        try {
          const parsed = new URL(href, url);
          if (
            parsed.protocol.startsWith("http") &&
            parsed.href !== url &&
            !subUrls.includes(parsed.href)
          ) {
            subUrls.push(parsed.href);
          }
        } catch {}
      }
    });
  } catch (err: any) {
    console.error(`[CALENDAR_CRAWLER] Error fetching ${url}: ${err.message}`);
  }

  return { events: eventsFound, subUrls: subUrls.slice(0, 10) };
}

/**
 * Ingests extracted events into PostgreSQL, deduplicates against existing records,
 * auto-provisions new cities, creates graph entities and relationships, and registers
 * discovered venues into sources.
 */
export async function ingestDiscoveredEvents(
  extractedEvents: ExtractedEvent[]
): Promise<{
  ingested: number;
  skipped: number;
  birthedCities: number;
  newEntities: number;
}> {
  const stats = {
    ingested: 0,
    skipped: 0,
    birthedCities: 0,
    newEntities: 0,
  };

  for (const ev of extractedEvents) {
    try {
      const normTitle = ev.title.toLowerCase().trim();
      const normCity = ev.cityName.toLowerCase().trim();

      // Check if event already exists (title + city + event date match)
      const existing = await db
        .select({ id: events.id, flyer: events.eventFlyerUrl })
        .from(events)
        .where(
          and(
            sql`LOWER(${events.title}) = ${normTitle}`,
            sql`LOWER(${events.cityName}) = ${normCity}`,
            sql`DATE(${events.eventDate}) = DATE(${ev.eventDate})`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        stats.skipped++;
        // If existing lacks flyer but new one has it, backfill flyer
        if (!existing[0].flyer && ev.eventFlyerUrl) {
          await db
            .update(events)
            .set({ eventFlyerUrl: ev.eventFlyerUrl })
            .where(eq(events.id, existing[0].id));
        }
        continue;
      }

      // 1. Auto-provision city if not yet in cities table
      const cityCheck = await db
        .select({ slug: cities.slug })
        .from(cities)
        .where(sql`LOWER(${cities.name}) = ${normCity}`)
        .limit(1);

      if (cityCheck.length === 0 && ev.cityName) {
        const citySlug = ev.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await db
          .insert(cities)
          .values({
            name: ev.cityName,
            slug: citySlug,
            admin1: ev.stateName || "NC",
            countryCode: "US",
            countryName: "United States",
            latitude: ev.latitude || 35.78,
            longitude: ev.longitude || -80.88,
            timezone: "America/New_York",
            population: 10000,
          })
          .onConflictDoNothing();
        stats.birthedCities++;
      }

      // 2. Insert new event into events table
      const [insertedEvent] = await db
        .insert(events)
        .values({
          title: ev.title,
          cityName: ev.cityName,
          stateName: ev.stateName || "NC",
          category: ev.category,
          venue: ev.venue,
          startTime: ev.startTime,
          eventDate: ev.eventDate,
          details: ev.details,
          officialInfoUrl: ev.officialInfoUrl,
          eventFlyerUrl: ev.eventFlyerUrl,
          status: "live",
          source: ev.source || "Automated Calendar Crawler",
        })
        .returning({ id: events.id });

      stats.ingested++;

      // 3. Upsert Venue Entity into graph
      let venueEntityId: number | undefined;
      if (ev.venue && ev.venue !== "Local Venue") {
        venueEntityId = await upsertEntity({
          name: ev.venue,
          entityType: "venue",
          cityName: ev.cityName,
          stateName: ev.stateName || "NC",
          websiteUrl: ev.venueUrl,
        });
        stats.newEntities++;

        // Register venue URL into sources table for future spider sweeps
        if (ev.venueUrl && ev.venueUrl.startsWith("http")) {
          await db
            .insert(sources)
            .values({
              url: ev.venueUrl,
              name: ev.venue,
              sourceType: "venue",
              cityName: ev.cityName,
              stateName: ev.stateName || "NC",
              scrapeIntervalDays: 14,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW() + interval '7 days'`,
            })
            .onConflictDoNothing();
        }
      }

      // 4. Upsert Performer Entity into graph if present
      if (ev.performerName) {
        const perfId = await upsertEntity({
          name: ev.performerName,
          entityType: "performer",
          cityName: ev.cityName,
          stateName: ev.stateName || "NC",
        });
        stats.newEntities++;

        if (venueEntityId) {
          await recordRelationship(
            perfId,
            "performs_at",
            venueEntityId,
            ev.officialInfoUrl,
            { eventTitle: ev.title, date: ev.eventDate }
          );
        }

        // Record appearance in appearances table
        await db
          .insert(appearances)
          .values({
            entityId: perfId,
            venueEntityId: venueEntityId || null,
            eventId: insertedEvent?.id || null,
            eventDate: ev.eventDate,
            startTime: ev.startTime,
            sourceUrl: ev.officialInfoUrl || ev.source,
            status: "published",
          })
          .onConflictDoNothing();
      }

      // 5. If category is Food Trucks, link mobile vendor
      if (ev.category === "Food Trucks") {
        const vendorId = await upsertEntity({
          name: ev.title.split(" at ")[0] || ev.title,
          entityType: "mobile_food_vendor",
          subtype: "food_truck",
          cityName: ev.cityName,
          stateName: ev.stateName || "NC",
        });
        stats.newEntities++;

        if (venueEntityId) {
          await recordRelationship(
            vendorId,
            "serves_at",
            venueEntityId,
            ev.officialInfoUrl,
            { eventTitle: ev.title, date: ev.eventDate }
          );
        }
      }
    } catch (err: any) {
      console.error(`[INGEST_ERROR] Failed ingesting event ${ev.title}:`, err.message);
    }
  }

  return stats;
}
