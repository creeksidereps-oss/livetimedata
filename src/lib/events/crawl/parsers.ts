// src/lib/events/crawl/parsers.ts
//
// Pure, network-free parsers. Each takes page/feed content + the URL it came from and returns
// ExtractedEvent[]. Location fields are filled ONLY from what the content itself states for that event.
//
// Strategies: schema.org JSON-LD, The Events Calendar (Tribe) WP REST, iCalendar (.ics),
// AEG/AXS data-file JSON feeds, Simpleview/ASM REST docs, DOM event cards, HTML table calendars.
// Dropped on purpose: Bandsintown / artist tour widgets (banned aggregator), the domain->city map,
// hardcoded venue "enrichment" tables, festival "decomposition" into invented sub-events, and every
// templated description.

import type { CheerioAPI } from "cheerio";
import type { ExtractedEvent, ExtractionStrategy } from "./types";
import {
  addEmail, categorizeEvent, cleanHtmlEntitiesAndTags, isTicketBrokerUrl, isValidCalendarSourceUrl, cleanStr, collectEmails, formatTimeFromDate, isAdultContent,
  isClearlyPast, isGenericCalendarHeader, isNonEventTitle, isOnlineOrVirtualEvent, isoDateFromSource, joinAddress,
  parseHumanDateString, parseStartTime, toNum,
} from "./helpers";

function absUrl(u: unknown, base: string): string | undefined {
  if (typeof u !== "string" || !u.trim()) return undefined;
  try {
    return new URL(u.trim(), base).href;
  } catch {
    return undefined;
  }
}

/** Common acceptance checks. Returns false if the event must be dropped. */
function acceptable(ev: Pick<ExtractedEvent, "title" | "details" | "venue" | "eventDate" | "officialInfoUrl">): boolean {
  if (!ev.title || ev.title.length < 3 || ev.title.length > 250) return false;
  if (!ev.eventDate || isClearlyPast(ev.eventDate)) return false; // current & future only
  if (isNonEventTitle(ev.title)) return false;
  if (isOnlineOrVirtualEvent(ev.title, ev.details, ev.venue, ev.officialInfoUrl)) return false;
  if (isAdultContent(`${ev.title} ${ev.details} ${ev.officialInfoUrl || ""}`)) return false;
  return true;
}

