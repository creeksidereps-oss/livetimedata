// src/lib/discovery/adapters.ts
//
// Site-specific readers ("adapters") for sources whose events are not in plain HTML.
// The adapter name + config are stored on the `sources` row (columns `adapter`, `adapter_config`),
// so every 30-day re-crawl knows exactly how to read that site again.
//
// All adapters are $0: plain HTTP requests only (no AI, no Google, no headless browser).
// True-information rule: nothing is invented. Missing time => "" (pending_review), missing location => "".
// Location fields (city / region / country / address / lat / lon) are only what the site states for that
// event; adapter results are ingested through ingestCrawledEvents() -> publishEvent().

import { categorizeEvent, cleanHtmlEntitiesAndTags, isOnlineOrVirtualEvent, toNum } from "@/lib/events/crawl/helpers";
import type { ExtractedEvent } from "@/lib/events/crawl/types";
import { parseAddressHints } from "@/lib/events/location/resolveLocation";

export type SpawnCandidate = {
  name: string;            // organizer / venue name as given by the site
  url: string;             // real URL found on the page (never constructed)
  kind: "organizer" | "venue" | "listing";
  foundOn: string;         // event page it was found on
  eventTitle: string;
};

export type AdapterResult = {
  events: ExtractedEvent[];
  spawns: SpawnCandidate[];
  notes: string[];
  pagesFetched: number;
  /** Recurring/ongoing listings with no specific upcoming date given (held for review, never dated by us). */
  ongoing: { title: string; url: string; startDate?: string; endDate?: string }[];
};

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Domains that are never an organizer/venue site (assets, social, sharing, ticket platforms, registration systems). */
const NON_ENTITY_HOST =
  /(simpleviewinc|sharefile|facebook|instagram|twitter|x\.com|youtube|linkedin|reddit|pinterest|tiktok|tripadvisor|bootstrapcdn|googleapis|google\.|gstatic|cloudflare|jsdelivr|saffire|ticketmaster|eventbrite|seatgeek|stubhub|vividseats|etix|axs\.com|bandsintown|songkick|myvscloud|apple\.com|mailchimp|constantcontact|wix|squarespace|vimeo|spotify)/i;

/**
 * Parse the first real start time from free text ("Times: Thurs., 6-7pm", "12-5 pm", "7:30 PM", "10am-2pm").
 * Returns "" when no unambiguous time exists (never guesses AM/PM).
 */
export function parseStartTime(text: string): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ");
  // range: 6-7pm / 12 - 5 pm / 10am-2pm / 6:30-9:00 PM
  const range = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (range) {
    let ap = (range[3] || "").replace(/\./g, "").toLowerCase();
    const endAp = range[6].replace(/\./g, "").toLowerCase();
    const h1 = parseInt(range[1], 10);
    const h2 = parseInt(range[4], 10);
    if (!ap) {
      // inherit end meridiem unless that would put start after end (e.g. "11-2pm" => 11 AM)
      ap = endAp;
      if (endAp === "pm" && h1 > h2 && h1 !== 12) ap = "am";
    }
    if (h1 >= 1 && h1 <= 12) return `${h1}:${range[2] || "00"} ${ap.toUpperCase()}`;
  }
  const single = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (single) {
    const h = parseInt(single[1], 10);
    if (h >= 1 && h <= 12) return `${h}:${single[2] || "00"} ${single[3].replace(/\./g, "").toUpperCase()}`;
  }
  return "";
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const x = items[i++];
        try { await fn(x); } catch { /* per-item failure is recorded by fn */ }
      }
    })
  );
}

