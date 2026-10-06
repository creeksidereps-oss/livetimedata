// src/lib/discovery/calendar-crawler.ts
import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "@/db";
import { events, entities, entityRelationships, appearances, cities, sources, performers, emailContacts } from "@/db/schema";
import { sql, eq, and, isNull } from "drizzle-orm";
import { upsertEntity, recordRelationship } from "./lifecycle";
import { areEventsDuplicates, mergeEventRecords } from "@/lib/events/dedup";

export interface ExtractedEvent {
  title: string;
  cityName: string;
  stateName?: string;
  venue: string;
  venueAddress?: string;
  hostingEntity?: string;
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

  // Auditions & Casting Calls
  if (
    /\b(audition|auditions|casting call|open call|call for actors|call for performers|call for dancers|call for singers|actor tryouts|dance tryouts|audition notice)\b/i.test(
      text
    )
  ) {
    return "Auditions";
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
 * Strips HTML tags and decodes common HTML entities to prevent raw HTML leak into event descriptions.
 */
export function cleanHtmlEntitiesAndTags(raw?: string): string {
  if (!raw) return "";
  let text = String(raw);
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\\r\\n|\\n/g, " ");
  // Strip tags
  text = text.replace(/<[^>]+>/g, " ");
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text.slice(0, 4000);
}

/**
 * Detects whether a string is a generic calendar / page heading rather than a physical venue name.
 */
export function isGenericCalendarHeader(text?: string | null): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  return (
    clean.length < 3 ||
    clean.length > 70 ||
    /\b(events?\s*(&|and)?\s*tickets?|upcoming\s*events?|calendar|event\s*calendar|schedule|what['’]?s\s*on|shows?\s*(&|and)?\s*events?|all\s*events?|find\s*events?|search\s*results?|ticket\s*center|box\s*office|home|welcome)\b/i.test(
      clean
    )
  );
}


/**
 * Parses a readable 12-hour time string from an ISO or date-time string.
 * Preserves the local time specified in the string to avoid UTC server timezone shifts (e.g. 00:00 -04:00 shifting to 4:00 AM).
 */
export function formatTimeFromDate(isoStr?: string): string {
  if (!isoStr) return "7:00 PM";
  try {
    // Check if ISO string specifies a time (e.g., "T14:30:00" or "T14:30")
    const timeMatch = isoStr.match(/T(\d{2}):(\d{2})/i);
    if (!timeMatch) {
      // Date-only format (e.g., "2026-10-31") is an All Day event
      return "All Day";
    }

    const rawHours = parseInt(timeMatch[1], 10);
    const rawMinutes = parseInt(timeMatch[2], 10);

    // Midnight (00:00) specified by calendar publishers indicates an All Day event
    if (rawHours === 0 && rawMinutes === 0) {
      return "All Day";
    }

    // Format local time directly from string representation to prevent UTC server offset shifts
    let hours = rawHours;
    const minutes = rawMinutes;
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

  // Single date without year: "Sep 24", "September 24", "Sep 24th"
  const monthDayMatch = clean.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (monthDayMatch) {
    const currentYear = new Date().getFullYear();
    const d = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${currentYear} 12:00:00 UTC`);
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
 * Strict validator to guarantee only genuine recurring calendar hubs,
 * schedules, and venue directories enter the sources table.
 * Rejects add-to-calendar webmail links, date pagination loops, single-event permalinks, and social media.
 */
export function isValidCalendarSourceUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // 1. Must be http / https
    if (!parsed.protocol.startsWith("http")) return false;

    // 2. Reject webmail & add-to-calendar providers
    const blockedHosts = [
      "google.com",
      "calendar.google.com",
      "outlook.live.com",
      "outlook.office.com",
      "outlook.com",
      "live.com",
      "mail.yahoo.com",
      "yahoo.com",
      "apple.com",
      "icloud.com",
    ];
    if (blockedHosts.some((bh) => host === bh || host.endsWith("." + bh))) {
      return false;
    }

    // 3. Reject bot-blocked social platforms & messaging
    const socialHosts = [
      "facebook.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "linkedin.com",
      "tiktok.com",
      "youtube.com",
      "pinterest.com",
      "snapchat.com",
      "reddit.com",
      "threads.net",
    ];
    if (socialHosts.some((sh) => host === sh || host.endsWith("." + sh))) {
      return false;
    }

    // 4. Reject static assets & documents
    if (/\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|zip|css|js|ics|vcf|ashx)(\?.*)?$/i.test(path)) {
      return false;
    }

    // 5. Reject calendar date pagination loops (e.g. /events/2026-10-01/, /events/month/2026-11/)
    if (/\/(?:events?|calendar|shows)\/\d{4}[-/]\d{2}(?:[-/]\d{2})?\/?$/i.test(path)) {
      return false;
    }
    if (/\/(?:events?|calendar)\/(?:month|week|day|list|today|upcoming)\/?$/i.test(path)) {
      return false;
    }
    if (
      search.includes("tribe-bar-date") ||
      search.includes("eventdate") ||
      search.includes("startdt=") ||
      search.includes("action=template")
    ) {
      return false;
    }

    // 6. Reject single-event permalinks (e.g. /event/polar-express-16/ or /events/music/band-name/)
    // Genuine calendar hubs are: /events, /calendar, /shows, /concerts, /schedule, /upcoming
    if (/\/event\/[^\/]+\/?$/i.test(path)) {
      return false;
    }
    if (/\/events\/[^\/]+\/[^\/]+\/?$/i.test(path) && !path.includes("/page/")) {
      return false;
    }
    if (
      path.includes("/tickets/") ||
      path.includes("/ticket/") ||
      (host.includes("eventbrite") && path.startsWith("/e/")) ||
      (host.includes("ticketmaster") && path.includes("/event/"))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts Schema.org events and calendar links from any URL.
 */
export async function extractEventsFromUrl(
  url: string,
  fallbackCity: string = "",
  fallbackState: string = ""
): Promise<CrawlResult> {
  const eventsFound: ExtractedEvent[] = [];
  const subUrls: string[] = [];
  const extractedEmails = new Set<string>();
  const LOTC_DOMAINS: Record<string, { city: string; state: string }> = {
    "charlotteonthecheap.com": { city: "Charlotte", state: "NC" },
    "atlantaonthecheap.com": { city: "Atlanta", state: "GA" },
    "milehighonthecheap.com": { city: "Denver", state: "CO" },
    "chicagoonthecheap.com": { city: "Chicago", state: "IL" },
    "rvaonthecheap.com": { city: "Richmond", state: "VA" },
    "miamionthecheap.com": { city: "Miami", state: "FL" },
    "orlandoonthecheap.com": { city: "Orlando", state: "FL" },
    "kansascityonthecheap.com": { city: "Kansas City", state: "MO" },
    "columbusonthecheap.com": { city: "Columbus", state: "OH" },
    "greaterseattleonthecheap.com": { city: "Seattle", state: "WA" },
    "triangleonthecheap.com": { city: "Raleigh", state: "NC" },
    "southernmaineonthecheap.com": { city: "Portland", state: "ME" },
    "hawaiionthecheap.com": { city: "Honolulu", state: "HI" },
  };

  for (const [dom, loc] of Object.entries(LOTC_DOMAINS)) {
    if (url.includes(dom)) {
      if (!fallbackCity || fallbackCity === "Local" || fallbackCity === "Unknown") fallbackCity = loc.city;
      if (!fallbackState) fallbackState = loc.state;
      break;
    }
  }

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
            // Strict Guard: Exclude online/virtual events
            const attendanceMode = String(obj.eventAttendanceMode || '');
            const isVirtual =
              attendanceMode.includes('OnlineEventAttendanceMode') ||
              obj.location?.['@type'] === 'VirtualLocation' ||
              String(obj.location?.name || '').toLowerCase().includes('online') ||
              String(obj.location || '').toLowerCase().includes('online') ||
              /\b(online event|virtual event|virtual book fair|virtual book club|livestream|webinar|zoom meeting)\b/i.test(
                `${obj.name || ''} ${obj.description || ''} ${obj.url || ''}`
              );
            if (isVirtual) {
              return;
            }

            // Strict Guard: Exclude adult / NSFW events
            const isAdult = /\b(x-rated|erotic|onlyfans|porn|fetish|swinger|nsfw|strip club)\b/i.test(
              `${obj.name || ''} ${obj.description || ''} ${obj.url || ''}`
            );
            if (isAdult) {
              return;
            }
            const title = String(obj.name).trim();

            // Strict Guard: Exclude operational / business / facility hours (e.g. "Hours of Operation")
            if (
              /\b(hours of operation|operating hours|facility hours|open daily|park hours|visitor center hours|guest services hours|box office hours|business hours)\b/i.test(
                title
              )
            ) {
              return;
            }

            const desc = cleanHtmlEntitiesAndTags(obj.description || "");
            const startDateStr = obj.startDate;
            const eventDate = new Date(startDateStr);
            if (isNaN(eventDate.getTime())) return;

            let venueName = "Local Venue";
            let venueAddress: string | undefined;
            let cityName = fallbackCity;
            let stateName = fallbackState;
            let venueUrl: string | undefined;
            let latitude: number | undefined;
            let longitude: number | undefined;

            // Known Venue Domain Enrichment
            if (url.includes("whitewater.org")) {
              venueName = "U.S. National Whitewater Center";
              venueAddress = "5000 Whitewater Center Pkwy, Charlotte, NC 28214";
              cityName = "Charlotte";
              stateName = "NC";
              latitude = 35.2726;
              longitude = -81.0055;
            }

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
                    venueAddress = addr.trim();
                    const parts = addr.split(",").map((s: string) => s.trim());
                    if (parts.length >= 2) {
                      cityName = parts[parts.length - 2] || cityName;
                      const lastPart = (parts[parts.length - 1] || "").trim();
                      stateName = lastPart.split(" ")[0] || fallbackState || "";
                    }
                  } else if (typeof addr === "object") {
                    if (addr.addressLocality)
                      cityName = String(addr.addressLocality).trim();
                    if (addr.addressRegion)
                      stateName = String(addr.addressRegion).trim();
                    const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean);
                    if (parts.length > 0) venueAddress = parts.join(", ");
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
              venueAddress,
              hostingEntity: organizerName || undefined,
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

    // 1b. AEG / Bowery / AXS Venues JSON Feed Detection (data-file attribute)
    if (eventsFound.length === 0) {
      const dataFileMatch = html.match(/data-file=["'](https?:\/\/[^"']+\.json[^"']*)["']/i);
      if (dataFileMatch) {
        const jsonUrl = dataFileMatch[1];
        try {
          const jsonRes = await fetch(jsonUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(10000),
          });
          if (jsonRes.ok) {
            const jsonData = await jsonRes.json();
            const rawEvents = jsonData.events || (Array.isArray(jsonData) ? jsonData : []);
            for (const ev of rawEvents) {
              if (!ev.eventDateTime) continue;
              const eventDate = new Date(ev.eventDateTime);
              if (isNaN(eventDate.getTime()) || eventDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) continue;

              const title = (ev.title?.eventTitleText || ev.title?.headlinersText || (typeof ev.title === "string" ? ev.title : "Concert")).replace(/<[^>]+>/g, "").trim();
              const venueName = ev.venue?.title || fallbackCity;
              const cityName = ev.venue?.city || fallbackCity;
              const stateName = ev.venue?.state || fallbackState;
              const ticketUrl = ev.ticketing?.ticketURL || ev.ticketing?.url || ev.ticketing?.eventUrl || url;
              const flyerUrl = ev.media?.["17"]?.file_name || ev.media?.["86"]?.file_name || (ev.media ? (Object.values(ev.media)[0] as any)?.file_name : undefined);
              const desc = (ev.bio || ev.description || `${title} live in concert at ${venueName}.`).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

              eventsFound.push({
                title,
                venue: venueName,
                cityName,
                stateName,
                category: categorizeEvent(title, desc),
                startTime: ev.eventDateTime ? new Date(ev.eventDateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "7:00 PM",
                eventDate,
                details: desc,
                officialInfoUrl: ticketUrl,
                eventFlyerUrl: flyerUrl,
                source: url,
              });
            }
          }
        } catch (err: any) {
          console.error(`[AEG_FEED_ERROR] Error fetching ${jsonUrl}:`, err.message);
        }
      }
    }

    // 1b-2. Living On The Cheap (LOTC) Network Calendars
    // Handles BOTH static server-rendered master calendars (/events/) and dynamic multi-day AJAX calendars
    const isLotcPage =
      $(".lotc-v2").length > 0 ||
      $("h2.lotc-event").length > 0 ||
      $(".lotc-event-list").length > 0 ||
      html.includes("lotc-event-load") ||
      html.includes("lotc-cms");

    if (eventsFound.length === 0 && isLotcPage) {
      try {
        // (A) First: Parse static server-rendered event rows (e.g. master /events/ calendar pages)
        if ($(".lotc-v2").length > 0 || $("h2.lotc-event").length > 0) {
          let currentDate: Date | null = null;
          $("h2.lotc-event, div.lotc-v2").each((_, el) => {
            if ($(el).is("h2.lotc-event")) {
              const text = $(el).text().trim();
              const match = text.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}/i);
              if (match) {
                currentDate = new Date(`${match[0]} 12:00:00 UTC`);
              }
            } else if ($(el).hasClass("lotc-v2") && currentDate) {
              const title = $(el).find("h3 a").text().trim().replace(/\s+/g, " ");
              const detailUrl = $(el).find("h3 a").attr("href") || "";
              const meta = $(el).find(".meta").text().trim().replace(/\s+/g, " ");
              if (!title || isGenericCalendarHeader(title)) return;

              if (detailUrl && detailUrl.startsWith("http")) {
                subUrls.push(detailUrl);
              }

              const parts = meta.split("|").map((s) => s.trim());
              let startTime = "All Day";
              const timePart = parts[0] || "";
              const timeMatch =
                timePart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
                timePart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
              if (timeMatch) {
                let t = timeMatch[1].trim();
                if (!/am|pm/i.test(t)) {
                  const endAmPm = timeMatch[2]?.match(/am|pm/i)?.[0] || "pm";
                  t += " " + endAmPm;
                }
                startTime = t.toUpperCase();
              }

              let rawVenue = parts.length >= 3 ? parts[2] : (parts.length === 2 && !/free|\$|discount|admission|donation/i.test(parts[1]) ? parts[1] : `${fallbackCity || "Local"} Venue`);
              let eventCity = fallbackCity || "Local";
              let eventState = fallbackState || "";
              let venueAddress: string | undefined;

              if (rawVenue.includes(",")) {
                const vParts = rawVenue.split(",").map((s) => s.trim());
                if (vParts.length === 2 && vParts[1].length < 30) {
                  rawVenue = vParts[0];
                  eventCity = vParts[1];
                }
              }

              if (/^\d+\s+[A-Za-z0-9\s]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Pkwy|Drive|Dr)/i.test(rawVenue)) {
                venueAddress = `${rawVenue}, ${eventCity}, ${eventState}`;
              }

              eventsFound.push({
                title,
                cityName: eventCity,
                stateName: eventState,
                venue: rawVenue,
                venueAddress,
                category: categorizeEvent(title, meta),
                startTime,
                eventDate: currentDate,
                details: `${title} - ${meta}. Community event in ${eventCity}, ${eventState}.`,
                officialInfoUrl: detailUrl || url,
                source: url,
              });
            }
          });
        }

        // (B) Second: Dynamic AJAX calendar lists (e.g. 30-day feeds and curated post embeds)
        if ($(".lotc-event-list").length > 0 || html.includes("lotc-event-load")) {
          const batched: any[] = [];
          $(".lotc-event-list").each((_, el) => {
            const $el = $(el);
            const myclass = $el.data("class");
            const date = $el.data("date");
            const span = $el.data("span");
            const format = $el.data("format");
            const month = $el.data("month");
            const year = $el.data("year");
            const limit = $el.data("limit");
            const show = $el.data("show");
            const mylocation = $el.data("location");
            const category = $el.data("category");
            const mytag = $el.data("tag");
            const isfree = $el.data("free");
            const settings = {
              _date: date,
              _span: span,
              _format: format,
              _month: month,
              _year: year,
              _limit: limit,
              _show: show,
              _location: mylocation,
              _category: category,
              _tag: mytag,
              _free: isfree,
            };
            batched.push({
              class: myclass,
              date: settings._date,
              format: settings._format,
              free: settings._free,
              limit: settings._limit,
              location: settings._location,
              category: settings._category,
              tag: settings._tag,
              show: settings._show,
              settings: settings,
            });
          });

          if (batched.length > 0) {
            const origin = new URL(url).origin;
            const ajaxUrlMatch = html.match(/["'](https?:[^"']*admin-ajax\.php)["']/);
            let ajaxUrl = ajaxUrlMatch ? ajaxUrlMatch[1].replace(/\\/g, "") : `${origin}/wp-admin/admin-ajax.php`;
            const chunkSize = 10;

            for (let i = 0; i < batched.length; i += chunkSize) {
              const chunk = batched.slice(i, i + chunkSize);
              const params = new URLSearchParams();
              params.append("action", "load_multi_days");
              params.append("requests", JSON.stringify(chunk));

              let ajaxRes: any;
              try {
                ajaxRes = await axios.post(ajaxUrl, params.toString(), {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    Referer: url,
                  },
                  timeout: 12000,
                });
              } catch (postErr: any) {
                if (postErr.response?.status === 404) {
                  const altUrl = ajaxUrl.includes("lotc-cms")
                    ? `${origin}/wp-admin/admin-ajax.php`
                    : `${origin}/lotc-cms/wp-admin/admin-ajax.php`;
                  ajaxRes = await axios.post(altUrl, params.toString(), {
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                      "X-Requested-With": "XMLHttpRequest",
                      Referer: url,
                    },
                    timeout: 12000,
                  });
                } else {
                  throw postErr;
                }
              }

              if (ajaxRes.data && ajaxRes.data.success && ajaxRes.data.data?.results) {
              for (const [_, snippet] of Object.entries(ajaxRes.data.data.results as Record<string, string>)) {
                if (!snippet) continue;
                const $s = cheerio.load(snippet);
                const dayHeader = $s("h3").first().text().trim();
                let eventDate: Date | null = null;
                if (dayHeader) {
                  const dateMatch = dayHeader.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
                  if (dateMatch) {
                    eventDate = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]} 12:00:00 UTC`);
                  }
                }

