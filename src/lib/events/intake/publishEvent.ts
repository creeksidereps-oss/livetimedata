// src/lib/events/intake/publishEvent.ts
//
// THE ONLY FUNCTION ALLOWED TO WRITE NEW ROWS TO `events`.
// Every intake path (crawlers, crons, user submissions, admin tools, yard-sale cron, vision ingest)
// must call publishEvent(). It enforces the 7 publishing rules and logs every decision.
//
//  1. Real title from the source (no id_####, times, bare place names, venue-only titles)
//  2. Real venue address (specific street address, or venue name + source-published coordinates)
//  3. Verified city (canonical slug + coordinates + country) via resolveLocation() - no defaults
//  4. Real date (today or later in the event's own timezone) + confirmed start time (TBD/TBA -> pending_review)
//  5. Real description from the source page (no templates, no AI filler)
//  6. Crawlable source URL (crawler origins)
//  7. Not a duplicate

import { pool } from "@/lib/db";
import { areEventsDuplicates } from "@/lib/events/dedup";
import { resolveLocation, type LocationHints, type VerifiedLocation } from "@/lib/events/location/resolveLocation";
import { distanceKm, isRealCoordinate, normalizeGeoText } from "@/lib/events/location/geoReference";

export type IntakeOrigin =
  | "crawler" | "rescrape" | "spider_daemon" | "discover_entity" | "admin_scraper" | "trigger" // automated
  | "user_submission" | "quick_post" | "vision" | "admin_curation" | "yardsale";              // human / special

const HUMAN_ORIGINS = new Set<IntakeOrigin>(["user_submission", "quick_post", "vision", "admin_curation"]);

export interface EventSubmission {
  origin: IntakeOrigin;
  title: string;
  details?: string | null;
  category?: string | null;
  venue?: string | null;
  venueAddress?: string | null;
  startTime?: string | null;
  eventDate: Date | string;
  /** Location exactly as the source states it. Never pass a parent/default city here. */
  location: LocationHints;
  /** 'sale' = yard/garage/boot/estate sale, auction, flea market. Auto-detected if omitted. */
  kind?: "event" | "sale";
  source?: string | null;
  sourceUrl?: string | null;
  hostingEntity?: string | null;
  officialInfoUrl?: string | null;
  registrationUrl?: string | null;
  affiliateUrl?: string | null;
  eventFlyerUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialUrls?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  franchiseId?: number | null;
  /** Admin tools may force pending_review; nothing can force 'live' past a failed rule. */
  forcePending?: boolean;
  /** Crawler handler / extraction strategy that produced this submission (logged only; spider repair 2026-11-10). */
  handler?: string | null;
  /** 'venue_site' when the location is the venue's own stated address on its own site (logged only). */
  locationProvenance?: "event" | "venue_site" | null;
}

export type IntakeOutcome = "published" | "pending_review" | "rejected" | "duplicate" | "retry";

export interface IntakeResult {
  outcome: IntakeOutcome;
  id?: number;
  reasons: string[];
  detail?: string;
  location?: VerifiedLocation;
}

// ---------- rule helpers (exported for tests) ----------

export function detectKind(title: string, category?: string | null): "event" | "sale" {
  const t = `${category || ""} ${title}`;
  return /\b(yard sale|garage sale|estate sale|rummage sale|tag sale|moving sale|car boot|boot sale|jumble sale|flea market|swap meet|auction|lien sale|vide[- ]grenier|brocante|flohmarkt|rommelmarkt|loppis)\b/i.test(t) ||
    /\b(yard|garage|estate)\b/i.test(category || "")
    ? "sale"
    : "event";
}

export function titleProblem(title: string, venue?: string | null): string | null {
  const t = String(title || "").replace(/\s+/g, " ").trim();
  if (t.length < 3) return "title_missing";
  if (/^id_\d+/i.test(t)) return "title_is_id";
  if (/^[\d\s:.\/-]+(am|pm)?$/i.test(t)) return "title_is_time_or_date";
  if (/^(untitled|event|tbd|tba|null|undefined|calendar|events?)$/i.test(t)) return "title_placeholder";
  if (venue && normalizeGeoText(t) === normalizeGeoText(venue)) return "title_is_venue";
  return null;
}