function make(base: Omit<ExtractedEvent, "category"> & { category?: string }): ExtractedEvent {
  const out: ExtractedEvent = { ...base, category: base.category || categorizeEvent(base.title, base.details) };
  // Normalise empty location strings to undefined so "absent" is unambiguous.
  for (const k of ["city", "region", "country", "address"] as const) {
    const v = cleanStr(out[k]);
    if (v) out[k] = v;
    else delete out[k];
  }
  if (out.lat === undefined || out.lon === undefined) {
    delete out.lat;
    delete out.lon;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. schema.org JSON-LD
// ---------------------------------------------------------------------------

function isEventType(t: unknown): boolean {
  const list = Array.isArray(t) ? t : [t];
  return list.some((x) => typeof x === "string" && (/Event$/.test(x) || x === "Festival"));
}

function pickImage(img: any): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return pickImage(img[0]);
  if (typeof img === "object") return img.url || img.contentUrl;
  return undefined;
}

function textOf(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return cleanStr(v);
  if (typeof v === "object") return cleanStr(v.name || v["@value"] || "");
  return "";
}

/** Location of one schema.org Event, exactly as stated. */
export function jsonLdLocation(location: any): {
  venue: string; venueUrl?: string; city?: string; region?: string; country?: string; address?: string; lat?: number; lon?: number; virtualOnly: boolean;
} {
  const out: ReturnType<typeof jsonLdLocation> = { venue: "", virtualOnly: false };
  if (!location) return out;
  const list = Array.isArray(location) ? location : [location];
  const physical = list.filter((l) => !(l && typeof l === "object" && l["@type"] === "VirtualLocation"));
  if (!physical.length) {
    out.virtualOnly = true;
    return out;
  }
  const loc = physical[0];
  if (typeof loc === "string") {
    // A bare string location: venue name or free-text address, as written.
    const s = cleanStr(loc);
    if (/\d/.test(s) && s.includes(",")) out.address = s;
    else out.venue = s;
    return out;
  }
  if (typeof loc !== "object") return out;
  out.venue = cleanStr(loc.name);
  out.venueUrl = typeof loc.url === "string" ? loc.url : typeof loc.sameAs === "string" ? loc.sameAs : undefined;
  const addr = loc.address;
  if (typeof addr === "string") {
    out.address = cleanStr(addr);
  } else if (addr && typeof addr === "object") {
    const a = Array.isArray(addr) ? addr[0] || {} : addr;
    out.city = textOf(a.addressLocality);
    out.region = textOf(a.addressRegion);
    out.country = textOf(a.addressCountry);
    const regionPostal = [textOf(a.addressRegion), textOf(a.postalCode)].filter(Boolean).join(" ");
    out.address = joinAddress(textOf(a.streetAddress), textOf(a.addressLocality), regionPostal, textOf(a.addressCountry));
  }
  const geo = loc.geo;
  if (geo && typeof geo === "object") {
    out.lat = toNum(geo.latitude);
    out.lon = toNum(geo.longitude);
  }
  return out;
}

export function parseJsonLdEvents($: CheerioAPI, pageUrl: string, emails?: Set<string>): ExtractedEvent[] {
  const found: ExtractedEvent[] = [];

  function processObj(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) return obj.forEach(processObj);
    if (Array.isArray(obj["@graph"])) return obj["@graph"].forEach(processObj);
    if (Array.isArray(obj.itemListElement)) {
      obj.itemListElement.forEach((item: any) => processObj(item?.item || item));
      return;
    }

    if (emails) {
      addEmail(obj.email, emails);
      if (obj.organizer && typeof obj.organizer === "object") addEmail(obj.organizer.email, emails);
      if (obj.location && typeof obj.location === "object") addEmail(obj.location.email, emails);
    }

    if (obj.subEvent) (Array.isArray(obj.subEvent) ? obj.subEvent : [obj.subEvent]).forEach(processObj);
    if (Array.isArray(obj.subEvents)) obj.subEvents.forEach(processObj);

    if (!isEventType(obj["@type"]) || !obj.name || !obj.startDate) return;
    if (String(obj.eventAttendanceMode || "").includes("OnlineEventAttendanceMode")) return;
    if (/EventCancelled|EventPostponed/i.test(String(obj.eventStatus || ""))) return;

    const loc = jsonLdLocation(obj.location);
    if (loc.virtualOnly) return;

    const title = cleanStr(obj.name);
    const details = cleanHtmlEntitiesAndTags(obj.description || "");
    const eventDate = isoDateFromSource(String(obj.startDate));
    if (!eventDate) return;

    let performerName: string | undefined;
    let performerUrl: string | undefined;
    const perf = Array.isArray(obj.performer) ? obj.performer[0] : obj.performer;
    if (typeof perf === "string") performerName = cleanStr(perf);
    else if (perf && typeof perf === "object") {
      performerName = cleanStr(perf.name) || undefined;
      performerUrl = perf.url || perf.sameAs;
    }

    let organizerName: string | undefined;
    let organizerUrl: string | undefined;
    const org = Array.isArray(obj.organizer) ? obj.organizer[0] : obj.organizer;
    if (typeof org === "string") organizerName = cleanStr(org);
    else if (org && typeof org === "object") {
      organizerName = cleanStr(org.name) || undefined;
      organizerUrl = org.url || org.sameAs;
    }

    const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
    const ev = make({
      title,
      details,
      venue: loc.venue,
      startTime: formatTimeFromDate(String(obj.startDate)),
      eventDate,
      city: loc.city,
      region: loc.region,
      country: loc.country,
      address: loc.address,
      lat: loc.lat,
      lon: loc.lon,
      sourceUrl: pageUrl,
      officialInfoUrl: absUrl(obj.url, pageUrl) || absUrl(offers?.url, pageUrl) || pageUrl,
      eventFlyerUrl: absUrl(pickImage(obj.image), pageUrl),
      performerName,
      performerUrl: typeof performerUrl === "string" ? performerUrl : undefined,
      organizerName,
      organizerUrl: typeof organizerUrl === "string" ? organizerUrl : undefined,
      venueUrl: loc.venueUrl,
      strategy: "jsonld",
    });
    if (acceptable(ev)) found.push(ev);
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html();
    if (!text) return;
    try {
      processObj(JSON.parse(text));
    } catch {
      /* malformed JSON-LD block: skip */
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// 2. The Events Calendar (Tribe) WordPress REST API: /wp-json/tribe/events/v1/events
// ---------------------------------------------------------------------------

export function parseTribeEvents(json: any, pageUrl: string, emails?: Set<string>): ExtractedEvent[] {
  const list: any[] = Array.isArray(json?.events) ? json.events : Array.isArray(json) ? json : [];
  const out: ExtractedEvent[] = [];
  for (const e of list) {
    if (!e || (e.status && e.status !== "publish")) continue;
    const title = cleanStr(e.title);
    const start = String(e.start_date || "");
    const eventDate = isoDateFromSource(start);
    if (!title || !eventDate) continue;

    const v = e.venue && !Array.isArray(e.venue) && typeof e.venue === "object" ? e.venue : null;
    const city = cleanStr(v?.city);
    const region = cleanStr(v?.state) || cleanStr(v?.province) || cleanStr(v?.stateprovince);
    const country = cleanStr(v?.country);
    const regionPostal = [region, cleanStr(v?.zip)].filter(Boolean).join(" ");
    const address = v ? joinAddress(v.address, city, regionPostal, country) : "";

    const orgs = Array.isArray(e.organizer) ? e.organizer : e.organizer ? [e.organizer] : [];
    const org = orgs[0] && typeof orgs[0] === "object" ? orgs[0] : null;
    if (emails) {
      if (org?.email) addEmail(cleanHtmlEntitiesAndTags(org.email), emails);
      if (v?.email) addEmail(v.email, emails);
    }

    const ev = make({
      title,
      details: cleanHtmlEntitiesAndTags(e.description || e.excerpt || ""),
      venue: cleanStr(v?.venue),
      startTime: e.all_day === true ? "All Day" : formatTimeFromDate(start),
      eventDate,
      city,
      region,
      country,
      address,
      lat: toNum(v?.geo_lat),
      lon: toNum(v?.geo_lng),
      sourceUrl: pageUrl,
      officialInfoUrl: absUrl(e.url, pageUrl) || absUrl(e.website, pageUrl) || pageUrl,
      eventFlyerUrl: absUrl(e.image?.url, pageUrl),
      contactPhone: cleanStr(org?.phone) || cleanStr(v?.phone) || undefined,
      organizerName: cleanStr(org?.organizer) || undefined,
      organizerUrl: absUrl(org?.website, pageUrl),
      venueUrl: absUrl(v?.website, pageUrl),
      strategy: "tribe_rest",
    });
    if (acceptable(ev)) out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. iCalendar (.ics): VEVENT SUMMARY / DTSTART / DESCRIPTION / LOCATION / GEO / URL
// ---------------------------------------------------------------------------

function icsUnescape(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Wall-clock parts of a UTC instant in an IANA timezone. */
function zonedParts(d: Date, tz: string): { date: string; h: number; m: number } | null {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, h: parseInt(p.hour, 10), m: parseInt(p.minute, 10) };
  } catch {
    return null;
  }
}

export function parseICalEvents(ics: string, pageUrl: string): ExtractedEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(ics)) return [];
  // Unfold continuation lines (RFC 5545 §3.1)
  const lines = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const calTz = (lines.find((l) => /^X-WR-TIMEZONE[:;]/i.test(l)) || "").split(":").slice(1).join(":").trim() || null;

  const out: ExtractedEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const ev = icsToEvent(cur, pageUrl, calTz);
        if (ev && acceptable(ev)) out.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const [name, ...params] = head.split(";");
    const key = name.toUpperCase();
    if (!cur[key]) cur[key] = { params: params.join(";"), value: line.slice(idx + 1) };
  }
  return out;
}

function icsToEvent(p: Record<string, { params: string; value: string }>, pageUrl: string, calTz: string | null): ExtractedEvent | null {
  const title = cleanStr(icsUnescape(p.SUMMARY?.value || ""));
  const dt = p.DTSTART;
  if (!title || !dt) return null;
  if (/^(CANCELLED)$/i.test(p.STATUS?.value || "")) return null;

  const raw = dt.value.trim();
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  let eventDate = `${m[1]}-${m[2]}-${m[3]}`;
  let startTime = "";
  if (/VALUE=DATE(?!-)/i.test(dt.params) || !m[4]) {
    startTime = "All Day"; // iCalendar DATE values are explicitly all-day events
  } else if (m[7]) {
    // UTC instant: only convertible if the calendar declares its timezone
    const tz = (dt.params.match(/TZID=([^;:]+)/i) || [])[1] || calTz;
    const zp = tz ? zonedParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])), tz) : null;
    if (zp) {
      eventDate = zp.date;
      startTime = formatTimeFromDate(`${zp.date}T${String(zp.h).padStart(2, "0")}:${String(zp.m).padStart(2, "0")}`);
    }
  } else {
    // Floating or TZID local time: wall-clock time as written
    startTime = formatTimeFromDate(`${eventDate}T${m[4]}:${m[5]}`);
  }

  const location = cleanStr(icsUnescape(p.LOCATION?.value || ""));
  let venue = "";
  let address = "";
  if (location) {
    const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && !/\d/.test(parts[0])) {
      venue = parts[0];
      address = location; // full text as stated; resolveLocation parses it
    } else if (/\d/.test(location) || parts.length > 1) {
      address = location;
    } else {
      venue = location;
    }
  }
  let lat: number | undefined;
  let lon: number | undefined;
  if (p.GEO?.value) {
    const [a, b] = p.GEO.value.split(/[;,]/);
    lat = toNum(a);
    lon = toNum(b);
  }

  const details = cleanHtmlEntitiesAndTags(icsUnescape(p.DESCRIPTION?.value || p["X-ALT-DESC"]?.value || ""));
  return make({
    title,
    details,
    venue,
    startTime,
    eventDate,
    address,
    lat,
    lon,
    sourceUrl: pageUrl,
    officialInfoUrl: absUrl(p.URL?.value, pageUrl) || pageUrl,
    organizerName: cleanStr((p.ORGANIZER?.params.match(/CN="?([^";:]+)"?/i) || [])[1]) || undefined,
    contactEmail: (p.ORGANIZER?.value.match(/mailto:([^\s;]+)/i) || [])[1],
    strategy: "ical",
  });
}

