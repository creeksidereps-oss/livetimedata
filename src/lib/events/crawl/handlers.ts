// src/lib/events/crawl/handlers.ts
//
// Reusable handlers for kinds of site whose events are not in the listing page's own markup
// (spider repair, owner-approved 2026-11-11). Each handler recognises its kind of site from how the page is
// built, never from a list of site names. All are $0 plain HTTP. True-information rule: every field comes from
// what the site publishes; missing fields stay empty (publishEvent decides pending_review / rejected).
//
//   1. Listing -> detail pages : a listing that only links to one page per event; read each event page.
//   2. Event sitemap           : the site's own sitemap lists its event pages (Wix, Simpleview, WordPress, ...).
//   3. Embedded page data      : events shipped as JSON inside the page's scripts (Vue / React / Next / Shopify).
//   4. Platform feeds          : known calendar platforms with a public data feed (Saffire).

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { ExtractedEvent } from "./types";
import {
  categorizeEvent, cleanHtmlEntitiesAndTags, cleanStr, formatTimeFromDate, isClearlyPast, isNonEventTitle,
  isOnlineOrVirtualEvent, isoDateFromSource, joinAddress, parseStartTime, toNum,
} from "./helpers";
import { parseCalendarLinks, parseJsonLdEvents } from "./parsers";
import { fetchPage } from "./fetch";
import { canonicalUrl, isSameSite, pagingInfo } from "./discover";

const CONCURRENCY = 5;

async function fetchHtml(url: string): Promise<string | null> {
  const r = await fetchPage(url, { timeoutMs: 12000, retries: 1 });
  return r.body && (r.status === "ok" || r.status === "js_shell") ? r.body : null;
}

/** Read event pages (structured data only) with a small worker pool. Pages not reached by the deadline are returned. */
async function readEventPages(urls: string[], deadline?: number): Promise<{ events: ExtractedEvent[]; leftover: string[] }> {
  const events: ExtractedEvent[] = [];
  const leftover: string[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      if (deadline && Date.now() > deadline) { leftover.push(u); continue; }
      const html = await fetchHtml(u);
      if (!html) continue;
      const $ = cheerio.load(html);
      const evs = parseJsonLdEvents($, u);
      events.push(...(evs.length ? evs : parseCalendarLinks($, u)));
    }
  }));
  return { events, leftover };
}

// ---------------------------------------------------------------------------
// 1. Listing -> detail pages
// ---------------------------------------------------------------------------

const DETAIL_PATH = /\/(events?|event-details|calendar|shows?|whats-on|happenings|activities|agenda|evenements?|veranstaltungen?)\/(?!(category|categories|tag|tags|page|list|month|week|day|venue|venues|search|feed|ical|submit|add)\b)[^/?#]{3,}\/?$/i;

/**
 * Same-site links on a listing page that each lead to one event's own page (/events/murder-mystery-dinner/).
 * Only used when the listing itself gave no events. At least 3 such links are required (a real listing).
 */
export function findDetailLinks($: CheerioAPI, pageUrl: string): string[] {
  const self = canonicalUrl(pageUrl);
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const c = canonicalUrl($(a).attr("href") || "", pageUrl);
    if (!c || c === self || !isSameSite(c, pageUrl) || pagingInfo(c).paged) return;
    let path = "";
    try { path = new URL(c).pathname; } catch { return; }
    if (!DETAIL_PATH.test(path)) return;
    out.add(c);
  });
  return out.size >= 3 ? [...out] : [];
}

export async function harvestDetailPages($: CheerioAPI, pageUrl: string, deadline?: number) {
  const links = findDetailLinks($, pageUrl);
  if (!links.length) return { events: [] as ExtractedEvent[], leftover: [] as string[] };
  const r = await readEventPages(links, deadline);
  for (const e of r.events) e.strategy = "detail_pages";
  return r;
}

// ---------------------------------------------------------------------------
// 2. Event sitemap
// ---------------------------------------------------------------------------

const EVENT_SITEMAP = /(event|events|tribe_events|event-pages|eventos|evenements|veranstaltung|calendar|shows?)[-_a-z0-9]*sitemap[^/]*\.xml|sitemap[-_a-z0-9]*(event|tribe_events|calendar|shows?)[^/]*\.xml/i;
const EVENT_PAGE = /\/(event|events|event-details|e|shows?|calendar\/event)\/[^/?#]{3,}/i;

function locs(xml: string): { loc: string; lastmod?: string }[] {
  const out: { loc: string; lastmod?: string }[] = [];
  for (const m of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)) {
    const loc = (m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i) || [])[1];
    if (!loc) continue;
    out.push({ loc: loc.replace(/&amp;/g, "&"), lastmod: (m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i) || [])[1] });
  }
  return out;
}

