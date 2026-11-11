// src/lib/events/crawl/extract.ts
//
// extractEventsFromUrl(url): crawl ONE source page (plus its own pagination) and return the events it publishes,
// the venues / entities it names, the same-site listing pages (hubs) it links to, and what kind of page it is.
// Takes the URL only: there are no fallback city/state parameters. Every location on the returned events comes
// from the page, the event's own detail page, or (owner decision 2026-11-10) the venue's own stated address on
// the same site (venueLocation.ts).
//
// $0: plain HTTP + cheerio. No AI, no Google, no headless browser, no aggregators.

import * as cheerio from "cheerio";
import type { CrawlResult, ExtractedEvent, ExtractionStrategy, PageClass } from "./types";
import { addEmail, collectEmails, hasAnyLocation } from "./helpers";
import {
  parseAegFeed, parseCalendarLinks, parseDomCards, parseHtmlTables, parseICalEvents, parseJsonLdEvents, parseSimpleviewDocs,
  parseTribeEvents,
} from "./parsers";
import { fetchJsonData, fetchPage, type FetchStatus } from "./fetch";
import { canonicalUrl, classifyPage, collectEntities, detectHandlerQueue, findHubLinks, findPaginationLinks, pagingInfo } from "./discover";
import { applySiteVenues, collectSiteVenues, readVenueCandidates, readVenueDirectoryLinks, type VenueVerifier } from "./venueLocation";

const TRIBE_PAGE_GUARD = 200; // loop guard for next_rest_url pagination (repeated-URL protection, not a content cap)
const DETAIL_CONCURRENCY = 5;

export class CrawlFetchError extends Error {
  constructor(public fetchStatus: FetchStatus, message: string) {
    super(message);
  }
}

export interface ExtractOptions {
  /** Epoch ms after which no new page fetch is started (pagination left over goes to crawl_frontier). */
  deadline?: number;
  /** Look-ahead for month/date-paged calendars (sources.scrape_horizon_months; 12 = events up to 12 months ahead). */
  horizonMonths?: number;
  /** Verifies a venue-stated address (resolveLocation in production; stubbed in tests). */
  verifyVenue?: VenueVerifier;
}

export interface UrlCrawlResult extends CrawlResult {
  fetchStatus: FetchStatus;
  fetchDetail?: string;
}

async function fetchText(url: string, timeoutMs = 12000, accept?: string): Promise<string | null> {
  const r = await fetchPage(url, { timeoutMs, accept, kind: accept ? "data" : "page", retries: 1 });
  return r.body && (r.status === "ok" || r.status === "js_shell") ? r.body : null;
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
    const json = await fetchJsonData(next);
    if (!json || !Array.isArray(json.events)) break;
    out.push(...parseTribeEvents(json, pageUrl, emails));
    next = typeof json.next_rest_url === "string" ? json.next_rest_url : null;
  }
  return out;
}

async function simpleviewEvents(pageUrl: string): Promise<ExtractedEvent[]> {
  const origin = new URL(pageUrl).origin;
  const tokenRes = await fetchPage(`${origin}/plugins/core/get_simple_token/`, { timeoutMs: 6000, kind: "data", retries: 0 });
  if (tokenRes.status !== "ok" || !tokenRes.body || tokenRes.body.length > 200) return [];
  const token = tokenRes.body.trim();
  const apiUrl = `${origin}/includes/rest_v2/plugins_events_events/find/?token=${encodeURIComponent(token)}&json=${encodeURIComponent(JSON.stringify({ filter: {}, options: { limit: 500 } }))}`;
  const json = await fetchJsonData(apiUrl, 12000);
  return json ? parseSimpleviewDocs(json, pageUrl) : [];
}

/**
 * Data APIs tried when the HTML page is blocked, a JS shell, or yields nothing (handler 2/3: API before HTML):
 * The Events Calendar REST, the Tribe iCal export of this page, Simpleview token API. Fetched for data only;
 * these URLs are never stored as sources.
 */