// ---------------------------------------------------------------------------
// 4. AEG / Bowery / AXS venue data-file JSON feeds
// ---------------------------------------------------------------------------

export function parseAegFeed(json: any, pageUrl: string): ExtractedEvent[] {
  const rawEvents: any[] = json?.events || (Array.isArray(json) ? json : []);
  const out: ExtractedEvent[] = [];
  for (const e of rawEvents) {
    if (!e?.eventDateTime) continue;
    const eventDate = isoDateFromSource(String(e.eventDateTime));
    if (!eventDate) continue;
    const titleRaw = e.title?.eventTitleText || e.title?.headlinersText || (typeof e.title === "string" ? e.title : "");
    const title = cleanStr(titleRaw);
    if (!title) continue;
    const v = e.venue || {};
    const city = cleanStr(v.city);
    const region = cleanStr(v.state);
    const country = cleanStr(v.country);
    const street = cleanStr(v.address || v.address1 || v.streetAddress);
    const address = joinAddress(street, city, [region, cleanStr(v.zip || v.postalCode)].filter(Boolean).join(" "), country);
    const flyer = e.media?.["17"]?.file_name || e.media?.["86"]?.file_name || (e.media ? (Object.values(e.media)[0] as any)?.file_name : undefined);
    const ev = make({
      title,
      details: cleanHtmlEntitiesAndTags(e.bio || e.description || ""),
      venue: cleanStr(v.title || v.name),
      startTime: formatTimeFromDate(String(e.eventDateTime)),
      eventDate,
      city,
      region,
      country,
      address,
      lat: toNum(v.latitude ?? v.lat),
      lon: toNum(v.longitude ?? v.lng ?? v.lon),
      sourceUrl: pageUrl,
      officialInfoUrl: absUrl(e.ticketing?.ticketURL || e.ticketing?.url || e.ticketing?.eventUrl, pageUrl) || pageUrl,
      eventFlyerUrl: absUrl(flyer, pageUrl),
      strategy: "aeg_feed",
    });
    if (acceptable(ev)) out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Simpleview / ASM Global REST docs (plugins_events_events/find)
// ---------------------------------------------------------------------------

export function parseSimpleviewDocs(json: any, pageUrl: string): ExtractedEvent[] {
  const docs: any[] = json?.docs?.docs || json?.docs || [];
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return ""; } })();
  const out: ExtractedEvent[] = [];
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d?.title || !d?.startDate) continue;
    const eventDate = isoDateFromSource(String(d.startDate));
    if (!eventDate) continue;
    const title = cleanStr(d.title);
    const city = cleanStr(d.city);
    const region = cleanStr(d.state);
    const address = joinAddress(d.address1 || d.address, d.address2, city, [region, cleanStr(d.zip)].filter(Boolean).join(" "));
    const startTime = d.startTime ? parseStartTime(String(d.startTime)) || formatTimeFromDate(`${eventDate}T${String(d.startTime).slice(0, 5)}`) : formatTimeFromDate(String(d.startDate));
    const ev = make({
      title,
      details: cleanHtmlEntitiesAndTags(d.description || ""),
      venue: cleanStr(d.location) || cleanStr(d.listing?.title),
      startTime,
      eventDate,
      city,
      region,
      address,
      lat: toNum(d.latitude ?? d.loc?.coordinates?.[1]),
      lon: toNum(d.longitude ?? d.loc?.coordinates?.[0]),
      sourceUrl: pageUrl,
      officialInfoUrl: absUrl(d.absoluteUrl, pageUrl) || (d.url ? absUrl(`${origin}${d.url}`, pageUrl) : undefined) || pageUrl,
      eventFlyerUrl: absUrl(d._media?.[0]?.mediaurl, pageUrl),
      strategy: "simpleview_api",
    });
    if (acceptable(ev)) out.push(ev);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. DOM event cards (theatre / arena / arts pages without structured data)
