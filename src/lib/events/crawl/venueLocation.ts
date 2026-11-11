// src/lib/events/crawl/venueLocation.ts
//
// Venue-stated location (owner decision, 2026-11-10):
//   A venue's OWN address, read from the venue's OWN site and verified by resolveLocation(), may be applied
//   to events listed on that same site's calendar, when the event card itself states no location.
//   - A location stated on the event always wins (events that already have a location are never touched).
//   - Single-venue sites: an event with no venue name gets the site's one verified venue.
//   - Multi-venue sites (a performing-arts group with several halls): an event gets the address only when its
//     venue name matches a venue whose address the SAME site states (its own venue pages).
//   - Anything else (unknown venue name, several venues and no name) gets nothing and stays unlocated.
//   - Never a parent source's city, never a default, never another site's address.
//
// Pure parsing is separated from network / geocoding so it can be tested offline.

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { ExtractedEvent } from "./types";
import { cleanStr, hasAnyLocation, joinAddress, toNum } from "./helpers";

export interface VenueCandidate {
  name: string;
  address: string;
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  url?: string;
  evidenceUrl: string;
  from: "jsonld" | "microdata" | "address_text";
}

export interface SiteVenue extends VenueCandidate {
  citySlug: string;
  verifiedCity: string;
}

export type VenueVerifier = (c: VenueCandidate) => Promise<{ citySlug: string; cityName: string } | null>;
export type PageFetcher = (url: string) => Promise<string | null>;

const PLACE_TYPES = /^(Place|EventVenue|StadiumOrArena|PerformingArtsTheater|MusicVenue|CivicStructure|TouristAttraction|Museum|LocalBusiness|Organization|NightClub|BarOrPub|Restaurant|Winery|Brewery|Distillery|AmusementPark|Park|Zoo|Aquarium|Library|Church|PlaceOfWorship|EntertainmentBusiness|SportsActivityLocation|ArenaVenue|ConventionCenter|EducationalOrganization|CollegeOrUniversity|GovernmentOrganization|Fairground|Campground|Hotel|LodgingBusiness|Stadium|MovieTheater|ComedyClub|ArtGallery)$/;

function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
function sameSite(a: string, b: string): boolean {
  const ha = host(a), hb = host(b);
  return !!ha && !!hb && (ha === hb || ha.endsWith("." + hb) || hb.endsWith("." + ha));
}

export function normalizeVenueName(s?: string | null): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|at)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function venueNamesMatch(a?: string | null, b?: string | null): boolean {
  const x = normalizeVenueName(a), y = normalizeVenueName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && (long.startsWith(short + " ") || long.endsWith(" " + short) || long.includes(" " + short + " "));
}

/** A street-level address: "1400 Edwards Mill Rd", "Drottninggatan 12", "12 rue de Rivoli". */
export function looksLikeStreetAddress(a?: string | null): boolean {
  const s = String(a || "").trim();
  if (s.length < 8 || s.length > 220) return false;
  return /\p{L}{3,}[\p{L} .'-]*\s\d{1,5}[a-zA-Z]?\b/u.test(s) || /\b\d{1,5}[a-zA-Z]?,?\s+\p{L}{2,}[\p{L} .'-]*\p{L}{2,}/u.test(s);
}

