// src/lib/events/crawl/discover.ts
//
// Cascade rules (spider repair, owner-approved 2026-11-10):
//   - A page spawns new spiders only if it produced current/future events OR venues/entities.
//   - Hubs (listing pages: many events, a calendar, a venue list) become spiders.
//   - Detail pages (one event) are read for data and never become spiders.
//   - Articles (news / blog posts) never spawn anything (stops the old "newspaper with old stats" loops).
//   - Pagination of a listing is followed inside the same job, not spawned.
//   - No numeric caps (GEMINI.md Rule 10). Loops are prevented structurally: same-site listing shape,
//     canonical URLs, ON CONFLICT on sources.url, and the events-or-venues spawn rule.
// Everything here is pure (no network) so it can be tested offline.

import type { CheerioAPI } from "cheerio";
import type { ExtractedEvent, FoundEntity, PageClass } from "./types";
import { cleanStr, isTicketBrokerUrl, isValidCalendarSourceUrl } from "./helpers";
import type { FetchStatus } from "./fetch";

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl|ref|ref_src|referrer|xref|camefrom|source|src|cmp|campaign|igshid|yclid|s_kwcid|trk|_hsenc|_hsmi)$/i;

/** Canonical form for storing / comparing URLs: no tracking params, no fragment, sorted query, no trailing "?". */
export function canonicalUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    u.hostname = u.hostname.toLowerCase();
    return u.href.replace(/\?$/, "");
  } catch {
    return null;
  }
}

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
export function isSameSite(a: string, b: string): boolean {
  const ha = hostOf(a), hb = hostOf(b);
  return !!ha && !!hb && (ha === hb || ha.endsWith("." + hb) || hb.endsWith("." + ha));
}

// Path words that mark an events listing, in several languages.
const LISTING_SEG = /^(events?|event-calendar|events-calendar|calendar|calendars|calendrier|kalender|kalendarium|agenda|shows?|schedule|schedules|whats-?on|what-s-on|whatson|programme|program|programma|programm|happenings|things-to-do|concerts?|performances?|season|tour|tour-dates|tourdates|upcoming|upcoming-events|fixtures|veranstaltungen|evenements|événements|eventos|eventi|spectacles|cartelera|termine|evenementen|voorstellingen|forestillinger|evenemang|konserter|live|gigs|lineup|line-up)$/i;
// Path words that mark pages which are about the venue business, not its calendar.
const NON_CALENDAR_SEG = /(^|-)(groups?|group-sales|group-tickets|mobile-?ticket(s|ing)?|ticketing|faqs?|refer|referral|travel|maps?|parking|polic(y|ies)|accessibility|ada|premium|suites?|hospitality|careers?|jobs|donate|donations?|membership|members|sponsors?|sponsorship|rentals?|gift-?cards?|newsletter|press|news|blog|media|contact|about|privacy|terms|login|account|cart|checkout|seating|seat-?maps?|clear-bag|bag-policy|food|dining|merch|shop|store|subscribe|volunteer|employment|vip|packages?|season-tickets?|book-an-event|host-an-event|private-events?|weddings?|meetings?|venue-rental|facility|amenities|directions|plan-your-visit|safety|covid)($|-)/i;
// After a listing word, these tail words keep the page a listing (/events/category/music, /events/list).
const LISTING_TAIL = /^(category|categories|type|types|genre|genres|venue|venues|series|list|upcoming|all|calendar|page|this-week|this-weekend|weekend|month|today|tonight|music|concerts|comedy|theatre|theater|family|sports|festivals?|arts?|kids|film|dance)$/i;

/** True if a URL has the shape of an events listing (not a single-event detail page, not a business page). */
export function isListingShaped(url: string): boolean {
  let segs: string[];
  try { segs = new URL(url).pathname.toLowerCase().split("/").filter(Boolean); } catch { return false; }
  if (segs.some((s) => NON_CALENDAR_SEG.test(s))) return false;
  let last = -1;
  segs.forEach((s, i) => { if (LISTING_SEG.test(s)) last = i; });
  if (last < 0) return false;
  const tail = segs.slice(last + 1);
  if (tail.length === 0) return true;
  if (tail.length === 1) return LISTING_TAIL.test(tail[0]) || /^page$/.test(tail[0]);
  if (tail.length === 2) return /^(category|categories|type|types|genre|genres|venue|venues|series|page)$/.test(tail[0]);
  return false;
}