                $s(".event, .lotc-v2").each((__, evEl) => {
                  const title = $s(evEl).find("h3 a").text().trim().replace(/\s+/g, " ");
                  const detailUrl = $s(evEl).find("h3 a").attr("href") || "";
                  const meta = $s(evEl).find(".meta").text().trim().replace(/\s+/g, " ");
                  if (!title) return;

                  if (detailUrl && detailUrl.startsWith("http")) {
                    subUrls.push(detailUrl);
                  }

                  // Parse time from meta string (e.g. "4:00 pm to 6:00 pm | FREE | Pritchard...")
                  let startTime = "All Day";
                  const parts = meta.split("|").map((s) => s.trim());
                  const timePart = parts[0] || "";
                  const timeMatch = timePart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
                  if (timeMatch) {
                    let t = timeMatch[1].trim();
                    if (!/am|pm/i.test(t)) {
                      const endAmPm = timeMatch[2].match(/am|pm/i)?.[0] || "pm";
                      t += " " + endAmPm;
                    }
                    startTime = t.toUpperCase();
                  } else {
                    const singleTime = timePart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
                    if (singleTime) startTime = singleTime[1].toUpperCase();
                  }

                  let rawVenue = parts[parts.length - 1] || "Charlotte Venue";
                  let eventCity = fallbackCity || "Charlotte";
                  let eventState = fallbackState || "NC";
                  let venueAddress: string | undefined;

                  // Check if venue ends with city name, e.g. "Gibson Mill, Concord"
                  const commaParts = rawVenue.split(",").map((s) => s.trim());
                  if (commaParts.length > 1) {
                    const candidateCity = commaParts[commaParts.length - 1];
                    const knownCities = [
                      "Charlotte", "Concord", "Huntersville", "Matthews", "Gastonia",
                      "Kannapolis", "Albemarle", "Pineville", "Mint Hill", "Mooresville",
                      "Davidson", "Cornelius", "Rock Hill", "Fort Mill"
                    ];
                    const matchedCity = knownCities.find((c) => c.toLowerCase() === candidateCity.toLowerCase());
                    if (matchedCity) {
                      eventCity = matchedCity;
                      rawVenue = commaParts.slice(0, commaParts.length - 1).join(", ");
                    }
                  }

                  // Specific venue enrichment
                  const lowerVen = rawVenue.toLowerCase();
                  if (lowerVen.includes("birkdale")) {
                    eventCity = "Huntersville";
                    venueAddress = "8712 Lindholm Dr, Huntersville, NC 28078";
                  } else if (lowerVen.includes("cabarrus arena")) {
                    eventCity = "Concord";
                    venueAddress = "4751 NC-49, Concord, NC 28025";
                  } else if (lowerVen.includes("gibson mill")) {
                    eventCity = "Concord";
                    venueAddress = "305 McGill Ave NW, Concord, NC 28027";
                  } else if (lowerVen.includes("pritchard memorial")) {
                    eventCity = "Charlotte";
                    venueAddress = "1117 South Blvd, Charlotte, NC 28203";
                  } else if (lowerVen.includes("rea farms")) {
                    eventCity = "Charlotte";
                    venueAddress = "9855 Sandy Rock Pl, Charlotte, NC 28277";
                  } else if (lowerVen.includes("promenade on providence")) {
                    eventCity = "Charlotte";
                    venueAddress = "10844 Providence Rd, Charlotte, NC 28277";
                  } else if (lowerVen.includes("arboretum")) {
                    eventCity = "Charlotte";
                    venueAddress = "8008 Providence Rd, Charlotte, NC 28277";
                  } else if (lowerVen.includes("research campus")) {
                    eventCity = "Kannapolis";
                    venueAddress = "150 N Research Campus Dr, Kannapolis, NC 28081";
                  } else if (lowerVen.includes("caromont")) {
                    eventCity = "Gastonia";
                    venueAddress = "800 W Franklin Blvd, Gastonia, NC 28052";
                  } else if (lowerVen.includes("matthews umc") || lowerVen.includes("matthews united")) {
                    eventCity = "Matthews";
                    venueAddress = "801 S Trade St, Matthews, NC 28105";
                  } else if (lowerVen.includes("frank liske")) {
                    eventCity = "Concord";
                    venueAddress = "4001 Stough Rd, Concord, NC 28027";
                  } else if (lowerVen.includes("cabarrus brewing")) {
                    eventCity = "Concord";
                    venueAddress = "329 McGill Ave NW, Concord, NC 28027";
                  } else if (lowerVen.includes("concord convention")) {
                    eventCity = "Concord";
                    venueAddress = "5400 John Q. Hammons Dr NW, Concord, NC 28027";
                  } else if (/^\d+\s+[A-Za-z0-9\s]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Pkwy|Drive|Dr)/i.test(rawVenue)) {
                    venueAddress = `${rawVenue}, ${eventCity}, ${eventState}`;
                  }

                  if (eventDate) {
                    const isDup = eventsFound.some(
                      (e) =>
                        e.title.toLowerCase() === title.toLowerCase() &&
                        e.eventDate?.toISOString().split("T")[0] === eventDate.toISOString().split("T")[0]
                    );
                    if (!isDup) {
                      eventsFound.push({
                        title,
                        cityName: eventCity,
                        stateName: eventState,
                        venue: rawVenue,
                        venueAddress,
                        category: categorizeEvent(title, meta),
                        startTime,
                        eventDate,
                        details: `${title} - ${meta}. Community event in ${eventCity}, ${eventState}.`,
                        officialInfoUrl: detailUrl || url,
                        source: url,
                      });
                    }
                  }
                });
              }
            }
          }
        }
      }
    } catch (lotcErr: any) {
        console.error(`[LOTC_FEED_ERROR] Error fetching LOTC events:`, lotcErr.message);
      }
    }

    // 1c. Fallback: Standard DOM Event Card Parsing (for theater, arena, and arts pages without JSON-LD)
    if (eventsFound.length === 0) {
      const cardSelectors = [
        ".rhpSingleEvent",
        ".eventWrapper",
        ".rhp-event__single-event--list",
        ".eventItem",
        ".event-item",
        ".event_item",
        ".event-card",
        ".eventCard",
        ".events-card",
        "article.event",
        ".show-item",
        ".c-card--event",
        ".eventlist-event",
        "article.hentry",
        ".event_list .entry",
        ".entry",
      ];

      for (const sel of cardSelectors) {
        const cards = $(sel);
        if (cards.length > 0) {
          cards.each((_, el) => {
            let title = $(el)
              .find(".rhp-event__title--list, h2 a, h3 a, h4 a, .title a, .event-title a, h2, h3, h4, .title, .event-title")
              .first()
              .text()
              .trim();
            title = title.split("\t")[0].trim().replace(/\s+/g, " ");
            const dateText = $(el)
              .find(".eventDateListTop, .rhp-event__date--list, .date, .event-date, time, [class*='date']")
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
            let venueName = $(el)
              .find(
                ".event_venue, .event-venue, .rhp-event__venue--list, .rhp-event-info, .venue, .location, [class*='event_venue'], [class*='event-venue'], [class*='venue'], [class*='location']"
              )
              .first()
              .text()
              .replace(/\s+/g, " ")
              .trim();

            if (venueName.includes("Richmond Music Hall")) venueName = "Richmond Music Hall";
            else if (venueName.includes("The Broadberry")) venueName = "The Broadberry";

            // If card lacks venue or picked up a generic label, check page h1 but only if it's NOT a generic heading
            if (!venueName || isGenericCalendarHeader(venueName)) {
              const h1Candidate = $("h1").first().text().replace(/\s+/g, " ").trim();
              if (h1Candidate && !isGenericCalendarHeader(h1Candidate)) {
                venueName = h1Candidate;
              } else {
                venueName = "";
              }
            }

            let venueAddress: string | undefined;
            let cardCity = fallbackCity;
            let cardState = fallbackState;

            // Known Performing Arts Centers & Complex Venues
            if (url.includes("blumenthalarts.org")) {
              cardCity = "Charlotte";
              cardState = "NC";
              const lowerVen = venueName.toLowerCase();
              if (lowerVen.includes("knight")) {
                venueName = "Knight Theater";
                venueAddress = "430 S Tryon St, Charlotte, NC 28202";
              } else if (lowerVen.includes("belk")) {
                venueName = "Belk Theater";
                venueAddress = "130 N Tryon St, Charlotte, NC 28202";
              } else if (lowerVen.includes("booth")) {
                venueName = "Booth Playhouse";
                venueAddress = "130 N Tryon St, Charlotte, NC 28202";
              } else if (lowerVen.includes("stage door")) {
                venueName = "Stage Door Theater";
                venueAddress = "155 N College St, Charlotte, NC 28202";
              } else if (lowerVen.includes("blume")) {
                venueName = "Stage 2 at Blume Studios";
                venueAddress = "904 Post St, Charlotte, NC 28208";
              } else if (lowerVen.includes("dance") || lowerVen.includes("mcbride") || lowerVen.includes("bonnefoux")) {
                venueName = "Patricia McBride & Jean-Pierre Bonnefoux Center for Dance";
                venueAddress = "701 N Tryon St, Charlotte, NC 28202";
              } else if (lowerVen.includes("ovens")) {
                venueName = "Ovens Auditorium";
                venueAddress = "2700 E Independence Blvd, Charlotte, NC 28205";
              } else {
                venueName = "Belk Theater at Blumenthal Arts";
                venueAddress = "130 N Tryon St, Charlotte, NC 28202";
              }
            } else if (url.includes("pikespeakcenter.com")) {
              venueName = "Pikes Peak Center";
              venueAddress = "190 S Cascade Ave, Colorado Springs, CO 80903";
              cardCity = "Colorado Springs";
              cardState = "CO";
            } else if (url.includes("comericacenter.com")) {
              venueName = "Comerica Center";
              venueAddress = "2601 Avenue of the Stars, Frisco, TX 75034";
              cardCity = "Frisco";
              cardState = "TX";
            }

            if (!venueName) {
              venueName = cardCity ? `${cardCity} Venue` : "Local Venue";
            }

            const atVenueStr = venueName && venueName !== "Local Venue" ? ` at ${venueName}` : "";
            const inLocationStr = cardCity ? ` in ${cardCity}${cardState ? `, ${cardState}` : ""}` : "";
            const details = tagline
              ? `${title} - ${tagline}. Live${atVenueStr}${inLocationStr}.`
              : `${title} live${atVenueStr}${inLocationStr}.`;

            eventsFound.push({
              title,
              cityName: cardCity,
              stateName: cardState,
              venue: venueName,
              venueAddress,
              category,
              startTime: "7:30 PM",
              eventDate: parsedDate,
              details,
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
          href.includes("/events-this-month") ||
          href.includes("/calendar/") ||
          href.includes("/shows/") ||
          href.includes("/happenings/") ||
          href.includes("weekend") ||
          href.includes("things-to-do"))
      ) {
        try {
          const parsed = new URL(href, url);
          if (
            isValidCalendarSourceUrl(parsed.href) &&
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
    countryCode?: string | null;
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
      const fullText = `${ev.title} ${ev.details || ''} ${ev.source || ''} ${ev.officialInfoUrl || ''}`.toLowerCase();
      if (/\b(x-rated|erotic|onlyfans|porn|fetish|swinger|nsfw|strip club)\b/i.test(fullText)) {
        stats.skipped++;
        continue;
      }
      if (/\b(online event|virtual event|virtual book fair|virtual book club|livestream|webinar|zoom meeting)\b/i.test(fullText)) {
        stats.skipped++;
        continue;
      }

      // Guard: Exclude operational / business / facility hours (e.g. "Hours of Operation")
      if (
        /\b(hours of operation|operating hours|facility hours|open daily|park hours|visitor center hours|guest services hours|box office hours|business hours)\b/i.test(
          ev.title
        )
      ) {
        stats.skipped++;
        continue;
      }

      // Guard: Require valid city name
      if (!ev.cityName || ev.cityName.trim().length === 0) {
        stats.skipped++;
        continue;
      }

      // Guard: Reject empty non-events with no venue address, no flyer, no details, and no info URL
      const hasDetails = !!(ev.details && ev.details.trim().length > 15 && ev.details.trim() !== ev.title.trim());
      const hasAddress = !!(ev.venueAddress && ev.venueAddress.trim().length > 0);
      const hasFlyer = !!(ev.eventFlyerUrl && ev.eventFlyerUrl.trim().length > 0);
      const hasInfo = !!(ev.officialInfoUrl && ev.officialInfoUrl.trim().length > 0);
      if (!hasAddress && !hasFlyer && !hasDetails && !hasInfo) {
        stats.skipped++;
        continue;
      }

      const normCity = ev.cityName.toLowerCase().trim();

      // Multi-signal deduplication: query candidates on same calendar date & city
      const existingCandidates = await db
        .select({
          id: events.id,
          title: events.title,
          category: events.category,
          venue: events.venue,
          venue_address: events.venueAddress,
          start_time: events.startTime,
          event_date: events.eventDate,
          event_flyer_url: events.eventFlyerUrl,
          details: events.details,
          official_info_url: events.officialInfoUrl,
          registration_url: events.registrationUrl,
          hosting_entity: events.hostingEntity,
          city_name: events.cityName,
          source: events.source
        })
        .from(events)
        .where(
          and(
            sql`LOWER(${events.cityName}) = ${normCity}`,
            sql`DATE(${events.eventDate}) = DATE(${ev.eventDate})`
          )
        );

      let matchedCandidate: any = null;
      for (const cand of existingCandidates) {
        const check = areEventsDuplicates(cand, ev as any);
        if (check.isDuplicate) {
          matchedCandidate = cand;
          break;
        }
      }

      if (matchedCandidate) {
        stats.skipped++;
        // Golden Record Enrichment: backfill missing/superior data from incoming source into existing master
        const merged = mergeEventRecords(matchedCandidate, ev as any);
        const updates: any = {};
        if (!matchedCandidate.event_flyer_url && (merged.event_flyer_url || merged.eventFlyerUrl)) {
          updates.eventFlyerUrl = merged.event_flyer_url || merged.eventFlyerUrl;
        }
        if ((!matchedCandidate.venue_address || matchedCandidate.venue_address === 'null') && (merged.venue_address || merged.venueAddress)) {
          updates.venueAddress = merged.venue_address || merged.venueAddress;
        }
        if ((!matchedCandidate.details || matchedCandidate.details.length < 20) && merged.details && merged.details.length > 20) {
          updates.details = merged.details;
        }
        if (!matchedCandidate.official_info_url && (merged.official_info_url || merged.officialInfoUrl)) {
          updates.officialInfoUrl = merged.official_info_url || merged.officialInfoUrl;
        }
        if (!matchedCandidate.registration_url && (merged.registration_url || merged.registrationUrl)) {
          updates.registrationUrl = merged.registration_url || merged.registrationUrl;
        }
        if (Object.keys(updates).length > 0) {
          await db.update(events).set(updates).where(eq(events.id, matchedCandidate.id));
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
            admin1: ev.stateName || null,
            countryCode: (ev as any).countryCode || null,
            countryName: (ev as any).countryName || null,
            latitude: ev.latitude || null,
            longitude: ev.longitude || null,
            timezone: null,
            population: 10000,
          })
          .onConflictDoNothing();
        stats.birthedCities++;
      }

      // 2. Only insert new event into events table if CURRENT or UPCOMING
      const isPastEvent = ev.eventDate && new Date(ev.eventDate).getTime() < (Date.now() - 86400000);
      let insertedEvent: { id: number } | undefined;

      let venue = ev.venue;
      let venueAddress = ev.venueAddress || null;
      let cityName = ev.cityName;
      let stateName = ev.stateName || null;

      // Enrich Whitewater Center events if venue defaulted to Local Venue
      if (
        (ev.source?.includes("whitewater.org") || ev.officialInfoUrl?.includes("whitewater.org")) &&
        (venue === "Local Venue" || !venue || isGenericCalendarHeader(venue))
      ) {
        venue = "U.S. National Whitewater Center";
        venueAddress = "5000 Whitewater Center Pkwy, Charlotte, NC 28214";
        cityName = "Charlotte";
        stateName = "NC";
      }

      // Enrich Blumenthal Arts events
      if (ev.source?.includes("blumenthalarts.org") || ev.officialInfoUrl?.includes("blumenthalarts.org")) {
        cityName = "Charlotte";
        stateName = "NC";
        const lowerVen = (venue || "").toLowerCase();
        if (lowerVen.includes("knight")) {
          venue = "Knight Theater";
          venueAddress = "430 S Tryon St, Charlotte, NC 28202";
        } else if (lowerVen.includes("belk")) {
          venue = "Belk Theater";
          venueAddress = "130 N Tryon St, Charlotte, NC 28202";
        } else if (lowerVen.includes("booth")) {
          venue = "Booth Playhouse";
          venueAddress = "130 N Tryon St, Charlotte, NC 28202";
        } else if (lowerVen.includes("stage door")) {
          venue = "Stage Door Theater";
          venueAddress = "155 N College St, Charlotte, NC 28202";
        } else if (lowerVen.includes("blume")) {
          venue = "Stage 2 at Blume Studios";
          venueAddress = "904 Post St, Charlotte, NC 28208";
        } else if (lowerVen.includes("dance") || lowerVen.includes("mcbride") || lowerVen.includes("bonnefoux")) {
          venue = "Patricia McBride & Jean-Pierre Bonnefoux Center for Dance";
          venueAddress = "701 N Tryon St, Charlotte, NC 28202";
        } else if (lowerVen.includes("ovens")) {
          venue = "Ovens Auditorium";
          venueAddress = "2700 E Independence Blvd, Charlotte, NC 28205";
        } else if (!venue || isGenericCalendarHeader(venue) || venue === "Local Venue") {
          venue = "Belk Theater at Blumenthal Arts";
          venueAddress = "130 N Tryon St, Charlotte, NC 28202";
        }
      }

      // Enrich Pikes Peak Center
      if (ev.source?.includes("pikespeakcenter.com") || ev.officialInfoUrl?.includes("pikespeakcenter.com")) {
        venue = "Pikes Peak Center";
        venueAddress = "190 S Cascade Ave, Colorado Springs, CO 80903";
        cityName = "Colorado Springs";
        stateName = "CO";
      }

      // Enrich Comerica Center
      if (ev.source?.includes("comericacenter.com") || ev.officialInfoUrl?.includes("comericacenter.com")) {
        venue = "Comerica Center";
        venueAddress = "2601 Avenue of the Stars, Frisco, TX 75034";
        cityName = "Frisco";
        stateName = "TX";
      }

      // Catch-all: reject generic calendar headers as venue names
      if (isGenericCalendarHeader(venue)) {
        if (context?.venueName && !isGenericCalendarHeader(context.venueName)) {
          venue = context.venueName;
        } else {
          venue = cityName ? `${cityName} Venue` : "Local Venue";
        }
      }

      let cleanDetails = cleanHtmlEntitiesAndTags(ev.details) || `${ev.title} at ${venue}.`;
      if (cleanDetails.includes("Events & Tickets")) {
        cleanDetails = cleanDetails.replace(/Live at Events & Tickets\./gi, `Live at ${venue} in ${cityName}, ${stateName}.`);
        cleanDetails = cleanDetails.replace(/Events & Tickets/gi, venue);
      }

      if (!isPastEvent) {
        const [res] = await db
          .insert(events)
          .values({
            title: ev.title,
            cityName,
            stateName,
            category: ev.category,
            venue,
            venueAddress,
            hostingEntity: ev.hostingEntity || ev.organizerName || null,
            startTime: ev.startTime,
            eventDate: ev.eventDate,
            details: cleanDetails,
            officialInfoUrl: ev.officialInfoUrl,
            eventFlyerUrl: ev.eventFlyerUrl,
            status: "live",
            source: ev.source || "Automated Calendar Crawler",
          })
          .returning({ id: events.id });

        insertedEvent = res;
        stats.ingested++;
      }

      // 3. Upsert Venue Entity into graph
      let venueEntityId: number | undefined;
      if (ev.venue && ev.venue !== "Local Venue") {
        venueEntityId = await upsertEntity({
          name: ev.venue,
          entityType: "venue",
          cityName: ev.cityName,
          stateName: ev.stateName || undefined,
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
              stateName: ev.stateName || null,
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
          stateName: ev.stateName || undefined,
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
          stateName: ev.stateName || undefined,
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
              stateName: ev.stateName || null,
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
          stateName: ev.stateName || undefined,
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
    const state = context?.stateName || extractedEvents[0]?.stateName || null;
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
            countryCode: context?.countryCode || null,
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