// ---------------------------------------------------------------------------

const CARD_SELECTORS = [
  ".rhpSingleEvent", ".eventWrapper", ".rhp-event__single-event--list", ".eventItem", ".event-item", ".event_item",
  ".event-card", ".eventCard", ".events-card", "article.event", ".show-item", ".c-card--event", ".eventlist-event",
  "article.hentry", ".event_list .entry", ".entry",
];

/** Address / locality written inside one card or row (microdata or address-classed elements). */
function locationInside($: CheerioAPI, el: any): { city?: string; region?: string; country?: string; address?: string } {
  const $el = $(el);
  const street = cleanStr($el.find("[itemprop='streetAddress'], .street-address, .tribe-street-address").first().text());
  const city = cleanStr($el.find("[itemprop='addressLocality'], .locality, .tribe-locality").first().text());
  const region = cleanStr($el.find("[itemprop='addressRegion'], .region, .tribe-region").first().text());
  const postal = cleanStr($el.find("[itemprop='postalCode'], .postal-code, .tribe-postal-code").first().text());
  const country = cleanStr($el.find("[itemprop='addressCountry'], .country-name, .tribe-country-name").first().text());
  let address = joinAddress(street, city, [region, postal].filter(Boolean).join(" "), country);
  if (!address) {
    const free = cleanStr($el.find("address, .address, .event-address, .venue-address, [class*='address']").first().text());
    if (free) address = free;
  }
  return { city, region, country, address };
}

