// src/lib/events/crawl/extract.ts
//
// extractEventsFromUrl(url): fetch ONE page and pull the events it publishes.
// Takes the URL only — there are no fallback city/state parameters. Every location field on the
// returned events comes from the page (or the page's own feed / the event's own detail page).
//
// $0: plain HTTP + cheerio. No AI, no Google, no headless browser, no aggregators.

import axios from "axios";
import * as cheerio from "cheerio";
import type { CrawlResult, ExtractedEvent, ExtractionStrategy } from "./types";
import { addEmail, collectEmails, hasAnyLocation, isValidCalendarSourceUrl } from "./helpers";
import {
  parseAegFeed, parseDomCards, parseHtmlTables, parseICalEvents, parseJsonLdEvents, parseSimpleviewDocs,
  parseTribeEvents,
} from "./parsers";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SUB_PAGE_CAP = 10; // owner rule: max 10 sub-pages per source; more => admin review
const TRIBE_PAGE_GUARD = 50; // loop guard for next_rest_url pagination (not a content cap)
const DETAIL_CONCURRENCY = 5;

async function fetchText(url: string, timeoutMs = 12000, accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"): Promise<string | null> {
  const res = await axios.get(url, {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en-US,en;q=0.9" },
    timeout: timeoutMs,
    signal: AbortSignal.timeout(timeoutMs),
    maxRedirects: 3,
    responseType: "text",
    transformResponse: (d) => d,
  });
  return typeof res.data === "string" ? res.data : null;
}

async function fetchJson(url: string, timeoutMs = 10000, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** The Events Calendar REST endpoint, if the page shows the plugin. Never guessed for non-Tribe sites. */
export function detectTribeApi(html: string, pageUrl: string): string | null {
  const explicit = html.match(/https?:\\?\/\\?\/[^"'\s]+?\/wp-json\\?\/tribe\\?\/events\\?\/v1\\?\//i);
  if (explicit) return explicit[0].replace(/\\\//g, "/") + "events";
  if (/tribe-events|tribe_events|the-events-calendar/i.test(html)) {
    try {
      return `${new URL(pageUrl).origin}/wp-json/tribe/events/v1/events`;
    } catch {
      return null;
    }
  }
  return null;
}

/** iCal feeds the page links to (same site only). */
export function discoverICalLinks($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const out = new Set<string>();
  let host = "";
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return []; }
  $('link[type="text/calendar"], a[href$=".ics"], a[href*=".ics?"], a[href^="webcal:"], a[href*="ical=1"], a[href*="/ical/"], a[href*="format=ical"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href.replace(/^webcal:/i, "https:"), pageUrl);
      if (u.hostname.replace(/^www\./, "").endsWith(host) || host.endsWith(u.hostname.replace(/^www\./, ""))) out.add(u.href);
    } catch { /* ignore */ }
  });
  return [...out];
}

async function tribeEvents(apiBase: string, pageUrl: string, emails: Set<string>): Promise<ExtractedEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  let next: string | null = `${apiBase}${apiBase.includes("?") ? "&" : "?"}per_page=50&start_date=${today}`;
  const seen = new Set<string>();
  const out: ExtractedEvent[] = [];
  let pages = 0;
  while (next && !seen.has(next) && pages < TRIBE_PAGE_GUARD) {
    seen.add(next);
    pages++;
    const json = await fetchJson(next);
    if (!json || !Array.isArray(json.events)) break;
    out.push(...parseTribeEvents(json, pageUrl, emails));
    next = typeof json.next_rest_url === "string" ? json.next_rest_url : null;
  }
  return out;
}

async function simpleviewEvents(pageUrl: string): Promise<ExtractedEvent[]> {
  const origin = new URL(pageUrl).origin;
  const tokenRes = await fetch(`${origin}/plugins/core/get_simple_token/`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
  if (!tokenRes.ok) return [];
  const token = (await tokenRes.text()).trim();
  const apiUrl = `${origin}/includes/rest_v2/plugins_events_events/find/?token=${encodeURIComponent(token)}&json=${encodeURIComponent(JSON.stringify({ filter: {}, options: { limit: 100 } }))}`;
  const json = await fetchJson(apiUrl, 8000);
  return json ? parseSimpleviewDocs(json, pageUrl) : [];
}

/**
 * For events whose card/feed gave no location at all, read the event's OWN detail page
 * (same site) and take the location its schema.org Event states. Nothing else is borrowed.
 */
async function enrichFromDetailPages(events: ExtractedEvent[], pageUrl: string): Promise<void> {
  let host = "";
  try { host = new URL(pageUrl).hostname; } catch { return; }
  const todo = events.filter((e) => {
    if (hasAnyLocation(e) || !e.officialInfoUrl || e.officialInfoUrl === pageUrl) return false;
    try { return new URL(e.officialInfoUrl).hostname === host; } catch { return false; }
  });
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, todo.length) }, async () => {
    while (i < todo.length) {
      const ev = todo[i++];
      try {
        const html = await fetchText(ev.officialInfoUrl!, 8000);
        if (!html) continue;
        const $ = cheerio.load(html);
        const detail = parseJsonLdEvents($, ev.officialInfoUrl!);
        const match = detail.find((d) => d.eventDate === ev.eventDate) || (detail.length === 1 ? detail[0] : undefined);
        if (match) {
          ev.city = match.city; ev.region = match.region; ev.country = match.country; ev.address = match.address;
          ev.lat = match.lat; ev.lon = match.lon;
          if (!ev.venue && match.venue) ev.venue = match.venue;
          if (!ev.details && match.details) ev.details = match.details;
          if (!ev.startTime && match.startTime) ev.startTime = match.startTime;
          for (const k of ["city", "region", "country", "address", "lat", "lon"] as const) if (ev[k] === undefined) delete ev[k];
        }
      } catch { /* detail page unavailable: event keeps no location */ }
    }
  }));
}