/** Same-site listing pages linked from this page (candidate hub spiders). */
export function findHubLinks($: CheerioAPI, pageUrl: string, eventUrls: Set<string>): string[] {
  const self = canonicalUrl(pageUrl);
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    const c = canonicalUrl(href, pageUrl);
    if (!c || c === self || eventUrls.has(c)) return;
    if (!isSameSite(c, pageUrl) || !isValidCalendarSourceUrl(c) || !isListingShaped(c)) return;
    // A link with page or date settings is the same calendar's next/previous page, never a new source.
    if (pagingInfo(c).paged) return;
    out.add(c);
  });
  return [...out];
}

// Query keys that page through one listing, and keys that pick a date / month of one calendar.
const PAGE_KEYS = /^(page|pg|paged|ao_pg|p|pagenum|page_num|pagenumber|tribe_paged|sf_paged|_page|offset|skip|start_index|startindex)$/i;
const DATE_KEYS = /^(month|mon|m|year|yr|y|date|day|d|week|wk|start|start_date|startdate|end|end_date|enddate|from|to|ym|yearmonth|cal_month|cal_year|calmonth|calyear|tribe-bar-date|eventdate|eventdisplay|view_date|viewdate|selected_date|mode)$/i;

/**
 * Page / date settings carried by a URL (query keys or /page/N/ path).
 * `past` is true when the URL points at a month or day that is already over: never followed
 * (LiveTimeData only works with current and future events).
 */
export function pagingInfo(url: string): { paged: boolean; past: boolean } {
  let u: URL;
  try { u = new URL(url); } catch { return { paged: false, past: false }; }
  let paged = /\/page\/\d+\/?$/i.test(u.pathname);
  let year: number | undefined, month: number | undefined, day: number | undefined;
  for (const [k, v] of u.searchParams.entries()) {
    if (PAGE_KEYS.test(k)) paged = true;
    if (!DATE_KEYS.test(k)) continue;
    paged = true;
    const full = v.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (full) { year = +full[1]; month = +full[2]; day = full[3] ? +full[3] : undefined; continue; }
    if (/^(year|yr|y|cal_year|calyear)$/i.test(k) && /^\d{4}$/.test(v)) year = +v;
    else if (/^(month|mon|m|cal_month|calmonth)$/i.test(k) && /^\d{1,2}$/.test(v)) month = +v;
    else if (/^(ym|yearmonth)$/i.test(k)) { const m = v.match(/^(\d{4})-?(\d{2})$/); if (m) { year = +m[1]; month = +m[2]; } }
    else if (/^(day|d)$/i.test(k) && /^\d{1,2}$/.test(v)) day = +v;
  }
  let past = false;
  if (year) {
    const now = new Date();
    const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1, curD = now.getUTCDate();
    if (year < curY) past = true;
    else if (year === curY && month && month < curM) past = true;
    else if (year === curY && month === curM && day && day < curD - 1) past = true;
  }
  return { paged, past };
}