function externalLinks(html: string, ownHost: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    const u = m[1].replace(/&amp;/g, "&");
    try {
      const h = new URL(u).hostname;
      if (h.includes(ownHost) || NON_ENTITY_HOST.test(h) || /\{\{/.test(u) || /\.(pdf|png|jpe?g|gif|css|js)(\?|$)/i.test(u)) continue;
      out.add(u);
    } catch { /* ignore */ }
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Adapter 1: Simpleview CVB sites (e.g. visitraleigh.com)
//   The list pages are JS-rendered and the JSON feed is bot-protected, but the public sitemap lists
//   every /event/ page, and each event page carries schema.org Event JSON-LD.
//   config: { base: "https://www.visitraleigh.com" }
// ---------------------------------------------------------------------------
export async function simpleviewSitemap(cfg: { base: string; concurrency?: number }): Promise<AdapterResult> {
  const base = cfg.base.replace(/\/$/, "");
  const ownHost = new URL(base).hostname.replace(/^www\./, "");
  const res: AdapterResult = { events: [], spawns: [], notes: [], pagesFetched: 0, ongoing: [] };

  const sm = await (await fetch(`${base}/sitemap.xml`, { headers: UA })).text();
  res.pagesFetched++;
  const urls = [...new Set(sm.match(new RegExp(`${base.replace(/[.]/g, "\\.")}/event/[^<\\s]+`, "g")) || [])];
  res.notes.push(`sitemap event pages: ${urls.length}`);
  let past = 0, failed = 0, noLd = 0, ongoing = 0;

  await pool(urls, cfg.concurrency ?? 6, async (u) => {
    let html = "";
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) });
      res.pagesFetched++;
      if (!r.ok) { failed++; return; }
      html = await r.text();
    } catch { failed++; return; }

    const ldRaw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ldRaw) { noLd++; return; }
    let ev: any;
    try {
      const ld = JSON.parse(ldRaw[1]);
      ev = (ld["@graph"] || [ld]).find((x: any) => x["@type"] === "Event");
    } catch { noLd++; return; }
    if (!ev?.name || !ev?.startDate) { noLd++; return; }

    const end = (ev.endDate || ev.startDate).slice(0, 10);
    if (end < todayStr()) { past++; return; } // current & future only
    // Ongoing/recurring listings whose start date already passed: the page doesn't give the next real
    // occurrence date, so we do NOT invent one. Counted for review instead.
    if (ev.startDate.slice(0, 10) < todayStr()) { ongoing++; res.ongoing.push({ title: ev.name, url: u, startDate: ev.startDate, endDate: ev.endDate }); return; }
    const start = ev.startDate.slice(0, 10);

    const loc = ev.location || {};
    const a = loc.address || {};
    const street = (a.streetAddress || "").trim();
    const city = (a.addressLocality || "").trim();
    const state = (a.addressRegion || "").trim();
    const zip = (a.postalCode || "").trim();
    const venueAddress = street ? [street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";

    const timesText = (html.replace(/<[^>]+>/g, " ").match(/Times?:\s*([^<]{0,120}?)(Admission:|Recurrence|$)/i) || [])[1] || "";
    const startTime = parseStartTime(timesText);
    const details = cleanHtmlEntitiesAndTags(ev.description || "") || "";
    const img = typeof ev.image === "string" ? ev.image : ev.image?.url;
    // In-person only: never ingest online/virtual events.
    if (isOnlineOrVirtualEvent(ev.name, details, loc.name, u)) { res.notes.push(`online/virtual skipped: ${ev.name}`); return; }

    const links = externalLinks(html, ownHost);
    const hostSite = links[0];

    const country = (typeof a.addressCountry === "string" ? a.addressCountry : a.addressCountry?.name || "").trim();
    const lat = toNum(loc.geo?.latitude);
    const lon = toNum(loc.geo?.longitude);
    res.events.push({
      title: cleanHtmlEntitiesAndTags(ev.name),
      city: city || undefined,
      region: state || undefined,
      country: country || undefined,
      address: venueAddress || undefined,
      lat: lat !== undefined && lon !== undefined ? lat : undefined,
      lon: lat !== undefined && lon !== undefined ? lon : undefined,
      venue: (loc.name || "").trim(),
      category: categorizeEvent(ev.name, details),
      startTime,
      eventDate: start,
      details,
      officialInfoUrl: hostSite || u,
      eventFlyerUrl: img || undefined,
      sourceUrl: u,
      organizerName: ev.organizer?.name || undefined,
      organizerUrl: hostSite || undefined,
      strategy: "adapter_simpleview_sitemap",
    });

    for (const l of links) {
      res.spawns.push({ name: ev.organizer?.name || loc.name || "", url: l, kind: "organizer", foundOn: u, eventTitle: ev.name });
    }
    if (loc["@id"] && String(loc["@id"]).includes("/listing/")) {
      res.spawns.push({ name: loc.name || "", url: String(loc["@id"]).replace(/#.*$/, ""), kind: "listing", foundOn: u, eventTitle: ev.name });
    }
  });

  res.notes.push(`past/expired skipped: ${past}`, `page fetch failed: ${failed}`, `no event data on page: ${noLd}`, `ongoing/recurring without a specific next date: ${ongoing}`);
  return res;
}

// ---------------------------------------------------------------------------
// Adapter 2: Saffire event calendars (e.g. ncfestivals.com)
//   The list lazy-loads from the site's own ASMX service; we call the same service.
//   config: { base: "https://www.ncfestivals.com" }
// ---------------------------------------------------------------------------
export async function saffireEvents(cfg: { base: string; monthsAhead?: number }): Promise<AdapterResult> {
  const base = cfg.base.replace(/\/$/, "");
  const ownHost = new URL(base).hostname.replace(/^www\./, "");
  const svc = `${base}/services/eventsservice.asmx`;
  const H = { ...UA, "Content-Type": "application/json; charset=utf-8" };
  const res: AdapterResult = { events: [], spawns: [], notes: [], pagesFetched: 0, ongoing: [] };
  const common =
    "'categoryID':0,'tagID':0,'keywords':'%%','isFeatured':'false','fanPicks':'false','pastEvents':'false','allEvents':'true'," +
    "'memberEvents':'false','memberOnly':'false','showCategoryExceptionID':0,'isolatedSchedule':0,'customFieldFilters':[],'searchInDescription':false";
  const d0 = new Date();
  const d1 = new Date(Date.now() + (cfg.monthsAhead ?? 12) * 30 * 864e5);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

  const daysRes = await fetch(`${svc}/GetEventDays`, {
    method: "POST", headers: H, signal: AbortSignal.timeout(20000),
    body: `{'day':'','startDate':'${fmt(d0)}','endDate':'${fmt(d1)}','currentUserItems':'false','myPicks':'false',${common}}`,
  });
  res.pagesFetched++;
  const dates: string[] = (await daysRes.json()).d || [];
  res.notes.push(`calendar days with events: ${dates.length}`);

  // map pins (lat/lng) keyed by event id, when the site has them
  const pins = new Map<number, { lat: number; lng: number }>();
  try {
    const m = await fetch(`${svc}/GetEventMapData`, {
      method: "POST", headers: H, signal: AbortSignal.timeout(20000),
      body: `{'day':'','startDate':'${fmt(d0)}','endDate':'${fmt(d1)}','currentUserItems':'false','publicGUID':'','myPicks':'false',${common}}`,
    });
    res.pagesFetched++;
    for (const mk of (await m.json()).d?.Markers || []) for (const it of mk.Items || []) pins.set(it.ID, { lat: mk.Lat, lng: mk.Lng });
  } catch { /* optional */ }

  const seen = new Map<number, any>();
  for (let i = 0; i < dates.length; i += 30) {
    const r = await fetch(`${svc}/GetEventDaysByList`, {
      method: "POST", headers: H, signal: AbortSignal.timeout(20000), body: `{'dates':'${dates.slice(i, i + 30).join(",")}','day':'',${common}}`,
    });
    res.pagesFetched++;
    const days = (await r.json()).d?.Days || [];
    for (const day of days)
      for (const tm of day.Times || [])
        for (const it of tm.Items || []) {
          if (it.IsPrivate || it.IsMemberOnly) continue;
          if (!seen.has(it.EventID)) seen.set(it.EventID, { ...it, _firstDate: `${day.Year}-${String(day.Month).padStart(2, "0")}-${String(day.Day).padStart(2, "0")}` });
        }
  }
  res.notes.push(`unique public events: ${seen.size}`);

  for (const it of seen.values()) {
    const descHtml: string = it.LongDescription || it.ShortDescription || "";
    const details = cleanHtmlEntitiesAndTags(descHtml);
    const loc = (it.Locations || [])[0] || {};
    let street = (loc.Address1 || loc.Address || "").trim();
    let city = (loc.City || "").trim();
    let state = (loc.State || "").trim();
    let zip = (loc.Zip || loc.PostalCode || "").trim();
    let venue = (loc.Name || "").trim();
    let country = (loc.Country || "").trim();

    // Fall back to reading venue and city/state stated in the description HTML text
    if (!city && !street) {
      const lines = descHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .split("\n")
        .map((l) => cleanHtmlEntitiesAndTags(l).trim())
        .filter(Boolean);

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        // Explicit "Location: ..." or "Venue: ..." label
        const locLabel = l.match(/^(?:location|venue|where|held at):\s*(.+)$/i);
        if (locLabel) {
          const rest = locLabel[1].trim();
          const next = lines[i + 1] || "";
          const hints = parseAddressHints(`${rest}, ${next}`);
          if (hints.region && hints.cityTokens.length) {
            venue = venue || rest;
            city = hints.cityTokens[0].replace(/^(?:downtown|historic|uptown|old town)\s+/i, "").trim();
            state = hints.region;
            street = rest;
            break;
          }
          if (!venue) venue = rest;
        }

        // Check if the line itself contains an address hint with a recognized region
        const hints = parseAddressHints(l);
        if (hints.region && hints.cityTokens.length) {
          const potCity = hints.cityTokens[0].replace(/^(?:downtown|historic|uptown|old town)\s+/i, "").trim();
          if (potCity.length >= 2 && potCity.length < 35 && !/(?:january|february|march|april|may|june|july|august|september|october|november|december|admission|ticket|hours|cost|registration|schedule)/i.test(potCity)) {
            city = potCity;
            state = hints.region;
            street = l;
            break;
          }
        }
      }
    }

    const venueAddress = street ? [street, city && city !== street ? city : "", [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
    const startTime = it.EventTimeRangeString ? parseStartTime(it.EventTimeRangeString) : parseStartTime(details);
    const links = externalLinks(descHtml.replace(/\\"/g, '"'), ownHost);
    // also accept bare "www.example.com" text in descriptions (real text on the page, not constructed)
    for (const m of details.matchAll(/\bwww\.[a-z0-9-]+(\.[a-z0-9-]+)+\b/gi)) {
      const u = `https://${m[0]}`;
      if (!NON_ENTITY_HOST.test(u) && !links.includes(u)) links.push(u);
    }
    const pin = pins.get(it.EventID);
    // In-person only: never ingest online/virtual events.
    if (isOnlineOrVirtualEvent(it.Name, details, loc.Name, it.DetailURL)) { res.notes.push(`online/virtual skipped: ${it.Name}`); continue; }

    res.events.push({
      title: cleanHtmlEntitiesAndTags(it.Name),
      city: city || undefined,
      region: state || undefined,
      country: country || undefined,
      address: venueAddress || undefined,
      lat: toNum(pin?.lat),
      lon: toNum(pin?.lng),
      venue: venue || (loc.Name || "").trim(),
      category: categorizeEvent(it.Name, details),
      startTime,
      eventDate: it._firstDate,
      details,
      officialInfoUrl: links[0] || it.DetailURL,
      eventFlyerUrl: it.ImageExists ? it.ImageOrVideoThumbnailWithPath : undefined,
      sourceUrl: it.DetailURL || base,
      organizerUrl: links[0] || undefined,
      strategy: "adapter_saffire",
    });

    for (const l of links) res.spawns.push({ name: it.Name, url: l, kind: "organizer", foundOn: it.DetailURL || base, eventTitle: it.Name });
  }
  return res;
}

export const ADAPTERS: Record<string, (cfg: any) => Promise<AdapterResult>> = {
  simpleview_sitemap: simpleviewSitemap,
  saffire_events: saffireEvents,
};
