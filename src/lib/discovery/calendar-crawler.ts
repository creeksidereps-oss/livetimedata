// src/lib/discovery/calendar-crawler.ts
import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "@/db";
import { events, entities, entityRelationships, appearances, cities, sources, performers, emailContacts } from "@/db/schema";
import { sql, eq, and, isNull } from "drizzle-orm";
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
  performerUrl?: string;
  organizerName?: string;
  organizerUrl?: string;
  venueUrl?: string;
}

export interface CrawlResult {
  events: ExtractedEvent[];
  subUrls: string[];
  extractedEmails: string[];
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
 * Validates whether an extracted string is a clean, genuine email address.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 6 || clean.length > 100) return false;

  // Standard email format ending with valid domain TLD
  if (
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|co|us|uk|de|ca|biz|info|me|events|live)$/i.test(
      clean
    )
  ) {
    return false;
  }

  const junkKeywords = [
    "noreply",
    "no-reply",
    "donotreply",
    "example.com",
    "domain.com",
    "yourdomain",
    "sentry.io",
    "cloudflare",
    "wixpress",
    "bootstrap",
    "wordpress",
    "schema.org",
    "w3.org",
    "github.com",
    "google.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "eventbrite.com",
    "ticketmaster.com",
    "seatgeek.com",
    "@2x",
    "@3x",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".css",
    ".js",
  ];
  return !junkKeywords.some((j) => clean.includes(j));
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
  const extractedEmails = new Set<string>();

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
    if (typeof html !== "string")
      return { events: eventsFound, subUrls, extractedEmails: [] };

    const $ = cheerio.load(html);

    // Scan mailto: links directly from page
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = $(el).attr("href");
      if (raw) {
        const clean = raw.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
        if (isValidEmail(clean)) extractedEmails.add(clean);
      }
    });

    // Scan page body for emails
    const bodyText = $("body").text();
    const textMatches =
      bodyText.match(
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|co|us|uk|de|ca|biz|info|me|events|live)\b/gi
      ) || [];
    for (const m of textMatches) {
      if (isValidEmail(m)) extractedEmails.add(m.toLowerCase().trim());
    }

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

          if (obj.email && typeof obj.email === "string") {
            const clean = obj.email.replace(/^mailto:/i, "").trim().toLowerCase();
            if (isValidEmail(clean)) extractedEmails.add(clean);
          }
          if (obj.organizer && typeof obj.organizer === "object" && obj.organizer.email) {
            const clean = String(obj.organizer.email).replace(/^mailto:/i, "").trim().toLowerCase();
            if (isValidEmail(clean)) extractedEmails.add(clean);
          }
          if (obj.location && typeof obj.location === "object" && obj.location.email) {
            const clean = String(obj.location.email).replace(/^mailto:/i, "").trim().toLowerCase();
            if (isValidEmail(clean)) extractedEmails.add(clean);
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
            let performerUrl: string | undefined;
            if (obj.performer) {
              if (typeof obj.performer === "string") {
                performerName = obj.performer.trim();
              } else if (Array.isArray(obj.performer) && obj.performer[0]) {
                performerName =
                  typeof obj.performer[0] === "string"
                    ? obj.performer[0]
                    : obj.performer[0]?.name;
                if (typeof obj.performer[0] === "object") {
                  performerUrl = obj.performer[0]?.url || obj.performer[0]?.sameAs;
                }
              } else if (typeof obj.performer === "object") {
                if (obj.performer.name) performerName = String(obj.performer.name).trim();
                performerUrl = obj.performer.url || obj.performer.sameAs;
              }
            }

            let organizerName: string | undefined;
            let organizerUrl: string | undefined;
            if (obj.organizer) {
              if (typeof obj.organizer === "string") {
                organizerName = obj.organizer.trim();
              } else if (typeof obj.organizer === "object") {
                if (obj.organizer.name) organizerName = String(obj.organizer.name).trim();
                organizerUrl = obj.organizer.url || obj.organizer.sameAs;
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
              performerUrl,
              organizerName,
              organizerUrl,
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

  return {
    events: eventsFound,
    subUrls: subUrls.slice(0, 10),
    extractedEmails: Array.from(extractedEmails).slice(0, 10),
  };
}

/**
 * Ingests extracted events into PostgreSQL, deduplicates against existing records,
 * auto-provisions new cities, creates graph entities and relationships, and registers
 * discovered venues into sources. Also captures any discovered contact emails into email_contacts.
 */
export async function ingestDiscoveredEvents(
  extractedEvents: ExtractedEvent[],
  extractedEmails: string[] = [],
  context?: {
    cityName?: string | null;
    stateName?: string | null;
    sourceUrl?: string | null;
    venueName?: string | null;
    entityId?: number | null;
  }
): Promise<{
  ingested: number;
  skipped: number;
  birthedCities: number;
  newEntities: number;
  emailsIngested: number;
}> {
  const stats = {
    ingested: 0,
    skipped: 0,
    birthedCities: 0,
    newEntities: 0,
    emailsIngested: 0,
  };

  let lastDiscoveredVenueEntityId: number | undefined = context?.entityId || undefined;

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
        lastDiscoveredVenueEntityId = venueEntityId;

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
          websiteUrl: ev.performerUrl,
        });
        stats.newEntities++;

        // Upsert into performers table
        await db
          .insert(performers)
          .values({
            name: ev.performerName,
            type: "band",
            tourPageUrl: ev.performerUrl || null,
            officialSite: ev.performerUrl || null,
          })
          .onConflictDoUpdate({
            target: performers.name,
            set: {
              tourPageUrl: ev.performerUrl || undefined,
              officialSite: ev.performerUrl || undefined,
              updatedAt: new Date(),
            },
          });

        // Register artist tour page / website as a perpetually tracked source
        if (ev.performerUrl && ev.performerUrl.startsWith("http")) {
          await db
            .insert(sources)
            .values({
              url: ev.performerUrl,
              name: `${ev.performerName} Tour`,
              sourceType: "artist_tour",
              cityName: ev.cityName,
              stateName: ev.stateName || "NC",
              scrapeIntervalDays: 30,
              scrapeHorizonMonths: 12,
              status: "active",
              nextScrapeDue: sql`NOW() + interval '7 days'`,
            })
            .onConflictDoNothing();
        }

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

      // 5. If organizer has a calendar/page, register as tracked source
      if (ev.organizerUrl && ev.organizerUrl.startsWith("http")) {
        await db
          .insert(sources)
          .values({
            url: ev.organizerUrl,
            name: ev.organizerName || `${ev.venue} Organizer`,
            sourceType: "organizer",
            cityName: ev.cityName,
            stateName: ev.stateName || "NC",
            scrapeIntervalDays: 14,
            scrapeHorizonMonths: 6,
            status: "active",
            nextScrapeDue: sql`NOW() + interval '7 days'`,
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

  // 6. Ingest any discovered contact emails into email_contacts table & link to entities
  if (extractedEmails && extractedEmails.length > 0) {
    const city = context?.cityName || extractedEvents[0]?.cityName || null;
    const state = context?.stateName || extractedEvents[0]?.stateName || "NC";
    const sourceUrl = context?.sourceUrl || extractedEvents[0]?.source || "Calendar Crawler";
    const venueName = context?.venueName || extractedEvents[0]?.venue || null;
    const targetEntityId = context?.entityId || lastDiscoveredVenueEntityId;

    for (const email of extractedEmails) {
      try {
        await db
          .insert(emailContacts)
          .values({
            email,
            category: "Venues & Organizers",
            cityName: city,
            stateName: state,
            countryCode: "US",
            status: "active",
            source: sourceUrl,
            metadata: {
              sourceUrl,
              venueName,
              discoveredAt: new Date().toISOString(),
            },
          })
          .onConflictDoNothing();
        stats.emailsIngested++;
      } catch {}

      // If we have an entity ID (from context or discovered venue), link email to entity
      if (targetEntityId) {
        try {
          await db
            .update(entities)
            .set({ email, updatedAt: new Date() })
            .where(and(eq(entities.id, targetEntityId), isNull(entities.email)));
        } catch {}
      }
    }
  }

  return stats;
}