const TEMPLATE_DESCRIPTIONS: RegExp[] = [
  /\blive in concert at\b/i,           // crawler/daemon template
  /,\s*\.\s*$/,                         // "... in Stockholm, ."  (empty placeholder interpolation)
  /^join us at .{1,80} for .{1,120}!?$/i, // old admin-scraper template
];
export function descriptionProblem(details: string | null | undefined, title: string): string | null {
  const d = String(details || "").replace(/\s+/g, " ").trim();
  if (!d) return "description_missing";
  if (normalizeGeoText(d) === normalizeGeoText(title)) return "description_is_title";
  // "{title} in {city}." / "{title} at {venue}." one-liners built from the title
  const t = String(title || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (t && d.toLowerCase().startsWith(t) && /^\s+(in|at)\s+[^.]{2,80}\.?$/i.test(d.slice(t.length))) return "description_templated";
  if (d.length < 20) return "description_too_short";
  if (TEMPLATE_DESCRIPTIONS.some((re) => re.test(d))) return "description_templated";
  return null;
}

/** International street address: "12 Main St", "Drottninggatan 12", "12 rue de Rivoli", "Calle Mayor 5". */
export function hasStreetAddress(address?: string | null): boolean {
  const a = String(address || "").trim();
  if (a.length < 6) return false;
  if (/^(downtown|uptown|midtown|city cent(er|re)|various|tbd|tba|online|virtual)/i.test(a)) return false;
  return /\p{L}{3,}[\p{L} .'-]*\s\d{1,5}[a-zA-Z]?\b/u.test(a) || /\b\d{1,5}[a-zA-Z]?,?\s+(?:[a-zA-Z]\.?\s+)?[\p{L}\d]{2,}[\p{L}\d .'-]*\p{L}{2,}/u.test(a);
}

export function startTimeProblem(startTime?: string | null): string | null {
  const s = String(startTime || "").trim();
  if (!s || /\b(tbd|tba|to be (announced|determined))\b/i.test(s)) return "start_time_unconfirmed";
  if (/^all[- ]day$/i.test(s)) return null;
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(s) || /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) || /^\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?$/i.test(s)) return null;
  return "start_time_unparseable";
}

const ONLINE_RE = /\b(online[- ]only|online event|virtual event|webinar|zoom meeting|livestream(ed)?|live stream|webex|teams meeting|online auction)\b/i;
const ADULT_RE = /\b(x-rated|erotic|onlyfans|porn|fetish|swinger|nsfw|strip club)\b/i;

function isoDateInTz(d: Date, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function eventIsoDate(eventDate: Date | string): string | null {
  if (typeof eventDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(eventDate)) return eventDate.slice(0, 10);
  const d = eventDate instanceof Date ? eventDate : new Date(eventDate);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function isCrawlableUrl(u?: string | null): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname && url.hostname.includes(".");
  } catch {
    return false;
  }
}