function stripPaging(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (PAGE_KEYS.test(k) || DATE_KEYS.test(k)) u.searchParams.delete(k);
    u.pathname = u.pathname.replace(/\/page\/\d+\/?$/i, "/");
    return u.href.replace(/\?$/, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

const NEXT_TEXT = /^(next|next page|next events|more events|load more|show more|older|›|»|>|→|suivant|suivante|page suivante|siguiente|weiter|nächste|volgende|nästa|næste|neste|successivo|próximo|proxima)$/i;

/**
 * Pagination of THIS listing: "next" links, rel=next, /page/N, and links to the same calendar that differ only
 * by page or date settings (?ao_pg=2, ?month=12&year=2026). Past months / days are never followed.
 */
export function findPaginationLinks($: CheerioAPI, pageUrl: string): string[] {
  const out = new Set<string>();
  const self = canonicalUrl(pageUrl);
  const base = stripPaging(self || pageUrl);
  const add = (href?: string, requireSameCalendar = false) => {
    if (!href) return;
    const c = canonicalUrl(href, pageUrl);
    if (!c || c === self || !isSameSite(c, pageUrl)) return;
    const info = pagingInfo(c);
    if (info.past) return;
    if (requireSameCalendar && (!info.paged || stripPaging(c) !== base)) return;
    out.add(c);
  };
  $('link[rel="next"], a[rel="next"]').each((_, el) => add($(el).attr("href")));
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    const t = cleanStr($(a).text()) || cleanStr($(a).attr("aria-label")) || cleanStr($(a).attr("title"));
    if (NEXT_TEXT.test(t) || /^next( page)?$/i.test(cleanStr($(a).attr("aria-label")))) add(href);
    else add(href, true);
  });
  return [...out].filter((u) => !/\b(past|previous|prev|archive)\b|tribe_event_display=past|eventDisplay=past/i.test(u));
}

/** News / blog article (never a hub). */
export function isArticlePage($: CheerioAPI): boolean {
  if (/^article$/i.test(cleanStr($('meta[property="og:type"]').attr("content")))) return true;
  let article = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    const t = $(el).html() || "";
    if (/"@type"\s*:\s*"(NewsArticle|Article|BlogPosting|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle)"/.test(t)) article = true;
  });
  return article;
}

export function classifyPage(input: {
  $: CheerioAPI;
  url: string;
  events: ExtractedEvent[];
  venueCount: number;
  hasPagination: boolean;
  fetchStatus?: FetchStatus;
}): PageClass {
  const { $, url, events, venueCount } = input;
  if (input.fetchStatus === "js_shell" && !events.length) return "js_shell";
  if (!events.length) {
    if (isArticlePage($)) return "article";
    return venueCount > 0 ? "facility" : "empty";
  }
  if (events.length === 1 && !input.hasPagination) {
    const self = canonicalUrl(url);
    const ev = events[0];
    const evUrl = ev.officialInfoUrl ? canonicalUrl(ev.officialInfoUrl) : null;
    if (evUrl === self || !isListingShaped(url)) return "detail";
  }
  if (isArticlePage($) && events.length <= 1) return "article";
  return "hub";
}

/** Venues / performers / organizers on the page, with the URL the page itself gives (never guessed). */
export function collectEntities(events: ExtractedEvent[], siteVenueLinks: { name: string; url: string }[]): FoundEntity[] {
  const out = new Map<string, FoundEntity>();
  const add = (name: string | undefined, type: FoundEntity["type"], url?: string) => {
    const n = cleanStr(name);
    if (!n || n.length < 2 || n.length > 120) return;
    const u = url && !isTicketBrokerUrl(url) && isValidCalendarSourceUrl(url) ? canonicalUrl(url) || undefined : undefined;
    const key = `${type}|${n.toLowerCase()}`;
    const prev = out.get(key);
    if (!prev) out.set(key, { name: n, type, url: u });
    else if (!prev.url && u) prev.url = u;
  };
  for (const e of events) {
    add(e.venue, "venue", e.venueUrl);
    add(e.performerName, "performer", e.performerUrl);
    if (e.organizerName && e.organizerName !== e.venue) add(e.organizerName, "organization", e.organizerUrl);
  }
  for (const v of siteVenueLinks) add(v.name, "venue", v.url);
  return [...out.values()];
}

/** Design-only handler that should take this page (sources sort themselves into handler queues). */
export function detectHandlerQueue(url: string, fetchStatus: FetchStatus | undefined, events: ExtractedEvent[], pageClass: PageClass): string | undefined {
  if (fetchStatus === "waf_blocked") return "waf_blocked";
  if (pageClass === "js_shell" || fetchStatus === "js_shell") return "js_shell";
  if (/(19|20)\d{2}[-_](19|20)?\d{2}/.test(url)) return "season_url";
  if (events.length >= 3) {
    const noTime = events.filter((e) => !e.startTime).length;
    if (noTime / events.length >= 0.5) return "offsite_start_time";
  }
  return undefined;
}