export function parseDomCards($: CheerioAPI, pageUrl: string): ExtractedEvent[] {
  for (const sel of CARD_SELECTORS) {
    const cards = $(sel);
    if (!cards.length) continue;
    const found: ExtractedEvent[] = [];
    cards.each((_, el) => {
      const $el = $(el);
      let title = $el.find(".rhp-event__title--list, h2 a, h3 a, h4 a, .title a, .event-title a, h2, h3, h4, .title, .event-title").first().text().trim();
      title = title.split("\t")[0].trim().replace(/\s+/g, " ");
      const $date = $el.find(".eventDateListTop, .rhp-event__date--list, .date, .event-date, time, [class*='date']").first();
      const dateText = cleanStr($date.attr("datetime") || $date.text());
      if (!title || !dateText || title.length < 3 || title.length > 200) return;
      const eventDate = isoDateFromSource(dateText) || (parseHumanDateString(dateText)?.toISOString().slice(0, 10) ?? null);
      if (!eventDate) return;

      const tagline = cleanStr($el.find(".tagline, .sub-title, .event-sub-title, .desc, .description, p").first().text());
      const detailUrl = absUrl($el.find("a[href*='/event'], a[href*='/show'], a[href*='/detail'], .title a, h3 a").first().attr("href"), pageUrl) || pageUrl;
      const flyerUrl = absUrl($el.find("img").first().attr("src"), pageUrl);
      let venue = cleanStr($el.find(".event_venue, .event-venue, .rhp-event__venue--list, .venue, .location, [class*='event_venue'], [class*='event-venue'], [class*='venue']").first().text());
      if (isGenericCalendarHeader(venue)) venue = "";
      const timeText = cleanStr($el.find(".time, .event-time, [class*='time'], .rhp-event__time--list").first().text()) || $el.text();
      const loc = locationInside($, el);
      const isoAttr = $date.attr("datetime");

      const ev = make({
        title,
        details: tagline && tagline !== title ? tagline : "",
        venue,
        startTime: (isoAttr && formatTimeFromDate(isoAttr)) || parseStartTime(timeText),
        eventDate,
        ...loc,
        sourceUrl: pageUrl,
        officialInfoUrl: detailUrl,
        eventFlyerUrl: flyerUrl,
        strategy: "dom_card",
      });
      if (acceptable(ev)) found.push(ev);
    });
    if (found.length) return found;
  }
  return [];
}