async function probeDataApis(pageUrl: string, emails: Set<string>, opts: { wordpress: boolean; simpleview: boolean }): Promise<{ events: ExtractedEvent[]; strategy?: ExtractionStrategy }> {
  let origin = "";
  try { origin = new URL(pageUrl).origin; } catch { return { events: [] }; }
  if (opts.wordpress) {
    const tribe = await tribeEvents(`${origin}/wp-json/tribe/events/v1/events`, pageUrl, emails).catch(() => []);
    if (tribe.length) return { events: tribe, strategy: "tribe_rest" };
    const icalUrl = `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}ical=1`;
    const ics = await fetchText(icalUrl, 10000, "text/calendar,*/*;q=0.5");
    if (ics && /BEGIN:VCALENDAR/i.test(ics)) {
      const evs = parseICalEvents(ics, pageUrl);
      if (evs.length) return { events: evs, strategy: "ical" };
    }
  }
  if (opts.simpleview) {
    const sv = await simpleviewEvents(pageUrl).catch(() => []);
    if (sv.length) return { events: sv, strategy: "simpleview_api" };
  }
  return { events: [] };
}

/**
 * For events whose card/feed gave no location at all, read the event's OWN detail page
 * (same site) and take the location its schema.org Event states. Nothing else is borrowed.
 */
async function enrichFromDetailPages(events: ExtractedEvent[], pageUrl: string, deadline?: number): Promise<void> {
  let host = "";
  try { host = new URL(pageUrl).hostname; } catch { return; }
  const todo = events.filter((e) => {
    if (hasAnyLocation(e) || !e.officialInfoUrl || e.officialInfoUrl === pageUrl) return false;
    try { return new URL(e.officialInfoUrl).hostname === host; } catch { return false; }
  });
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, todo.length) }, async () => {
    while (i < todo.length) {
      if (deadline && Date.now() > deadline) return;
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
          if (!ev.venueUrl && match.venueUrl) ev.venueUrl = match.venueUrl;
          if (!ev.details && match.details) ev.details = match.details;
          if (!ev.startTime && match.startTime) ev.startTime = match.startTime;
          for (const k of ["city", "region", "country", "address", "lat", "lon"] as const) if (ev[k] === undefined) delete ev[k];
        }
      } catch { /* detail page unavailable: event keeps no location */ }
    }
  }));
}

interface PageParse {
  events: ExtractedEvent[];
  emails: Set<string>;
  strategies: ExtractionStrategy[];
  tableSubUrls: string[];
}

/** Parse one already-fetched page with the extraction strategies, in order (first that yields wins). */
async function parseOnePage(url: string, body: string, network: boolean): Promise<PageParse> {
  const emails = new Set<string>();
  const tableSubUrls: string[] = [];
  const strategies: ExtractionStrategy[] = [];
  let events: ExtractedEvent[] = [];
  const use = (s: ExtractionStrategy, evs: ExtractedEvent[]) => {
    if (evs.length) { events = evs; strategies.push(s); }
  };

  if (/^\s*BEGIN:VCALENDAR/i.test(body)) {
    use("ical", parseICalEvents(body, url));
    return { events, emails, strategies, tableSubUrls };
  }
  const $ = cheerio.load(body);
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
    for (const link of discoverICalLinks($, url)) {
      const ics = await fetchText(link, 10000, "text/calendar,*/*;q=0.5");
      if (ics) use("ical", parseICalEvents(ics, link));
      if (events.length) break;
    }
  }
  // 4. AEG / Bowery / AXS data-file feed
  if (!events.length && network) {
    const m = body.match(/data-file=["'](https?:\/\/[^"']+\.json[^"']*)["']/i);
    if (m) {
      const json = await fetchJsonData(m[1]);
      if (json) use("aeg_feed", parseAegFeed(json, url));
    }
  }
  // 5. Simpleview / ASM Global REST
  if (!events.length && network && /plugins_events_events|asm_list|get_simple_token/.test(body)) {
    try { use("simpleview_api", await simpleviewEvents(url)); } catch (err: any) { console.error(`[SIMPLEVIEW_CRAWL_ERROR] ${err.message}`); }
  }
  // 6. "Add to calendar" template links (title + local time + full venue address per performance)
  if (!events.length) use("calendar_link", parseCalendarLinks($, url));
  // 7. DOM event cards
  if (!events.length) use("dom_card", parseDomCards($, url));
  // 8. HTML table / accordion calendars
  if (!events.length && $("table").length) use("html_table", parseHtmlTables($, url, emails, tableSubUrls));
  // 9. WordPress site with no visible events: try the Tribe REST / iCal export before giving up
  if (!events.length && network && /wp-content|wp-json/i.test(body)) {
    const probe = await probeDataApis(url, emails, { wordpress: true, simpleview: false });
    if (probe.strategy) use(probe.strategy, probe.events);
  }
  return { events, emails, strategies, tableSubUrls };
}

