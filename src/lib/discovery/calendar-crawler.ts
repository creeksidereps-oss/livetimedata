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
 * Parses natural human date strings (including ranges like "September 2 - 20, 2026" or single dates "Oct 2, 2026").
 */
export function parseHumanDateString(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\s+/g, " ").trim();

  // Range: "September 2 - 20, 2026" or "Sep 2 - 20, 2026"
  const rangeMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})$/);
  if (rangeMatch) {
    const [_, monthStr, startDay, endDay, year] = rangeMatch;
    const d = new Date(`${monthStr} ${startDay}, ${year} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Multi-month range: "October 27 - November 1, 2026"
  const multiMonthMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (multiMonthMatch) {
    const [_, m1, d1, m2, d2, year] = multiMonthMatch;
    const d = new Date(`${m1} ${d1}, ${year} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Single date: "Sep 24, 2026" or "October 2, 2026"
  const singleMatch = clean.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (singleMatch) {
    const d = new Date(`${singleMatch[1]} ${singleMatch[2]}, ${singleMatch[3]} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
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

          if (obj.subEvent) {
            if (Array.isArray(obj.subEvent)) obj.subEvent.forEach(processObj);
            else processObj(obj.subEvent);
          }
          if (obj.subEvents && Array.isArray(obj.subEvents)) {
            obj.subEvents.forEach(processObj);
          }

          const type = obj["@type"];
          const isEvent =
            type === "Event" || (Array.isArray(type) && type.includes("Event"));

          if (isEvent && obj.name && obj.startDate) {
            const title = String(obj.name).trim();
            const desc = String(obj.description || "")
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 4000);
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

    // 1b. Fallback: Standard DOM Event Card Parsing (for theater, arena, and arts pages without JSON-LD)
    if (eventsFound.length === 0) {
      const cardSelectors = [
        ".eventItem",
        ".event-item",
        ".event_item",
        ".event-card",
        ".eventCard",
        ".events-card",
        "article.event",
        ".show-item",
        ".c-card--event",
      ];

      for (const sel of cardSelectors) {
        const cards = $(sel);
        if (cards.length > 0) {
          cards.each((_, el) => {
            let title = $(el)
              .find("h2 a, h3 a, h4 a, .title a, .event-title a, h2, h3, h4, .title, .event-title")
              .first()
              .text()
              .trim();
            title = title.split("\t")[0].trim().replace(/\s+/g, " ");
            const dateText = $(el)
              .find(".date, .event-date, time, [class*='date']")
              .first()
              .text()
              .trim();
            if (!title || !dateText || title.length < 3 || title.length > 200) return;

            const parsedDate = parseHumanDateString(dateText);
            if (!parsedDate || isNaN(parsedDate.getTime())) return;

            const tagline = $(el)
              .find(".tagline, .sub-title, .event-sub-title, .desc, p")
              .first()
              .text()
              .trim();
            let detailUrl =
              $(el)
                .find("a[href*='/event'], a[href*='/show'], a[href*='/detail'], .title a, h3 a")
                .first()
                .attr("href") || url;
            try {
              detailUrl = new URL(detailUrl, url).href;
            } catch {}

            let flyerUrl = $(el).find("img").first().attr("src");
            try {
              if (flyerUrl) flyerUrl = new URL(flyerUrl, url).href;
            } catch {}

            const category = categorizeEvent(title, tagline);
            const venueName = $("h1").first().text().trim() || fallbackCity;

            eventsFound.push({
              title,
              cityName: fallbackCity,
              stateName: fallbackState,
              venue: venueName,
              category,
              startTime: "7:30 PM",
              eventDate: parsedDate,
              details: tagline
                ? `${title} - ${tagline}. Live in ${fallbackCity}, ${fallbackState}.`
                : `${title} live in ${fallbackCity}, ${fallbackState}.`,
              officialInfoUrl: detailUrl,
              eventFlyerUrl: flyerUrl,
              source: url,
            });
          });

          if (eventsFound.length > 0) break;
        }
      }
    }

    // 1c. Simpleview / ASM Global REST API detection (for arenas, expo centers, and convention centers)
    if (
      eventsFound.length === 0 &&
      (html.includes("plugins_events_events") ||
        html.includes("asm_list") ||
        html.includes("get_simple_token"))
    ) {
      try {
        const origin = new URL(url).origin;
        const tokenRes = await fetch(`${origin}/plugins/core/get_simple_token/`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(5000),
        });
        if (tokenRes.ok) {
          const token = (await tokenRes.text()).trim();
          const apiUrl = `${origin}/includes/rest_v2/plugins_events_events/find/?token=${encodeURIComponent(
            token
          )}&json=${encodeURIComponent(JSON.stringify({ filter: {}, options: { limit: 100 } }))}`;
          const apiRes = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            const docs = apiData.docs || [];
            for (const d of docs) {
              if (!d.title || !d.startDate) continue;
              const eventDate = new Date(d.startDate);
              if (isNaN(eventDate.getTime())) continue;

              const title = String(d.title).trim();
              const detailUrl = d.absoluteUrl || (d.url ? `${origin}${d.url}` : url);
              const flyerUrl = d._media?.[0]?.mediaurl || null;
              const desc = d.description
                ? d.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
                : `${title} in ${fallbackCity}.`;
              const category = categorizeEvent(title, desc);

              eventsFound.push({
                title,
                cityName: fallbackCity,
                stateName: fallbackState,
                venue: d.custom?.calendarname || fallbackCity,
                category,
                startTime: "9:00 AM",
                eventDate,
                details: desc,
                officialInfoUrl: detailUrl,
                eventFlyerUrl: flyerUrl,
                source: url,
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`[SIMPLEVIEW_CRAWL_ERROR] ${err.message}`);
      }
    }

    // 1d. Universal HTML Table & Monthly Accordion Calendars
    // (for state fairgrounds, civic arenas, municipal centers, expo halls)
    if (eventsFound.length === 0 && $("table").length > 0) {
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const now = new Date();
      const currentYear = now.getFullYear();
      const baseVenue = $("h1").first().text().trim() || $("title").first().text().split(/[-|]/)[0].trim() || fallbackCity;

      $("table").each((i, tbl) => {
        let monthName: string | null = null;
        const prevHeader = $(tbl)
          .closest(".ui-accordion-content, .views-field, .accordion-item, div")
          .prevAll("h1, h2, h3, h4, button, .accordion-header")
          .first()
          .text()
          .trim();

        for (const m of months) {
          if (prevHeader.toLowerCase().includes(m.toLowerCase())) {
            monthName = m;
            break;
          }
        }
        if (!monthName && i < 12) {
          monthName = months[i];
        }
        if (!monthName) return;

        const monthIndex = months.indexOf(monthName);

        $(tbl).find("tbody tr, tr").each((_, tr) => {
          const tds = $(tr).find("td");
          if (tds.length < 2) return;

          const dateStr = $(tds[0]).text().replace(/\s+/g, " ").trim();
          const eventCell = $(tds[1]);
          const buildingStr = tds.length >= 3 ? $(tds[2]).text().replace(/\s+/g, " ").trim() : "";
          const contactStr = tds.length >= 4 ? $(tds[3]).text().replace(/\s+/g, " ").trim() : "";

          // Skip header row
          if (/date/i.test(dateStr) && /event/i.test(eventCell.text())) return;

          // Clean child elements for clean text splitting
          const cellClone = eventCell.clone();
          cellClone.find("br").replaceWith("\n");
          cellClone.find("p, div").append("\n");

          let title = eventCell.find("strong, b, h4, h3, a").first().text().replace(/\s+/g, " ").trim();
          if (!title) {
            title = cellClone.text().split("\n")[0].replace(/\s+/g, " ").trim();
          }
          if (title.length > 70 && title.includes(".")) {
            title = title.split(/\. |\n/)[0].trim();
          }
          if (!title || title.length < 3) return;

          let detailUrl = eventCell.find("a[href^='http']").first().attr("href") ||
                          eventCell.find("a[href]").first().attr("href") || url;
          try {
            detailUrl = new URL(detailUrl, url).href;
          } catch {}

          let organizerUrl: string | undefined = undefined;
          let organizerName: string | undefined = undefined;

          // Check if contactCell or eventCell has an external organizer link
          const externalLink = $(tr).find("a[href^='http']").filter((_, a) => {
            const h = $(a).attr("href") || "";
            return !h.includes("facebook.com") && !h.includes("instagram.com") && !h.includes("twitter.com");
          }).first();

          if (externalLink.length > 0) {
            organizerUrl = externalLink.attr("href");
            const linkText = externalLink.text().trim();
            organizerName = linkText.length > 2 ? linkText : title;
            if (organizerUrl && !subUrls.includes(organizerUrl)) {
              subUrls.push(organizerUrl);
            }
          } else if (contactStr && contactStr.length > 3) {
            const cleanedContact = contactStr.split(/[:\d(]/)[0].trim();
            if (cleanedContact.length > 2 && !cleanedContact.toLowerCase().includes("information")) {
              organizerName = cleanedContact;
            }
          }

          // Scan emails in row
          const rowText = $(tr).text();
          const rowEmails = rowText.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || [];
          for (const em of rowEmails) {
            if (isValidEmail(em)) extractedEmails.add(em.toLowerCase().trim());
          }

          // Parse date: "4-6", "17-19", "Every Saturday and Sunday", etc.
          let eventDate: Date | null = null;
          const dayMatch = dateStr.match(/^(\d{1,2})/);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1], 10);
            let targetYear = currentYear;
            if (monthIndex < now.getMonth() - 1) {
              targetYear += 1;
            }
            eventDate = new Date(Date.UTC(targetYear, monthIndex, dayNum, 14, 0, 0));
          } else if (dateStr.toLowerCase().includes("every saturday") || dateStr.toLowerCase().includes("weekend")) {
            let targetYear = currentYear;
            if (monthIndex < now.getMonth() - 1) targetYear += 1;
            eventDate = new Date(Date.UTC(targetYear, monthIndex, 15, 14, 0, 0));
          }

          if (eventDate && eventDate >= new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            const fullDesc = eventCell.text().replace(/\s+/g, " ").trim();
            const category = categorizeEvent(title, fullDesc);
            const venueName = buildingStr ? `${baseVenue} (${buildingStr})` : baseVenue;

            eventsFound.push({
              title,
              cityName: fallbackCity,
              stateName: fallbackState,
              venue: venueName,
              category,
              startTime: "9:00 AM",
              eventDate,
              details: fullDesc || `${title} at ${venueName}.`,
              officialInfoUrl: detailUrl,
              source: url,
              organizerName,
              organizerUrl,
            });
          }
        });
      });
    }

    // 1e. Bandsintown & Artist Tour Widgets (for touring musicians, bands, comedians)
    const bitWidget = $(".bit-widget-initializer, [data-artist-name], a[href*='bandsintown.com']");
    const bitScript = $("script[src*='bandsintown.com']");
    if (
      eventsFound.length === 0 &&
      (bitWidget.length > 0 || bitScript.length > 0 || html.includes("widget.bandsintown.com"))
    ) {
      try {
        let artistName = bitWidget.attr("data-artist-name");
        if (!artistName) {
          artistName =
            $("h1").first().text().trim() ||
            $("title")
              .first()
              .text()
              .split(/[-|]/)[0]
              .replace(/official\s+(?:site|website)\s+of/i, "")
              .trim();
        }

        if (artistName) {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;
          const origin = parsedUrl.origin;
          const bitApiUrl = `https://rest.bandsintown.com/V3.1/artists/${encodeURIComponent(
            artistName
          )}/events?app_id=js_${hostname}&date=upcoming`;

          const bitRes = await fetch(bitApiUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Referer: url,
              Origin: origin,
            },
            signal: AbortSignal.timeout(8000),
          });

          if (bitRes.ok) {
            const tourEvents = await bitRes.json();
            if (Array.isArray(tourEvents)) {
              for (const ev of tourEvents) {
                if (!ev.datetime || !ev.venue) continue;
                const eventDate = new Date(ev.datetime);
                if (isNaN(eventDate.getTime())) continue;

                const city = ev.venue.city || fallbackCity;
                const state = ev.venue.region || fallbackState;
                const venueName = ev.venue.name || `${artistName} Live`;
                const title = ev.title || `${artistName} at ${venueName}`;
                const detailUrl = ev.offers?.[0]?.url || ev.url || url;
                const desc =
                  ev.description ||
                  `${artistName} live in concert at ${venueName} in ${city}, ${state}.`;

                eventsFound.push({
                  title,
                  cityName: city,
                  stateName: state,
                  venue: venueName,
                  category: "Concerts & Live Music",
                  startTime:
                    eventDate.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    }) || "7:00 PM",
                  eventDate,
                  details: desc,
                  officialInfoUrl: detailUrl,
                  eventFlyerUrl: ev.artist?.image_url || null,
                  source: url,
                  performerName: artistName,
                  performerUrl: url,
                });
              }
            }
          }
        }
      } catch (bitErr: any) {
        console.error(`[BANDSINTOWN_CRAWL_ERROR] ${bitErr.message}`);
      }
    }

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
          const isSingleEventInstance =
            (parsed.hostname.includes("facebook.com") && /\/events\/\d+/.test(parsed.pathname)) ||
            (parsed.hostname.includes("eventbrite.com") && parsed.pathname.startsWith("/e/")) ||
            (parsed.hostname.includes("ticketmaster.com") && parsed.pathname.includes("/event/"));

          if (
            !isSingleEventInstance &&
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
 * Decomposes multi-activity festivals and fairs into distinct sub-events
 * (e.g. Car Cruise-In, Food Truck Row, featured stage performances, 5k runs).
 */
export function decomposeFestivalActivities(ev: ExtractedEvent): ExtractedEvent[] {
  const subEvents: ExtractedEvent[] = [];
  const text = (ev.details || "").toLowerCase();
  if (text.length < 30) return subEvents;

  // 1. Car Cruise-In / Car Show sub-event
  if (
    (text.includes("car cruise-in") || text.includes("car show") || text.includes("cruise-in")) &&
    !ev.title.toLowerCase().includes("cruise-in") &&
    !ev.title.toLowerCase().includes("car show")
  ) {
    const timeMatch = ev.details.match(/cruise-in.*?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/i) ||
                      ev.details.match(/(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)).*?cruise-in/i);
    const startTime = timeMatch ? timeMatch[1].toUpperCase().replace(/\./g, '') : "8:00 AM";

    subEvents.push({
      title: `Car Cruise-In at ${ev.title}`,
      cityName: ev.cityName,
      stateName: ev.stateName,
      venue: ev.venue,
      category: "Festivals & Fairs",
      startTime: startTime,
      eventDate: ev.eventDate,
      details: `Car Cruise-In taking place at ${ev.title}. Features classic cars, hot rods, customs, and community automotive showcase.\n\nPart of ${ev.title}.`,
      officialInfoUrl: ev.officialInfoUrl,
      eventFlyerUrl: ev.eventFlyerUrl,
      source: ev.source,
      organizerName: ev.organizerName,
      organizerUrl: ev.organizerUrl,
    });
  }

  // 2. Food Truck Row / Rally sub-event
  if (
    (text.includes("food truck") || text.includes("food trucks")) &&
    !ev.title.toLowerCase().includes("food truck")
  ) {
    subEvents.push({
      title: `Food Truck Row at ${ev.title}`,
      cityName: ev.cityName,
      stateName: ev.stateName,
      venue: ev.venue,
      category: "Food Trucks",
      startTime: ev.startTime,
      eventDate: ev.eventDate,
      details: `Dedicated food truck row and mobile dining at ${ev.title}. Enjoy a variety of local food trucks, savory dishes, desserts, and craft beverages.\n\nPart of ${ev.title}.`,
      officialInfoUrl: ev.officialInfoUrl,
      eventFlyerUrl: ev.eventFlyerUrl,
      source: ev.source,
      organizerName: ev.organizerName,
      organizerUrl: ev.organizerUrl,
    });
  }

  // 3. Featured live music / choir / opening act if mentioned
  const actMatch = ev.details.match(/([A-Z][A-Za-z0-9\s&'-]+(?:Chorus|Choir|Band|Orchestra|Symphony|Ensemble))\s+(?:opens|takes the stage|kicks off|performs|presents)/);
  if (actMatch && !ev.title.toLowerCase().includes(actMatch[1].toLowerCase())) {
    const actName = actMatch[1].trim();
    subEvents.push({
      title: `${actName} Live at ${ev.title}`,
      cityName: ev.cityName,
      stateName: ev.stateName,
      venue: ev.venue,
      category: "Concerts & Live Music",
      startTime: ev.startTime,
      eventDate: ev.eventDate,
      details: `Live performance by ${actName} at ${ev.title}.\n\nPart of ${ev.title}.`,
      officialInfoUrl: ev.officialInfoUrl,
      eventFlyerUrl: ev.eventFlyerUrl,
      source: ev.source,
      performerName: actName,
      organizerName: ev.organizerName,
      organizerUrl: ev.organizerUrl,
    });
  }

  return subEvents;
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

  // Flatten extracted events with any decomposed festival activities
  const allEventsToIngest: ExtractedEvent[] = [];
  for (const ev of extractedEvents) {
    allEventsToIngest.push(ev);
    const subActs = decomposeFestivalActivities(ev);
    for (const sub of subActs) {
      allEventsToIngest.push(sub);
    }
  }

  for (const ev of allEventsToIngest) {
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
              scrapeIntervalDays: 30,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW()`,
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
              nextScrapeDue: sql`NOW()`,
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

      // 5. Upsert Organizer Entity into graph (so spider searches Google for its official site/calendar)
      if (ev.organizerName && ev.organizerName !== ev.venue) {
        const orgId = await upsertEntity({
          name: ev.organizerName,
          entityType: "organization",
          cityName: ev.cityName,
          stateName: ev.stateName || "NC",
          websiteUrl: ev.organizerUrl,
        });
        stats.newEntities++;

        if (venueEntityId) {
          await recordRelationship(
            orgId,
            "organized_by",
            venueEntityId,
            ev.officialInfoUrl,
            { eventTitle: ev.title, date: ev.eventDate }
          );
        }

        // If organizer has a calendar/page, register as tracked source
        if (ev.organizerUrl && ev.organizerUrl.startsWith("http")) {
          await db
            .insert(sources)
            .values({
              url: ev.organizerUrl,
              name: ev.organizerName,
              sourceType: "organizer",
              cityName: ev.cityName,
              stateName: ev.stateName || "NC",
              scrapeIntervalDays: 30,
              scrapeHorizonMonths: 6,
              status: "active",
              nextScrapeDue: sql`NOW()`,
            })
            .onConflictDoNothing();
        }
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