// ---------------------------------------------------------------------------
// 7. HTML table / monthly accordion calendars (fairgrounds, civic arenas, expo halls)
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseHtmlTables($: CheerioAPI, pageUrl: string, emails?: Set<string>, subUrls?: string[]): ExtractedEvent[] {
  const found: ExtractedEvent[] = [];
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  $("table").each((i, tbl) => {
    let monthName: string | null = null;
    const prevHeader = $(tbl).closest(".ui-accordion-content, .views-field, .accordion-item, div").prevAll("h1, h2, h3, h4, button, .accordion-header").first().text().trim();
    const caption = $(tbl).find("caption").first().text().trim();
    for (const m of MONTHS) {
      if (`${caption} ${prevHeader}`.toLowerCase().includes(m.toLowerCase())) { monthName = m; break; }
    }
    // The month must be stated by the page (caption / heading); it is never inferred from table order.
    if (!monthName) return;
    const monthIndex = MONTHS.indexOf(monthName);
    const yearStated = (`${caption} ${prevHeader}`.match(/\b(20\d{2})\b/) || [])[1];

    $(tbl).find("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const dateStr = cleanStr($(tds[0]).text());
      const eventCell = $(tds[1]);
      const contactStr = tds.length >= 4 ? cleanStr($(tds[3]).text()) : "";
      if (/date/i.test(dateStr) && /event/i.test(eventCell.text())) return; // header row

      const cellClone = eventCell.clone();
      cellClone.find("br").replaceWith("\n");
      cellClone.find("p, div").append("\n");
      let title = cleanStr(eventCell.find("strong, b, h4, h3, a").first().text());
      if (!title) title = cleanStr(cellClone.text().split("\n")[0]);
      if (title.length > 70 && title.includes(".")) title = title.split(/\. |\n/)[0].trim();
      if (!title || title.length < 3) return;

      const detailUrl = absUrl(eventCell.find("a[href]").first().attr("href"), pageUrl) || pageUrl;
      let organizerUrl: string | undefined;
      let organizerName: string | undefined;
      const externalLink = $(tr).find("a[href^='http']").filter((_, a) => !/facebook\.com|instagram\.com|twitter\.com/.test($(a).attr("href") || "")).first();
      if (externalLink.length) {
        organizerUrl = externalLink.attr("href");
        const linkText = cleanStr(externalLink.text());
        organizerName = linkText.length > 2 ? linkText : undefined;
        if (organizerUrl && subUrls && !subUrls.includes(organizerUrl)) subUrls.push(organizerUrl);
      } else if (contactStr.length > 3) {
        const cleanedContact = contactStr.split(/[:\d(]/)[0].trim();
        if (cleanedContact.length > 2 && !cleanedContact.toLowerCase().includes("information")) organizerName = cleanedContact;
      }
      if (emails) collectEmails($(tr).text(), emails);

      // Only a stated day number gives a date ("4-6", "17"); "Every Saturday" etc. is not dated by us.
      const dayMatch = dateStr.match(/^(\d{1,2})\b/);
      if (!dayMatch) return;
      const dayNum = parseInt(dayMatch[1], 10);
      let year = yearStated ? parseInt(yearStated, 10) : currentYear;
      if (!yearStated && monthIndex < now.getUTCMonth() - 1) year += 1;
      const eventDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

      const fullDesc = cleanStr(eventCell.text());
      const loc = locationInside($, tr);
      const ev = make({
        title,
        details: fullDesc && fullDesc !== title ? fullDesc : "",
        venue: tds.length >= 3 ? cleanStr($(tds[2]).text()) : "",
        startTime: parseStartTime($(tr).text()),
        eventDate,
        ...loc,
        sourceUrl: pageUrl,
        officialInfoUrl: detailUrl,
        organizerName,
        organizerUrl,
        strategy: "html_table",
      });
      if (acceptable(ev)) found.push(ev);
    });
  });
  return found;
}