function siteNameOf($: CheerioAPI): string {
  const og = cleanStr($('meta[property="og:site_name"]').attr("content"));
  if (og) return og;
  const t = cleanStr($("title").first().text());
  const parts = t.split(/\s[|\-–—·]\s/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function text(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return cleanStr(v);
  if (typeof v === "object") return cleanStr(v.name || v["@value"] || "");
  return "";
}

function fromPostal(addr: any): { street?: string; city?: string; region?: string; country?: string; address: string } {
  if (!addr) return { address: "" };
  if (typeof addr === "string") return { address: cleanStr(addr) };
  const a = Array.isArray(addr) ? addr[0] || {} : addr;
  const street = text(a.streetAddress), city = text(a.addressLocality), region = text(a.addressRegion), country = text(a.addressCountry);
  const regionPostal = [region, text(a.postalCode)].filter(Boolean).join(" ");
  return { street: street || undefined, city: city || undefined, region: region || undefined, country: country || undefined, address: joinAddress(street, city, regionPostal, country) };
}

/** Venue/organization addresses that THIS page states about the site itself (not event locations). */
export function readVenueCandidates($: CheerioAPI, pageUrl: string, nameHint?: string): VenueCandidate[] {
  const out: VenueCandidate[] = [];
  const siteName = siteNameOf($);

  // 1. JSON-LD Place / Organization objects (never ones nested inside an Event: those are event locations)
  const walk = (o: any, insideEvent: boolean) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, insideEvent));
    if (Array.isArray(o["@graph"])) return o["@graph"].forEach((x: any) => walk(x, insideEvent));
    const types = (Array.isArray(o["@type"]) ? o["@type"] : [o["@type"]]).filter((t: any) => typeof t === "string");
    const isEvent = types.some((t: string) => /Event$/.test(t) || t === "Festival");
    if (!insideEvent && !isEvent && types.some((t: string) => PLACE_TYPES.test(t))) {
      const p = fromPostal(o.address);
      const lat = toNum(o.geo?.latitude), lon = toNum(o.geo?.longitude);
      const name = cleanStr(o.name) || nameHint || siteName;
      if (name && (looksLikeStreetAddress(p.street || p.address) || (lat !== undefined && lon !== undefined))) {
        out.push({ name, ...p, lat, lon, url: typeof o.url === "string" ? o.url : undefined, evidenceUrl: pageUrl, from: "jsonld" });
      }
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === "address" || k === "geo") continue;
      if (v && typeof v === "object") walk(v, insideEvent || isEvent);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { walk(JSON.parse($(el).html() || ""), false); } catch { /* malformed block */ }
  });

  // 2. Microdata PostalAddress outside of event cards
  $('[itemprop="address"], [itemtype*="PostalAddress"]').each((_, el) => {
    const $el = $(el);
    if ($el.closest('[itemtype*="Event"]').length) return;
    const street = cleanStr($el.find("[itemprop='streetAddress']").first().text());
    const city = cleanStr($el.find("[itemprop='addressLocality']").first().text());
    const region = cleanStr($el.find("[itemprop='addressRegion']").first().text());
    const postal = cleanStr($el.find("[itemprop='postalCode']").first().text());
    const country = cleanStr($el.find("[itemprop='addressCountry']").first().text());
    if (!looksLikeStreetAddress(street)) return;
    const owner = $el.closest("[itemscope]").not($el);
    const name = cleanStr(owner.find("[itemprop='name']").first().text()) || nameHint || siteName;
    if (!name) return;
    out.push({ name, street, city: city || undefined, region: region || undefined, country: country || undefined,
      address: joinAddress(street, city, [region, postal].filter(Boolean).join(" "), country), evidenceUrl: pageUrl, from: "microdata" });
  });

  // 3. <address> elements and address-classed blocks in the footer / contact areas (site's own address)
  if (!out.length) {
    const seen = new Set<string>();
    $("address, footer [class*='address'], footer [class*='location'], [class*='contact'] [class*='address'], [class*='venue-address'], [class*='venue_address'], [class*='venueAddress']").each((_, el) => {
      const $el = $(el);
      if ($el.closest("[class*='event'], [itemtype*='Event']").length && !$el.closest("footer").length) return;
      const clone = $el.clone();
      clone.find("br").replaceWith(", ");
      clone.find("p, div, li").append(", ");
      const raw = cleanStr(clone.text()).replace(/\s*,\s*(,\s*)+/g, ", ").replace(/^,\s*|,\s*$/g, "");
      // Keep the address part only (drop phone numbers / emails / "Get directions").
      const addr = raw.split(/\s(?:phone|tel|t:|call|email|e-mail|box office|get directions|directions|map)\b/i)[0].replace(/[,\s]+$/, "").trim();
      if (!looksLikeStreetAddress(addr) || seen.has(addr)) return;
      seen.add(addr);
      const name = nameHint || siteName;
      if (name) out.push({ name, address: addr, evidenceUrl: pageUrl, from: "address_text" });
    });
  }
  return out;
}

/** Same-site links to the site's own venue pages ("/venues/detail/belk-theater") with their link text. */
export function readVenueDirectoryLinks($: CheerioAPI, pageUrl: string): { name: string; url: string }[] {
  const out = new Map<string, string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    let u: URL;
    try { u = new URL(href, pageUrl); } catch { return; }
    if (!sameSite(u.href, pageUrl)) return;
    if (!/\/(venues?|locations?|facilities|facility|spaces|theat(?:er|re)s?|halls?|stages?)\/(?:detail\/|details\/)?[^/?#]+\/?$/i.test(u.pathname)) return;
    const name = cleanStr($(a).text()) || cleanStr($(a).attr("title"));
    if (!name || name.length < 3 || name.length > 80 || /^(more|info|details|view|learn more|more info)$/i.test(name)) return;
    u.hash = "";
    if (!out.has(u.href)) out.set(u.href, name);
  });
  return [...out.entries()].map(([url, name]) => ({ url, name }));
}