async function log(sub: EventSubmission, result: IntakeResult) {
  try {
    await pool.query(
      `INSERT INTO event_intake_log (origin, outcome, reasons, detail, event_id, title, source, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [sub.origin, result.outcome, result.reasons, result.detail || null, result.id || null, String(sub.title || "").slice(0, 300),
       sub.sourceUrl || sub.source || null, JSON.stringify({ location: sub.location, venue: sub.venue, venueAddress: sub.venueAddress, eventDate: sub.eventDate, startTime: sub.startTime, handler: sub.handler || undefined, locationProvenance: sub.locationProvenance || undefined })]
    );
  } catch { /* logging must never block intake */ }
}

// ---------- the gate ----------

export async function publishEvent(sub: EventSubmission): Promise<IntakeResult> {
  const result = await evaluateAndWrite(sub);
  await log(sub, result);
  return result;
}

async function evaluateAndWrite(sub: EventSubmission): Promise<IntakeResult> {
  const human = HUMAN_ORIGINS.has(sub.origin);
  const title = String(sub.title || "").replace(/\s+/g, " ").trim();
  const venue = String(sub.venue || "").replace(/\s+/g, " ").trim();
  let address = String(sub.venueAddress || "").replace(/\s+/g, " ").trim();
  const details = String(sub.details || "").trim();
  const kind = sub.kind || detectKind(title, sub.category);
  const fullText = `${title} ${details} ${venue}`;

  // --- hard rejects (any origin) ---
  const tp = titleProblem(title, venue);
  if (tp && tp !== "title_is_venue") return { outcome: "rejected", reasons: [tp] };
  if (ONLINE_RE.test(fullText) || /^(online|virtual|zoom)$/i.test(venue)) return { outcome: "rejected", reasons: ["online_or_virtual"] };
  if (ADULT_RE.test(fullText)) return { outcome: "rejected", reasons: ["adult_content"] };
  const isoDate = eventIsoDate(sub.eventDate);
  if (!isoDate) return { outcome: "rejected", reasons: ["date_invalid"] };
  if (!human && !isCrawlableUrl(sub.sourceUrl || sub.officialInfoUrl || sub.source)) return { outcome: "rejected", reasons: ["source_url_not_crawlable"] };

  // --- rule 3: verified location (never defaulted) ---
  const loc = await resolveLocation({ ...sub.location, address: sub.location.address ?? address, sourceUrl: sub.location.sourceUrl ?? sub.sourceUrl });
  if (!loc.ok) {
    if (loc.reason === "provider_unavailable") return { outcome: "retry", reasons: ["location_" + loc.reason], detail: loc.detail };
    if (!human) return { outcome: "rejected", reasons: ["location_" + loc.reason], detail: loc.detail };
  }
  const location = loc.ok ? loc.location : undefined;

  // date must be today or later in the event's own timezone
  if (isoDate < isoDateInTz(new Date(), location?.timezone || null)) return { outcome: "rejected", reasons: ["date_in_past"] };
  if (location && normalizeGeoText(title) === normalizeGeoText(location.cityName)) return { outcome: "rejected", reasons: ["title_is_place_name"] };

  // --- soft problems -> pending_review (stored, never public) ---
  const pending: string[] = [];
  if (!loc.ok) pending.push("location_" + loc.reason);
  if (tp === "title_is_venue") pending.push(tp);
  const sp = startTimeProblem(sub.startTime);
  if (sp) pending.push(sp);
  const dp = descriptionProblem(details, title);
  // Sale listings: time + location are what matter (GEMINI.md). An empty description is allowed; a templated one is not.
  if (dp && !(kind === "sale" && (dp === "description_missing" || dp === "description_too_short"))) pending.push(dp);
  const venueCoords = isRealCoordinate(sub.location.lat, sub.location.lon);
  let addressOk = hasStreetAddress(address) || (!!venue && venueCoords && kind === "event");
  if (!addressOk && venue && location && kind === "event") {
    // If the event listing states a named venue in a verified city without a street address,
    // check if that same venue already has a verified street address in this city in events.
    try {
      const { rows: knownVenue } = await pool.query(
        `SELECT venue_address, latitude, longitude
         FROM events
         WHERE city_slug = $1 AND lower(venue) = lower($2) AND venue_address IS NOT NULL AND venue_address != ''
         LIMIT 1`,
        [location.citySlug, venue]
      );
      if (knownVenue[0]?.venue_address && hasStreetAddress(knownVenue[0].venue_address)) {
        address = knownVenue[0].venue_address;
        sub.venueAddress = address;
        addressOk = true;
        if (!venueCoords && knownVenue[0].latitude != null && knownVenue[0].longitude != null) {
          sub.location.lat = Number(knownVenue[0].latitude);
          sub.location.lon = Number(knownVenue[0].longitude);
        }
      }
    } catch { /* ignore */ }
  }
  if (!addressOk) {
    if (kind === "sale" && !human) return { outcome: "rejected", reasons: ["sale_without_street_address"] };
    pending.push("address_not_specific");
  }
  if (sub.forcePending) pending.push("forced_pending");

  // --- rule 7: duplicates (same verified city + same date) ---
  if (location) {
    const { rows } = await pool.query(
      `SELECT id, title, venue, venue_address, start_time, event_date, details, category, source,
              event_flyer_url, official_info_url, registration_url
         FROM events WHERE city_slug = $1 AND event_date::date = $2::date LIMIT 200`,
      [location.citySlug, isoDate]
    );
    for (const cand of rows) {
      if (areEventsDuplicates(cand, { title, venue, venue_address: address, start_time: sub.startTime || null, event_date: isoDate, details, category: sub.category || null, source: sub.source || null }).isDuplicate) {
        // backfill only empty fields on the existing record
        await pool.query(
          `UPDATE events SET
             event_flyer_url   = COALESCE(NULLIF(event_flyer_url,''), $2),
             official_info_url = COALESCE(NULLIF(official_info_url,''), $3),
             registration_url  = COALESCE(NULLIF(registration_url,''), $4),
             venue_address     = COALESCE(NULLIF(venue_address,''), $5),
             updated_at = NOW()
           WHERE id = $1`,
          [cand.id, sub.eventFlyerUrl || null, sub.officialInfoUrl || null, sub.registrationUrl || null, address || null]
        );
        return { outcome: "duplicate", id: cand.id, reasons: ["duplicate_of_" + cand.id], location };
      }
    }
  }

  // Event coordinates: the source's own venue coordinates if they agree with the city, else the city centre.
  let lat = location?.lat ?? null, lon = location?.lon ?? null;
  if (location && isRealCoordinate(sub.location.lat, sub.location.lon) && distanceKm(location.lat, location.lon, Number(sub.location.lat), Number(sub.location.lon)) <= 50) {
    lat = Number(sub.location.lat); lon = Number(sub.location.lon);
  }

  const status = pending.length ? "pending_review" : "live";
  const { rows } = await pool.query(
    `INSERT INTO events (
       title, city_name, state_name, country_code, country_name, city_slug, latitude, longitude,
       location_verified_at, location_method, listing_kind, category, venue, venue_address, hosting_entity,
       source, start_time, event_date, details, affiliate_url, registration_url, official_info_url, event_flyer_url,
       contact_email, contact_phone, social_urls, user_name, user_email, user_phone, franchise_id, status,
       rejection_reason, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::date,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,NOW(),NOW())
     RETURNING id`,
    [
      title,
      location?.cityName ?? String(sub.location.city || "").trim(),  // unverified text only ever stored on pending rows
      location?.admin1 ?? (sub.location.region || null),
      location?.countryCode ?? null,
      location?.countryName ?? null,
      location?.citySlug ?? null,
      lat, lon,
      location ? new Date() : null,
      location?.method ?? null,
      kind,
      sub.category || "Community",
      venue,
      address || null,
      sub.hostingEntity || null,
      sub.source || sub.sourceUrl || sub.origin,
      String(sub.startTime || "").trim(),
      isoDate,
      details,
      sub.affiliateUrl || null,
      sub.registrationUrl || null,
      sub.officialInfoUrl || null,
      sub.eventFlyerUrl || null,
      sub.contactEmail || null,
      sub.contactPhone || null,
      sub.socialUrls || null,
      sub.userName || null,
      sub.userEmail || null,
      sub.userPhone || null,
      sub.franchiseId ?? null,
      status,
      pending.length ? pending.join(",") : null,
    ]
  );
  const id = rows[0]?.id as number;
  return { outcome: status === "live" ? "published" : "pending_review", id, reasons: pending, detail: loc.ok ? undefined : loc.detail, location };
}