/** Parse already-fetched content (HTML page or iCal text). Exposed for tests; does feed fetches only when `network` is true. */
export async function extractFromContent(url: string, body: string, opts: { network?: boolean } = {}): Promise<CrawlResult> {
  const network = opts.network !== false;
  const emails = new Set<string>();
  const subUrls: string[] = [];
  const strategies: ExtractionStrategy[] = [];
  let events: ExtractedEvent[] = [];
  const use = (s: ExtractionStrategy, evs: ExtractedEvent[]) => {
    if (evs.length) { events = evs; strategies.push(s); }
  };

  // The URL itself is an iCal feed
  if (/^\s*BEGIN:VCALENDAR/i.test(body)) {
    use("ical", parseICalEvents(body, url));
    return { events, subUrls: [], subUrlsTotal: 0, extractedEmails: [], strategies };
  }

  const $ = cheerio.load(body);

  // Emails: mailto links + visible text
  $('a[href^="mailto:"]').each((_, el) => addEmail($(el).attr("href"), emails));
  collectEmails($("body").text(), emails);

  // 1. schema.org JSON-LD
  use("jsonld", parseJsonLdEvents($, url, emails));

  // 2. The Events Calendar REST API (only when the page shows the plugin)
  if (!events.length && network) {
    const api = detectTribeApi(body, url);
    if (api) use("tribe_rest", await tribeEvents(api, url, emails).catch(() => []));
  }

  // 3. iCal feeds the page links to
  if (!events.length && network) {
    for (const link of discoverICalLinks($, url).slice(0, 3)) {
      try {
        const ics = await fetchText(link, 10000, "text/calendar,*/*;q=0.5");
        if (ics) use("ical", parseICalEvents(ics, link));
      } catch { /* try next link */ }
      if (events.length) break;
    }
  }

  // 4. AEG / Bowery / AXS data-file feed
  if (!events.length && network) {
    const m = body.match(/data-file=["'](https?:\/\/[^"']+\.json[^"']*)["']/i);
    if (m) {
      const json = await fetchJson(m[1]);
      if (json) use("aeg_feed", parseAegFeed(json, url));
    }
  }

  // 5. Simpleview / ASM Global REST
  if (!events.length && network && /plugins_events_events|asm_list|get_simple_token/.test(body)) {
    try { use("simpleview_api", await simpleviewEvents(url)); } catch (err: any) { console.error(`[SIMPLEVIEW_CRAWL_ERROR] ${err.message}`); }
  }

  // 6. DOM event cards
  if (!events.length) use("dom_card", parseDomCards($, url));

  // 7. HTML table / accordion calendars
  if (!events.length && $("table").length) use("html_table", parseHtmlTables($, url, emails, subUrls));

  // Detail-page location enrichment (event's own page only)
  if (events.length && network) await enrichFromDetailPages(events, url);

  // Sub-links for deeper calendar crawling (Option A gate applied by the spawner too)
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/\/event\/|\/events\/|\/events-this-month|\/calendar\/|\/shows\/|\/happenings\/|weekend|things-to-do/.test(href)) return;
    try {
      const parsed = new URL(href, url);
      if (isValidCalendarSourceUrl(parsed.href) && parsed.href !== url && !subUrls.includes(parsed.href)) subUrls.push(parsed.href);
    } catch { /* ignore */ }
  });

  const distinct = Array.from(new Set(subUrls));
  return {
    events,
    // Sub-page cap (owner rule): max 10 sub-pages per source. Sources that exceed it are flagged
    // for admin review (subUrlsTotal) instead of crawling deeper. Emails are uncapped.
    subUrls: distinct.slice(0, SUB_PAGE_CAP),
    subUrlsTotal: distinct.length,
    extractedEmails: Array.from(emails),
    strategies,
  };
}

/**
 * Extracts events (with page-stated locations only), sub-calendar links and contact emails from one URL.
 * Throws on fetch failure so callers can apply the failed-task rule.
 */
export async function extractEventsFromUrl(url: string): Promise<CrawlResult> {
  const body = await fetchText(url);
  if (!body) return { events: [], subUrls: [], subUrlsTotal: 0, extractedEmails: [], strategies: [] };
  return extractFromContent(url, body);
}