export const STRATEGY_ORDER: ExtractionStrategy[] = ["jsonld", "tribe_rest", "ical", "aeg_feed", "simpleview_api", "calendar_link", "dom_card", "html_table"];

// ---------------------------------------------------------------------------
// 8. "Add to calendar" template links (Google / Outlook / Yahoo)
// ---------------------------------------------------------------------------
// Many tour and venue sites publish no structured data but give every performance an "add to calendar"
// link whose query string states the title, local date-time, timezone and full venue address.
// Everything is read from the link the source publishes; nothing is inferred.

const REMINDER_TITLE = /\b(coming up|reminder|remind me|on sale|onsale|presale|pre-sale|tickets? (go|goes) on sale)\b/i;
const TICKET_HOST = /(ticket|tix|evenue|axs\.|etix|seatgeek|stubhub|vivid|eventbrite|livenation|showclix|universe\.com|ovationtix|tessitura|frontgate|prekindle|dice\.fm|feverup|songkick|bandsintown)/i;

interface CalLink { title: string; start: string; ctz?: string; location: string; details: string; allDay: boolean }

function readCalLink(href: string): CalLink | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  const h = u.hostname.toLowerCase();
  const q = u.searchParams;
  if (/calendar\.google\.com$/.test(h) && /TEMPLATE/i.test(q.get("action") || "")) {
    const dates = (q.get("dates") || "").split("/")[0];
    return { title: q.get("text") || "", start: dates, ctz: q.get("ctz") || undefined, location: q.get("location") || "", details: q.get("details") || "", allDay: /^\d{8}$/.test(dates) };
  }
  if (/outlook\.(live|office)\.com$/.test(h) && q.get("subject")) {
    const s = q.get("startdt") || "";
    return { title: q.get("subject") || "", start: s, location: q.get("location") || "", details: q.get("body") || "", allDay: q.get("allday") === "true" || /^\d{4}-\d{2}-\d{2}$/.test(s) };
  }
  if (/calendar\.yahoo\.com$/.test(h) && q.get("title")) {
    const s = q.get("st") || "";
    return { title: q.get("title") || "", start: s, location: q.get("in_loc") || "", details: q.get("desc") || "", allDay: /^\d{8}$/.test(s) };
  }
  return null;
}

/** Local date + time ("" if unknown) of a calendar-link start value. */
function calStart(c: CalLink): { eventDate: string; startTime: string } | null {
  const s = c.start.trim();
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (compact) {
    const date = `${compact[1]}-${compact[2]}-${compact[3]}`;
    if (c.allDay || !compact[4]) return { eventDate: date, startTime: "All Day" };
    if (compact[7]) {
      if (!c.ctz) return { eventDate: date, startTime: "" };
      const zp = zonedParts(new Date(Date.UTC(+compact[1], +compact[2] - 1, +compact[3], +compact[4], +compact[5])), c.ctz);
      return zp ? { eventDate: zp.date, startTime: formatTimeFromDate(`${zp.date}T${String(zp.h).padStart(2, "0")}:${String(zp.m).padStart(2, "0")}`) } : null;
    }
    return { eventDate: date, startTime: formatTimeFromDate(`${date}T${compact[4]}:${compact[5]}`) };
  }
  const iso = isoDateFromSource(s);
  if (!iso) return null;
  if (c.allDay) return { eventDate: iso, startTime: "All Day" };
  return { eventDate: iso, startTime: formatTimeFromDate(s) };
}

