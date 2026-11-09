// src/lib/events/query.ts
//
// Read side of the Events feature. Only VERIFIED events (city_slug set by publishEvent) are ever
// returned, matched by coordinates - never by guessing from a city name.
// Shared by the website API and (later) the mobile app API.

import { pool } from "@/lib/db";

export const PUBLIC_EVENT_STATUSES = ["live", "published", "approved", "scheduled"];

/** "This city" = events whose verified city centre is within this distance of the page's city centre. */
const SAME_CITY_KM = 5;
/** "Nearby" toggle radius (30 miles). */
const NEARBY_KM = 48.3;

const HAVERSINE = (latA: string, lonA: string, latB: string, lonB: string) => `
  (6371 * acos(LEAST(1.0, GREATEST(-1.0,
     cos(radians(${latA})) * cos(radians(${latB})) * cos(radians(${lonB}) - radians(${lonA})) +
     sin(radians(${latA})) * sin(radians(${latB}))))))`;

export interface EventQuery {
  lat?: number | null;
  lon?: number | null;
  citySlug?: string | null;
  nearby?: boolean;
  /** Free-text filter on title / venue / host / category. */
  q?: string | null;
  /** Advanced text filter: any pattern (ILIKE) on title/venue/host/details, or any category pattern. */
  textPatterns?: string[];
  categoryPatterns?: string[];
  /** Search across every verified city (ignores lat/lon/citySlug). */
  everywhere?: boolean;
  limit?: number;
}

export async function findPublicEvents(opts: EventQuery): Promise<any[]> {
  const params: any[] = [PUBLIC_EVENT_STATUSES];
  const where: string[] = [
    `e.status = ANY($1)`,
    `e.city_slug IS NOT NULL`,
    `e.event_date >= CURRENT_DATE - INTERVAL '1 day'`,
  ];
  const hasCoords = Number.isFinite(opts.lat as number) && Number.isFinite(opts.lon as number);

  if (opts.everywhere) {
    // no geographic filter: every verified, public, upcoming event
  } else if (opts.citySlug && !opts.nearby) {
    params.push(opts.citySlug);
    where.push(`e.city_slug = $${params.length}`);
  } else if (hasCoords) {
    params.push(opts.lat, opts.lon);
    const pLat = `$${params.length - 1}`, pLon = `$${params.length}`;
    if (opts.nearby) {
      where.push(`e.latitude IS NOT NULL AND ${HAVERSINE(pLat, pLon, "e.latitude", "e.longitude")} <= ${NEARBY_KM}`);
    } else {
      where.push(`c.latitude IS NOT NULL AND ${HAVERSINE(pLat, pLon, "c.latitude", "c.longitude")} <= ${SAME_CITY_KM}`);
    }
  } else {
    return []; // no verified way to know which city: return nothing rather than guess
  }

  if (opts.q && opts.q.trim()) {
    params.push(`%${opts.q.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(e.title ILIKE ${p} OR e.venue ILIKE ${p} OR e.hosting_entity ILIKE ${p} OR e.category ILIKE ${p})`);
  }
  if (opts.textPatterns?.length || opts.categoryPatterns?.length) {
    const ors: string[] = [];
    if (opts.textPatterns?.length) {
      params.push(opts.textPatterns);
      const p = `$${params.length}`;
      ors.push(`e.title ILIKE ANY(${p})`, `e.venue ILIKE ANY(${p})`, `COALESCE(e.hosting_entity,'') ILIKE ANY(${p})`, `COALESCE(e.details,'') ILIKE ANY(${p})`);
    }
    if (opts.categoryPatterns?.length) {
      params.push(opts.categoryPatterns);
      ors.push(`e.category ILIKE ANY($${params.length})`);
    }
    where.push(`(${ors.join(" OR ")})`);
  }

  params.push(Math.min(Math.max(opts.limit ?? 1000, 1), 5000));
  const { rows } = await pool.query(
    `SELECT e.* FROM events e
       LEFT JOIN cities c ON c.slug = e.city_slug
      WHERE ${where.join(" AND ")}
      ORDER BY e.event_date ASC, e.start_time ASC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

/** Shape expected by the existing EventsBlock UI (kept stable for the website and the future app). */
export function toEventDTO(row: any) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    venue: row.venue,
    source: row.source,
    startTime: row.start_time,
    eventDate: row.event_date,
    details: row.details,
    affiliateUrl: row.affiliate_url,
    venue_address: row.venue_address,
    hosting_entity: row.hosting_entity,
    contact_email: row.contact_email || row.user_email || null,
    contact_phone: row.contact_phone || row.user_phone || null,
    official_info_url: row.official_info_url,
    social_urls: row.social_urls,
    registration_url: row.registration_url,
    event_flyer_url: row.event_flyer_url,
    cityName: row.city_name,
    stateName: row.state_name,
    countryCode: row.country_code,
    citySlug: row.city_slug,
    latitude: row.latitude,
    longitude: row.longitude,
    listingKind: row.listing_kind,
    url: `https://www.livetimedata.com/events/${row.id}`,
  };
}