function eventKey(e: ExtractedEvent): string {
  return `${e.title.toLowerCase()}|${e.eventDate}|${e.startTime}|${(e.address || e.venue || "").toLowerCase()}`;
}

/**
 * Parse already-fetched content and run the cascade analysis. Exposed for tests; does feed / pagination /
 * detail / venue fetches only when `network` is true.
 */
export async function extractFromContent(
  url: string,
  body: string,
  opts: { network?: boolean; fetchStatus?: FetchStatus } & ExtractOptions = {}
): Promise<CrawlResult> {
  const network = opts.network !== false;
  const first = await parseOnePage(url, body, network);
  const events = [...first.events];
  const emails = first.emails;
  const strategies = [...first.strategies];
  const seen = new Set(events.map(eventKey));

  if (/^\s*BEGIN:VCALENDAR/i.test(body)) {
    return { events, subUrls: [], paginationUrls: [], entities: collectEntities(events, []), extractedEmails: [], strategies, pageClass: events.length ? "hub" : "empty" };
  }

  const $ = cheerio.load(body);
  const pageTitle = $("title").first().text().replace(/\s+/g, " ").trim() || undefined;

  // Pagination of this listing: followed inside the job (API strategies already return every page).
  //   - Numbered pages (?page=2, /page/3/): a page that repeats this crawl's events or is empty = end of list.
  //   - Month / date pages (?month=3&year=2027): empty months do NOT end the walk; it continues to the source's
  //     look-ahead horizon (scrape_horizon_months, 12 months: events can be listed up to 12 months ahead).
  //     Past months are never followed (findPaginationLinks drops them).
  const horizon = opts.horizonMonths ?? 12;
  const withinHorizon = (u: string) => { const i = pagingInfo(u); return !i.dated || (i.monthsAhead ?? 0) <= horizon; };
  const apiStrategy = strategies.some((s) => s === "tribe_rest" || s === "simpleview_api" || s === "ical");
  const pagination = findPaginationLinks($, url).filter(withinHorizon);
  const leftover: string[] = [];
  const hubPages: { url: string; $: cheerio.CheerioAPI }[] = [{ url, $ }];
  if (network && !apiStrategy && (events.length || pagination.some((u) => pagingInfo(u).dated))) {
    const queue = [...pagination];
    const visited = new Set<string>([canonicalUrl(url) || url]);
    while (queue.length) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);
      if (opts.deadline && Date.now() > opts.deadline) { leftover.push(next, ...queue.filter((q) => !visited.has(q))); break; }
      const html = await fetchText(next);
      if (!html) continue;
      const p = await parseOnePage(next, html, network);
      const fresh = p.events.filter((e) => !seen.has(eventKey(e)));
      const $p = cheerio.load(html);
      if (!fresh.length) {
        // Empty month inside the horizon: keep walking forward. Numbered page with nothing new: end of list.
        if (pagingInfo(next).dated) for (const n of findPaginationLinks($p, next).filter(withinHorizon)) if (!visited.has(n)) queue.push(n);
        continue;
      }
      for (const e of fresh) { seen.add(eventKey(e)); events.push(e); }
      p.emails.forEach((e) => emails.add(e));
      for (const s of p.strategies) if (!strategies.includes(s)) strategies.push(s);
      hubPages.push({ url: next, $: $p });
      for (const n of findPaginationLinks($p, next).filter(withinHorizon)) if (!visited.has(n)) queue.push(n);
    }
  } else if (!network) {
    leftover.push(...pagination);
  }

  // Detail-page location enrichment (event's own page only)
  if (events.length && network) await enrichFromDetailPages(events, url, opts.deadline);

  // Venue-stated location (owner decision 2026-11-10): the venue's own address from its own site.
  let venueLocationStatus: CrawlResult["venueLocationStatus"];
  let siteVenues: CrawlResult["siteVenues"];
  if (events.length && opts.verifyVenue) {
    const fetcher = network ? (u: string) => fetchText(u, 10000) : async () => null;
    const venues = await collectSiteVenues(body, url, events, fetcher, opts.verifyVenue);
    const r = applySiteVenues(events, venues);
    venueLocationStatus = r.status;
    siteVenues = venues.map((v) => ({ name: v.name, address: v.address, citySlug: v.citySlug, evidenceUrl: v.evidenceUrl }));
  }

  // Entities and hubs.
  const venueLinks = readVenueDirectoryLinks($, url);
  const ownVenue = readVenueCandidates($, url);
  const entities = collectEntities(events, venueLinks);
  const venueCount = entities.filter((e) => e.type === "venue").length + ownVenue.length;
  const pageClass: PageClass = classifyPage({ $, url, events, venueCount, hasPagination: pagination.length > 0, fetchStatus: opts.fetchStatus });

  // Owner rule: only pages that produced current/future events or venues spawn spiders. Articles never do.
  const subUrls = new Set<string>();
  if ((events.length || venueCount) && pageClass !== "article") {
    const eventUrls = new Set(events.map((e) => (e.officialInfoUrl ? canonicalUrl(e.officialInfoUrl) : null)).filter(Boolean) as string[]);
    for (const p of hubPages) for (const h of findHubLinks(p.$, p.url, eventUrls)) subUrls.add(h);
    for (const p of hubPages) for (const pg of findPaginationLinks(p.$, p.url)) subUrls.delete(pg);
  }

  return {
    events,
    subUrls: [...subUrls],
    paginationUrls: leftover,
    entities,
    extractedEmails: Array.from(emails),
    strategies,
    pageClass,
    pageTitle,
    venueLocationStatus,
    siteVenues,
    handlerQueue: detectHandlerQueue(url, opts.fetchStatus, events, pageClass),
  };
}