/** The venue's own website link inside the same block as the calendar link (e.g. "More Venue Info"). */
function nearbyVenueUrl($: CheerioAPI, el: any, pageUrl: string, location: string, calSelector: string): string | undefined {
  let pageHost = "";
  try { pageHost = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return undefined; }
  let block = $(el);
  let best: string | undefined;
  for (let i = 0; i < 10; i++) {
    const parent = block.parent();
    if (!parent.length || parent.is("body, html")) break;
    // Stop once the block covers calendar links for a different location (we left this venue's block).
    const locs = new Set<string>();
    parent.find(calSelector).each((_, a) => { const c = readCalLink($(a).attr("href") || ""); if (c) locs.add(c.location); });
    if (locs.size > 1 || (locs.size === 1 && !locs.has(location))) break;
    block = parent;
    const labelled: string[] = [];
    const others = new Set<string>();
    block.find("a[href^='http']").each((_, a) => {
      const href = $(a).attr("href") || "";
      let u: URL;
      try { u = new URL(href); } catch { return; }
      const h = u.hostname.replace(/^www\./, "");
      if (h === pageHost || TICKET_HOST.test(h) || isTicketBrokerUrl(href) || !isValidCalendarSourceUrl(href) || readCalLink(href)) return;
      const root = `${u.protocol}//${u.hostname}${u.pathname === "/" || /venue|about|visit/i.test(u.pathname) ? u.pathname : "/"}`;
      if (/venue/i.test(`${$(a).text()} ${$(a).attr("class") || ""} ${$(a).parent().attr("class") || ""}`)) labelled.push(root);
      else others.add(`${u.protocol}//${u.hostname}/`);
    });
    if (labelled.length) return labelled[0];
    if (others.size === 1) best = [...others][0];
  }
  return best;
}

export function parseCalendarLinks($: CheerioAPI, pageUrl: string): ExtractedEvent[] {
  const providers = [
    "a[href*='calendar.google.com'][href*='TEMPLATE'], a[href*='calendar.google.com'][href*='template']",
    "a[href*='outlook.live.com'][href*='subject='], a[href*='outlook.office.com'][href*='subject=']",
    "a[href*='calendar.yahoo.com'][href*='title=']",
  ];
  for (const sel of providers) {
    const links = $(sel);
    if (!links.length) continue;
    const seen = new Set<string>();
    const venueUrlByLocation = new Map<string, string | undefined>();
    const out: ExtractedEvent[] = [];
    links.each((_, el) => {
      const c = readCalLink($(el).attr("href") || "");
      if (!c) return;
      const title = cleanStr(c.title);
      if (!title || REMINDER_TITLE.test(title)) return;
      const when = calStart(c);
      if (!when) return;
      const location = cleanStr(c.location);
      const key = `${title}|${when.eventDate}|${when.startTime}|${location}`;
      if (seen.has(key)) return;
      seen.add(key);
      const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
      const venue = parts.length > 1 && !/^\d/.test(parts[0]) ? parts[0] : "";
      if (location && !venueUrlByLocation.has(location)) venueUrlByLocation.set(location, nearbyVenueUrl($, el, pageUrl, c.location, sel));
      const details = cleanHtmlEntitiesAndTags(c.details);
      const ev = make({
        title,
        details: details && details !== title ? details : "",
        venue,
        startTime: when.startTime,
        eventDate: when.eventDate,
        address: location || undefined,
        sourceUrl: pageUrl,
        officialInfoUrl: pageUrl,
        venueUrl: location ? venueUrlByLocation.get(location) : undefined,
        strategy: "calendar_link",
      });
      if (acceptable(ev)) out.push(ev);
    });
    if (out.length) return out;
  }
  return [];
}
