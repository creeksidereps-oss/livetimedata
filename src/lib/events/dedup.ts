// src/lib/events/dedup.ts
/**
 * Intelligent Multi-Signal Event Fingerprinting & Deduplication Engine
 * 
 * Protects:
 * - Multi-act festival lineups (Band A at 1:00 PM, Band B at 4:00 PM)
 * - Multi-seating and multi-session events (Morning vs Evening walks, 12:45 vs 2:30 seatings)
 *   Strict 30-minute threshold: Explicit start times > 30 minutes apart are NEVER merged.
 * - Distinct food trucks or vendors at the same venue/address
 * 
 * Merges & Enriches:
 * - Different source titles for the same event (e.g. "23rd Annual Statesville Pumpkin Fest"
 *   and "Statesville Pumpkin Fest 2026" and "Statesville PumpkinFest Saturday, Nov 7...")
 * - Synthesizes a single "Golden Record" combining best flyer, address, ticket URL, and details.
 */

export interface EventLike {
  id?: string | number;
  title: string;
  category?: string | null;
  venue?: string | null;
  source?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  eventDate?: string | Date | null;
  event_date?: string | Date | null;
  details?: string | null;
  affiliateUrl?: string | null;
  affiliate_url?: string | null;
  venue_address?: string | null;
  venueAddress?: string | null;
  hosting_entity?: string | null;
  hostingEntity?: string | null;
  contact_email?: string | null;
  contactEmail?: string | null;
  contact_phone?: string | null;
  contactPhone?: string | null;
  official_info_url?: string | null;
  officialInfoUrl?: string | null;
  social_urls?: string | null;
  socialUrls?: string | null;
  registration_url?: string | null;
  registrationUrl?: string | null;
  event_flyer_url?: string | null;
  eventFlyerUrl?: string | null;
  cityName?: string | null;
  city_name?: string | null;
  stateName?: string | null;
  state_name?: string | null;
  countryCode?: string | null;
  country_code?: string | null;
  [key: string]: any;
}

/**
 * Extracts minutes from midnight for a given time string (e.g. "8:30 AM" -> 510).
 * Returns null if time is "TBD", "All Day", empty, or unparseable.
 */
export function parseTimeMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const s = timeStr.trim().toLowerCase();
  if (s === 'tbd' || s === 'all day' || s === 'various' || s.length < 2) return null;

  // Match 8:30 AM, 12:45pm, 2:30 PM EDT, 10 am, etc.
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (m) {
    let hours = parseInt(m[1], 10);
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    const isPm = m[3].toLowerCase() === 'pm';
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  // 24-hour time 19:00
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  }

  return null;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'at', 'in', 'on', 'of', 'to', 'for', 'with', 'by',
  'presents', 'present', 'presented', 'live', 'featuring', 'feat', 'ft', 'annual',
  'hosted', 'session', 'series', 'official', 'exclusive', 'sponsored'
]);

const GENERIC_VENUES = new Set([
  'downtown', 'citywide', 'main street', 'various locations', 'historic downtown',
  'cultural district', 'festival plaza', 'community grounds', 'fairgrounds'
]);

export function isGenericVenue(venue?: string | null): boolean {
  if (!venue) return true;
  const v = venue.toLowerCase();
  for (const g of GENERIC_VENUES) {
    if (v.includes(g)) return true;
  }
  return false;
}

/**
 * Strips scraping edition noise, ordinals, dates, and compound spelling quirks.
 * If venue is provided, strips it from the title so co-headlining acts at the same venue aren't falsely matched.
 */
export function normalizeTitle(title: string, venue?: string | null): string {
  if (!title) return '';
  let s = title.toLowerCase();

  // If venue is in title, strip it (e.g. "Carnifex at Arena Wien" with venue "Arena Wien" -> "Carnifex")
  if (venue && venue.trim().length > 3) {
    const v = venue.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    if (v.length > 3) {
      s = s.replace(new RegExp(`\\b(at|in|@)?\\s*${v.replace(/\s+/g, '\\s+')}\\b`, 'gi'), ' ');
    }
  }

  // Decode HTML entities
  s = s.replace(/&#038;/g, '&').replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&quot;/g, '"');

  // Remove ordinals like 23rd, 1st, 2nd, 3rd, 160th
  s = s.replace(/\b\d+(?:st|nd|rd|th)\b/gi, ' ');

  // Remove years (2020 - 2039)
  s = s.replace(/\b20[2-3][0-9]\b/g, ' ');

  // Remove days of the week & months
  s = s.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, ' ');
  s = s.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, ' ');
  s = s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ');

  // Normalize common compound words
  s = s.replace(/pumpkinfest/gi, 'pumpkin fest');
  s = s.replace(/octoberfest|oktoberfest/gi, 'oktoberfest');
  s = s.replace(/garagesale/gi, 'garage sale');
  s = s.replace(/yardsale/gi, 'yard sale');

  // Strip trailing "from 10am..." or truncated descriptions in titles
  s = s.replace(/\bfrom\s+\d{1,2}.*$/gi, ' ');
  s = s.replace(/\.{3,}$/g, ' '); // Trailing ellipses

  // Remove non-alphanumeric punctuation
  s = s.replace(/[^\w\s]/g, ' ');

  // Tokenize & strip stopwords
  const tokens = s
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOPWORDS.has(t));

  return tokens.join(' ');
}