/** Event page URLs the site's own sitemap(s) list (robots.txt Sitemap: lines, /sitemap.xml, /sitemap_index.xml). */
export async function sitemapEventUrls(pageUrl: string): Promise<string[]> {
  let origin = "";
  try { origin = new URL(pageUrl).origin; } catch { return []; }
  const roots = new Set<string>();
  const robots = await fetchPage(`${origin}/robots.txt`, { kind: "data", timeoutMs: 8000, retries: 0 });
  if (robots.status === "ok" && robots.body) for (const m of robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)) roots.add(m[1]);
  if (!roots.size) { roots.add(`${origin}/sitemap.xml`); roots.add(`${origin}/sitemap_index.xml`); }

  const pages = new Set<string>();
  const seenMaps = new Set<string>();
  const cutoff = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10); // event pages untouched for >13 months are past events
  const visit = async (mapUrl: string, eventMap: boolean) => {
    if (seenMaps.has(mapUrl)) return;
    seenMaps.add(mapUrl);
    const r = await fetchPage(mapUrl, { kind: "data", timeoutMs: 12000, retries: 1 });
    if (r.status !== "ok" || !r.body || !/<(urlset|sitemapindex)/i.test(r.body)) return;
    const entries = locs(r.body);
    if (/<sitemapindex/i.test(r.body)) {
      for (const e of entries) if (EVENT_SITEMAP.test(e.loc)) await visit(e.loc, true);
      return;
    }
    for (const e of entries) {
      if (!isSameSite(e.loc, pageUrl)) continue;
      if (!(eventMap || EVENT_PAGE.test(new URL(e.loc).pathname))) continue;
      if (e.lastmod && e.lastmod.slice(0, 10) < cutoff) continue;
      const c = canonicalUrl(e.loc);
      if (c) pages.add(c);
    }
  };
  for (const root of roots) await visit(root, EVENT_SITEMAP.test(root));
  return [...pages];
}

export async function sitemapEvents(pageUrl: string, deadline?: number) {
  const urls = await sitemapEventUrls(pageUrl);
  if (!urls.length) return { events: [] as ExtractedEvent[], leftover: [] as string[], pages: 0 };
  const r = await readEventPages(urls, deadline);
  for (const e of r.events) e.strategy = "sitemap";
  return { ...r, pages: urls.length };
}

// ---------------------------------------------------------------------------
// 3. Embedded page data (JSON inside <script>)
// ---------------------------------------------------------------------------

const TITLE_KEYS = ["event_title", "eventTitle", "eventName", "event_name", "title", "name", "headline"];
// Event-specific date keys only (a plain "date" is usually a publish date on posts / products).
const DATE_KEYS = ["start_date", "startDate", "event_date", "eventDate", "event_start", "eventStart", "starts_at", "startsAt", "start_datetime", "startDateTime", "start_time_utc", "show_date", "showDate", "performance_date"];
const TIME_KEYS = ["start_time", "startTime", "time", "doors_time", "showTime", "show_time"];
const VENUE_KEYS = ["venue", "venue_name", "venueName", "location_name", "locationName", "location", "place", "facility"];
const STREET_KEYS = ["address", "address1", "street", "streetAddress", "street_address", "address_line_1", "addressLine1"];
const CITY_KEYS = ["city", "town", "locality", "addressLocality"];
const REGION_KEYS = ["state", "province", "region", "addressRegion", "state_code"];
const ZIP_KEYS = ["zip", "postal_code", "postalCode", "postcode", "zip_code"];
const COUNTRY_KEYS = ["country", "country_code", "countryCode", "addressCountry"];
const URL_KEYS = ["url", "page_url", "event_url", "eventUrl", "link", "permalink", "detail_url", "detailUrl", "ticket_url", "url_1"];
const DESC_KEYS = ["description", "summary", "excerpt", "details", "body"];
const LAT_KEYS = ["lat", "latitude"];
const LON_KEYS = ["lng", "lon", "longitude"];

function pick(o: any, keys: string[]): any {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
}
function str(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return cleanStr(String(v));
  if (typeof v === "object") return cleanStr(v.name || v.title || v.text || "");
  return "";
}