/** Same-site contact / visit / directions pages (only links the site itself shows; never guessed). */
export function readContactLinks($: CheerioAPI, pageUrl: string): string[] {
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    let u: URL;
    try { u = new URL(href, pageUrl); } catch { return; }
    if (!sameSite(u.href, pageUrl)) return;
    const label = `${u.pathname} ${cleanStr($(a).text())}`.toLowerCase();
    if (/(contact|visit|plan[- ]your[- ]visit|directions|getting[- ]here|find[- ]us|location|parking|about)/.test(label) && u.pathname.split("/").filter(Boolean).length <= 2) {
      u.hash = "";
      out.add(u.href);
    }
  });
  return [...out];
}

/** Events on this page that state no location of their own. */
function unlocated(events: ExtractedEvent[]): ExtractedEvent[] {
  return events.filter((e) => !hasAnyLocation(e));
}

/**
 * Read and verify the venue addresses the site states about itself, as needed for the events on this page.
 * Fetches only the site's own pages (venue pages named by unlocated events, then contact/visit pages).
 */
export async function collectSiteVenues(
  html: string,
  pageUrl: string,
  events: ExtractedEvent[],
  fetcher: PageFetcher,
  verify: VenueVerifier
): Promise<SiteVenue[]> {
  const need = unlocated(events);
  if (!need.length) return [];
  const $ = cheerio.load(html);
  const candidates: VenueCandidate[] = readVenueCandidates($, pageUrl);

  // Venue pages for venue names that unlocated events mention (multi-venue organizations).
  const neededNames = new Set(need.map((e) => e.venue).filter(Boolean));
  if (neededNames.size) {
    for (const link of readVenueDirectoryLinks($, pageUrl)) {
      if (![...neededNames].some((n) => venueNamesMatch(n, link.name))) continue;
      if (candidates.some((c) => venueNamesMatch(c.name, link.name))) continue;
      const page = await fetcher(link.url);
      if (!page) continue;
      const found = readVenueCandidates(cheerio.load(page), link.url, link.name).map((c) => ({ ...c, name: link.name, url: link.url }));
      candidates.push(...found.slice(0, 1));
    }
  }

  // Contact / visit pages, only when the page states no address of its own.
  if (!candidates.length) {
    for (const link of readContactLinks($, pageUrl)) {
      const page = await fetcher(link);
      if (!page) continue;
      const found = readVenueCandidates(cheerio.load(page), link, siteNameOf($) || undefined);
      if (found.length) { candidates.push(...found); break; }
    }
  }

  const verified: SiteVenue[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${normalizeVenueName(c.name)}|${normalizeVenueName(c.address)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const v = await verify(c);
    if (v) verified.push({ ...c, citySlug: v.citySlug, verifiedCity: v.cityName });
  }
  return verified;
}

export type VenueLocationStatus = "verified" | "none" | "multi_venue";

/**
 * Apply verified site venues to events that state no location. Mutates events; returns how many were placed.
 * A stated location always wins: events that have any location are never touched.
 */
export function applySiteVenues(events: ExtractedEvent[], venues: SiteVenue[]): { applied: number; status: VenueLocationStatus } {
  if (!venues.length) return { applied: 0, status: "none" };
  // Distinct physical venues (one site can state the same address under two names).
  const distinct = new Set(venues.map((v) => v.citySlug + "|" + normalizeVenueName(v.street || v.address)));
  // Events naming two or more different venues: this is not a single-venue calendar, so an event with no
  // venue name cannot be placed at the site's address.
  const namedVenues = new Set(events.map((e) => normalizeVenueName(e.venue)).filter(Boolean));
  let applied = 0;
  let unmatchedNamed = false;
  for (const ev of events) {
    if (hasAnyLocation(ev)) continue;
    let v: SiteVenue | undefined;
    if (ev.venue) {
      v = venues.find((x) => venueNamesMatch(ev.venue, x.name));
      if (!v) unmatchedNamed = true;
    } else if (distinct.size === 1 && namedVenues.size < 2) {
      v = venues[0];
    }
    if (!v) continue;
    ev.address = v.address;
    if (v.city) ev.city = v.city;
    if (v.region) ev.region = v.region;
    if (v.country) ev.country = v.country;
    if (v.lat !== undefined && v.lon !== undefined) { ev.lat = v.lat; ev.lon = v.lon; }
    if (!ev.venue) ev.venue = v.name;
    if (!ev.venueUrl && v.url) ev.venueUrl = v.url;
    ev.locationProvenance = "venue_site";
    applied++;
  }
  return { applied, status: distinct.size > 1 || unmatchedNamed ? "multi_venue" : "verified" };
}