/**
 * Calculates semantic similarity (0.0 to 1.0) between two event titles.
 */
export function calculateTitleSimilarity(titleA: string, titleB: string, venueA?: string | null, venueB?: string | null): number {
  const normA = normalizeTitle(titleA, venueA);
  const normB = normalizeTitle(titleB, venueB);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  // Substring match: if one complete normalized core title is inside the other
  if ((normA.length > 5 && normB.includes(normA)) || (normB.length > 5 && normA.includes(normB))) {
    return 0.95;
  }

  const tokensA = new Set(normA.split(/\s+/));
  const tokensB = new Set(normB.split(/\s+/));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * Evaluates whether two event records are duplicate listings of the same event.
 * 
 * CRITICAL RULE:
 * Explicit start times > 30 minutes apart are guaranteed DISTINCT (returns isDuplicate: false).
 */
export function areEventsDuplicates(evA: EventLike, evB: EventLike): {
  isDuplicate: boolean;
  confidence: number;
  reason: string;
} {
  // 1. Same Date check
  const rawDateA = evA.eventDate || evA.event_date;
  const rawDateB = evB.eventDate || evB.event_date;
  const dateA = rawDateA ? new Date(rawDateA).toISOString().slice(0, 10) : null;
  const dateB = rawDateB ? new Date(rawDateB).toISOString().slice(0, 10) : null;

  if (!dateA || !dateB || dateA !== dateB) {
    return { isDuplicate: false, confidence: 0, reason: 'Different calendar dates' };
  }

  // 2. City check
  const cityA = (evA.cityName || evA.city_name || '').toLowerCase().trim();
  const cityB = (evB.cityName || evB.city_name || '').toLowerCase().trim();
  if (cityA && cityB && cityA !== cityB) {
    return { isDuplicate: false, confidence: 0, reason: 'Different cities' };
  }

  // 3. Time Check (USER SPECIFIED: STRICT 30 MINUTE THRESHOLD!)
  const rawTimeA = evA.startTime || evA.start_time;
  const rawTimeB = evB.startTime || evB.start_time;
  const timeA = parseTimeMinutes(rawTimeA);
  const timeB = parseTimeMinutes(rawTimeB);

  if (timeA !== null && timeB !== null) {
    const diff = Math.abs(timeA - timeB);
    if (diff > 30) {
      return { 
        isDuplicate: false, 
        confidence: 0,
        reason: `Explicit start times differ by ${diff} mins (> 30 min threshold)` 
      };
    }
  }

  // 4. Venue & Address similarity
  const venueA = (evA.venue || '').toLowerCase().trim();
  const venueB = (evB.venue || '').toLowerCase().trim();
  const addrA = (evA.venue_address || evA.venueAddress || '').toLowerCase().trim();
  const addrB = (evB.venue_address || evB.venueAddress || '').toLowerCase().trim();

  const isGenericA = isGenericVenue(venueA);
  const isGenericB = isGenericVenue(venueB);

  const sameSpecificVenue = !isGenericA && !isGenericB && venueA.length > 3 && venueB.length > 3 && (venueA.includes(venueB) || venueB.includes(venueA));
  const sameSpecificAddr = addrA.length > 5 && addrB.length > 5 && addrA !== 'null' && addrB !== 'null' && (addrA.includes(addrB) || addrB.includes(addrA));

  // 5. Title Similarity with venue stripping
  const sim = calculateTitleSimilarity(evA.title, evB.title, evA.venue, evB.venue);

  // If same specific physical address (e.g. same house/building number):
  if (sameSpecificAddr) {
    if (sim >= 0.50) {
      return { 
        isDuplicate: true, 
        confidence: sim, 
        reason: `Same address with title similarity ${(sim * 100).toFixed(0)}%` 
      };
    }
  }

  // If same specific non-generic venue (e.g. "Iredell County Cooperative Extension"):
  if (sameSpecificVenue) {
    if (sim >= 0.65) {
      return { 
        isDuplicate: true, 
        confidence: sim, 
        reason: `Same specific venue with title similarity ${(sim * 100).toFixed(0)}%` 
      };
    }
  }

  // High title similarity alone (≥ 75%)
  if (sim >= 0.75) {
    return { 
      isDuplicate: true, 
      confidence: sim, 
      reason: `High title similarity ${(sim * 100).toFixed(0)}%` 
    };
  }

  return { 
    isDuplicate: false, 
    confidence: sim, 
    reason: `Title similarity ${(sim * 100).toFixed(0)}% below threshold` 
  };
}

/**
 * Merges two duplicate event records into a single enriched "Golden Record".
 * Preserves the highest-quality flyer, street address, ticket links, description, and tags.
 */
export function mergeEventRecords<T extends EventLike>(master: T, incoming: T): T {
  const result: any = { ...master };

  // 1. Cleanest Title
  const masterTitle = (master.title || '').trim();
  const incomingTitle = (incoming.title || '').trim();
  if (masterTitle.endsWith('...') && !incomingTitle.endsWith('...')) {
    result.title = incomingTitle;
  } else if (masterTitle.toLowerCase().includes('from ') && !incomingTitle.toLowerCase().includes('from ')) {
    result.title = incomingTitle;
  }

  // 2. Flyer Graphic
  const masterFlyer = master.eventFlyerUrl || master.event_flyer_url;
  const incomingFlyer = incoming.eventFlyerUrl || incoming.event_flyer_url;
  if (!masterFlyer && incomingFlyer) {
    result.eventFlyerUrl = incomingFlyer;
    result.event_flyer_url = incomingFlyer;
  }

  // 3. Street Address
  const masterAddr = master.venueAddress || master.venue_address;
  const incomingAddr = incoming.venueAddress || incoming.venue_address;
  if ((!masterAddr || masterAddr === 'null' || masterAddr.trim().length === 0) && incomingAddr && incomingAddr !== 'null') {
    result.venueAddress = incomingAddr;
    result.venue_address = incomingAddr;
  }

  // 4. Start Time (Prefer explicit time range)
  const masterTime = master.startTime || master.start_time;
  const incomingTime = incoming.startTime || incoming.start_time;
  if ((!masterTime || masterTime.toLowerCase() === 'tbd') && incomingTime) {
    result.startTime = incomingTime;
    result.start_time = incomingTime;
  } else if (incomingTime && incomingTime.includes('-') && (!masterTime || !masterTime.includes('-'))) {
    result.startTime = incomingTime;
    result.start_time = incomingTime;
  }

  // 5. Details / Description (Keep longer, richer text)
  const masterDetails = (master.details || '').trim();
  const incomingDetails = (incoming.details || '').trim();
  if (incomingDetails.length > masterDetails.length && incomingDetails !== incomingTitle) {
    result.details = incomingDetails;
  }

  // 6. URLs
  const masterInfo = master.officialInfoUrl || master.official_info_url;
  const incomingInfo = incoming.officialInfoUrl || incoming.official_info_url;
  if (!masterInfo && incomingInfo) {
    result.officialInfoUrl = incomingInfo;
    result.official_info_url = incomingInfo;
  }

  const masterSocial = master.socialUrls || master.social_urls;
  const incomingSocial = incoming.socialUrls || incoming.social_urls;
  if (!masterSocial && incomingSocial) {
    result.socialUrls = incomingSocial;
    result.social_urls = incomingSocial;
  }

  const masterReg = master.registrationUrl || master.registration_url;
  const incomingReg = incoming.registrationUrl || incoming.registration_url;
  if (!masterReg && incomingReg) {
    result.registrationUrl = incomingReg;
    result.registration_url = incomingReg;
  }

  // 7. Categories (Union of categories)
  const catA = (master.category || '').split(',').map((c: string) => c.trim()).filter(Boolean);
  const catB = (incoming.category || '').split(',').map((c: string) => c.trim()).filter(Boolean);
  const mergedCats = Array.from(new Set([...catA, ...catB])).join(', ');
  if (mergedCats) {
    result.category = mergedCats;
  }

  // 8. Hosting Entity
  const masterHost = master.hostingEntity || master.hosting_entity;
  const incomingHost = incoming.hostingEntity || incoming.hosting_entity;
  if (!masterHost && incomingHost) {
    result.hostingEntity = incomingHost;
    result.hosting_entity = incomingHost;
  }

  // 9. Source tracking
  if (incoming.source && master.source && !master.source.includes(incoming.source)) {
    result.source = `${master.source}, ${incoming.source}`;
  }

  return result as T;
}

/**
 * Deduplicates an array of events in-memory, merging duplicates into single enriched records.
 */
export function deduplicateEventList<T extends EventLike>(events: T[]): T[] {
  if (!events || events.length <= 1) return events;

  const deduped: T[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < events.length; i++) {
    if (processedIndices.has(i)) continue;

    let currentMaster = { ...events[i] };

    for (let j = i + 1; j < events.length; j++) {
      if (processedIndices.has(j)) continue;

      const candidate = events[j];
      const match = areEventsDuplicates(currentMaster, candidate);

      if (match.isDuplicate) {
        currentMaster = mergeEventRecords(currentMaster, candidate);
        processedIndices.add(j);
      }
    }

    deduped.push(currentMaster);
  }

  return deduped;
}