/** One embedded object -> event, when it has a real title and a real date. */
function embeddedToEvent(o: any, pageUrl: string): ExtractedEvent | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const title = cleanHtmlEntitiesAndTags(str(pick(o, TITLE_KEYS)));
  const rawDate = pick(o, DATE_KEYS);
  if (!title || title.length < 3 || title.length > 200 || rawDate == null || typeof rawDate === "object") return null;
  const dateStr = String(rawDate).trim();
  if (!/\d/.test(dateStr)) return null;
  const eventDate = isoDateFromSource(dateStr);
  if (!eventDate || isClearlyPast(eventDate)) return null;
  if (o.published === "0" || o.published === false || o.status === "draft" || o.cancelled === true || o.canceled === true) return null;

  let startTime = formatTimeFromDate(dateStr);
  const t = pick(o, TIME_KEYS);
  if (!startTime && typeof t === "string") startTime = parseStartTime(t) || formatTimeFromDate(`${eventDate}T${t.slice(0, 5)}`);

  const loc = typeof o.location === "object" && o.location ? o.location : typeof o.venue === "object" && o.venue ? o.venue : null;
  const src = loc ? { ...o, ...loc } : o;
  const venue = str(pick(o, VENUE_KEYS));
  const street = typeof pick(src, STREET_KEYS) === "string" ? cleanStr(pick(src, STREET_KEYS)) : "";
  const city = str(pick(src, CITY_KEYS));
  const region = str(pick(src, REGION_KEYS));
  const zip = str(pick(src, ZIP_KEYS));
  const country = str(pick(src, COUNTRY_KEYS));
  const lat = toNum(pick(src, LAT_KEYS)), lon = toNum(pick(src, LON_KEYS));
  const rawUrl = pick(o, URL_KEYS);
  let officialInfoUrl: string | undefined;
  try { officialInfoUrl = typeof rawUrl === "string" && /^(https?:)?\/\//.test(rawUrl) ? new URL(rawUrl, pageUrl).href : undefined; } catch { /* ignore */ }
  // An event object names where it happens; objects with a title + date but no place are not taken.
  if (!venue && !street && !city && (lat === undefined || lon === undefined)) return null;
  const details = cleanHtmlEntitiesAndTags(str(pick(o, DESC_KEYS)));
  if (isNonEventTitle(title) || isOnlineOrVirtualEvent(title, details, venue, officialInfoUrl)) return null;

  const ev: ExtractedEvent = {
    title,
    details: details && details !== title ? details : "",
    category: categorizeEvent(title, details),
    venue: venue && venue !== street ? venue : "",
    startTime,
    eventDate,
    sourceUrl: pageUrl,
    officialInfoUrl: officialInfoUrl || pageUrl,
    strategy: "embedded_json",
  };
  const address = street ? joinAddress(street, city, [region, zip].filter(Boolean).join(" "), country) : "";
  if (address) ev.address = address;
  if (city) ev.city = city;
  if (region) ev.region = region;
  if (country) ev.country = country;
  if (lat !== undefined && lon !== undefined) { ev.lat = lat; ev.lon = lon; }
  return ev;
}

/** Find JSON values ({..} / [..]) inside a script and return the parseable ones. Linear scan, skips past each attempt. */
export function jsonValuesIn(script: string): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < script.length) {
    const a = script.indexOf('[{"', i), b = script.indexOf('{"', i);
    const start = a < 0 ? b : b < 0 ? a : Math.min(a, b);
    if (start < 0) break;
    // string-aware bracket matching
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = start; j < script.length; j++) {
      const ch = script[j];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) break;
    try { out.push(JSON.parse(script.slice(start, end + 1))); } catch { /* JS literal, not JSON */ }
    i = end + 1;
  }
  return out;
}

export function parseEmbeddedJson($: CheerioAPI, pageUrl: string): ExtractedEvent[] {
  const found = new Map<string, ExtractedEvent>();
  const walk = (v: any, depth: number) => {
    if (!v || typeof v !== "object" || depth > 12) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    const ev = embeddedToEvent(v, pageUrl);
    if (ev) {
      const key = `${ev.title.toLowerCase()}|${ev.eventDate}|${ev.startTime}|${(ev.venue || ev.city || "").toLowerCase()}`;
      if (!found.has(key)) found.set(key, ev);
      return;
    }
    for (const x of Object.values(v)) if (x && typeof x === "object") walk(x, depth + 1);
  };
  $("script:not([src])").each((_, el) => {
    const type = ($(el).attr("type") || "").toLowerCase();
    if (type === "application/ld+json") return; // handled by the JSON-LD strategy
    const text = $(el).html() || "";
    if (text.length < 200) return;
    for (const v of jsonValuesIn(text)) walk(v, 0);
  });
  // Inertia / Livewire style: JSON in a data attribute on the app root
  $("[data-page]").each((_, el) => { try { walk(JSON.parse($(el).attr("data-page") || ""), 0); } catch { /* ignore */ } });
  const events = [...found.values()];
  return events.length >= 1 ? events : [];
}

// ---------------------------------------------------------------------------
// 4. Platform feeds
// ---------------------------------------------------------------------------

/** Saffire calendar platform: the page loads its calendar from the site's own eventsservice.asmx. */
export function isSaffireSite(html: string): boolean {
  return /cdn\.saffire\.com|\/services\/eventsservice\.asmx/i.test(html);
}