/**
 * Crawl one URL through the fetch layer. Never throws for fetch failures: the result carries fetchStatus.
 * Blocked / JS-shell pages fall back to the site's data APIs (Tribe REST, iCal export, Simpleview).
 */
export async function crawlUrl(url: string, opts: ExtractOptions = {}): Promise<UrlCrawlResult> {
  const r = await fetchPage(url);
  const empty = (pageClass: PageClass): UrlCrawlResult => ({
    events: [], subUrls: [], paginationUrls: [], entities: [], extractedEmails: [], strategies: [], pageClass,
    fetchStatus: r.status, fetchDetail: r.detail, handlerQueue: detectHandlerQueue(url, r.status, [], pageClass),
  });

  if (r.status !== "ok" && r.status !== "js_shell") {
    // HTML blocked / failing: the site's data APIs may still answer (API before giving up).
    const emails = new Set<string>();
    const probe = await probeDataApis(url, emails, { wordpress: true, simpleview: true });
    if (!probe.events.length) return empty("empty");
    return {
      events: probe.events, subUrls: [], paginationUrls: [], entities: collectEntities(probe.events, []),
      extractedEmails: [...emails], strategies: probe.strategy ? [probe.strategy] : [], pageClass: "hub",
      fetchStatus: r.status, fetchDetail: `${r.detail}; events read from data API`,
    };
  }

  const finalUrl = r.finalUrl && r.finalUrl.startsWith("http") ? r.finalUrl : url;
  const result = await extractFromContent(finalUrl, r.body || "", { ...opts, fetchStatus: r.status });
  if (!result.events.length && r.status === "js_shell") {
    const emails = new Set<string>();
    const probe = await probeDataApis(finalUrl, emails, { wordpress: true, simpleview: true });
    if (probe.events.length) {
      return { ...result, events: probe.events, strategies: probe.strategy ? [probe.strategy] : [], pageClass: "hub", entities: collectEntities(probe.events, []), fetchStatus: r.status, fetchDetail: r.detail };
    }
  }
  return { ...result, fetchStatus: r.status, fetchDetail: r.detail };
}

/**
 * Legacy entry point (rescrape-events / discovery spider): same crawl, but throws when the page could not be
 * fetched and produced nothing, so callers keep applying the failed-task rule.
 */
export async function extractEventsFromUrl(url: string, opts: ExtractOptions = {}): Promise<UrlCrawlResult> {
  const r = await crawlUrl(url, opts);
  if (!r.events.length && r.fetchStatus !== "ok" && r.fetchStatus !== "js_shell") {
    throw new CrawlFetchError(r.fetchStatus, `${r.fetchStatus}: ${r.fetchDetail || "fetch failed"}`);
  }
  return r;
}
