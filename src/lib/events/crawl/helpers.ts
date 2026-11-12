// src/lib/events/crawl/helpers.ts
//
// Pure helpers for the crawler (no network, no DB). Ported from the retired
// src/lib/discovery/calendar-crawler.ts with every fabricated default removed:
//   - no default start times ("7:00 PM", "7:30 PM", "9:00 AM") — unknown time => ""
//   - no default venue ("Local Venue", "{city} Venue")
//   - no default city / state / country

/**
 * Normalizes event category based on title, description, and keywords.
 */
export function categorizeEvent(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  // Yard / Garage Sales & Auctions
  if (/\b(auction|estate auction|consignment auction|yard sale|garage sale|estate sale|moving sale|rummage sale|tag sale|barn sale|porch sale)\b/i.test(text)) {
    return "Yard / Garage Sales";
  }
  // Food Trucks & Mobile Food
  if (/\b(food truck|food trucks|food truck rally|brewery food|mobile eats|food trailer|street food)\b/i.test(text)) {
    return "Food Trucks";
  }
  // Concerts & Live Music
  if (/\b(music|concert|band|live music|acoustic|orchestra|choir|singer|jazz|blues|rock|country music|symphony|jam session|acoustic set)\b/i.test(text)) {
    return "Concerts & Live Music";
  }
  // Festivals & Fairs
  if (/\b(festival|fest|carnival|parade|fair|fall fest|octoberfest|oktoberfest|spring fest|harvest fest)\b/i.test(text)) {
    return "Festivals & Fairs";
  }
  // Classes & Workshops
  if (/\b(class|workshop|pottery|painting|cooking class|seminar|lesson|learn to|craft workshop|fitness class|yoga)\b/i.test(text)) {
    return "Classes";
  }
  // Auditions & Casting Calls
  if (/\b(audition|auditions|casting call|open call|call for actors|call for performers|call for dancers|call for singers|actor tryouts|dance tryouts|audition notice)\b/i.test(text)) {
    return "Auditions";
  }
  // Theatre & Performing Arts
  if (/\b(theater|theatre|comedy|stand-up|musical|play|improv|ballet|dance performance|opera|drama)\b/i.test(text)) {
    return "Theatre & Performing Arts";
  }
  // Arts & Culture
  if (/\b(art|gallery|exhibition|craft fair|art crawl|museum|cultural|sculpture|pottery show)\b/i.test(text)) {
    return "Arts & Culture";
  }
  // Sports & Recreation
  if (/\b(football|baseball|basketball|soccer|hockey|5k|10k|run|marathon|race|golf|wrestling|tournament|softball)\b/i.test(text)) {
    return "Sports & Recreation";
  }
  // Family Friendly
  if (/\b(kids|family|storytime|puppet|trunk or treat|halloween for kids|family fun|children|toddler)\b/i.test(text)) {
    return "Family Friendly";
  }
  // Nightlife & Social
  if (/\b(beer|wine|brewery|bar|nightlife|trivia|dj|club|cocktail|lounge|party|karaoke|pub crawl)\b/i.test(text)) {
    return "Nightlife & Social";
  }
  return "Community & Civic";
}

/**
 * Strips HTML tags and decodes common HTML entities to prevent raw HTML leak into event descriptions.
 */
export function cleanHtmlEntitiesAndTags(raw?: string | null): string {
  if (!raw) return "";
  let text = String(raw);
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d{2,6});/g, (_, n) => {
      const code = parseInt(n, 10);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&#x([0-9a-f]{2,6});/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\\r\\n|\\n/g, " ");
  // Block-level tags become line breaks, all other tags are stripped
  text = text.replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text.slice(0, 4000);
}

/** Trim + collapse whitespace; "" for null/undefined/non-strings. */
export function cleanStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string" && typeof v !== "number") return "";
  return cleanHtmlEntitiesAndTags(String(v)).replace(/\s+/g, " ").trim();
}

/** Parse a coordinate; undefined if not a finite number. */
export function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

/** Join the address parts the source gave, skipping empties. Nothing is added. */
export function joinAddress(...parts: (string | undefined | null)[]): string {
  return parts.map((p) => cleanStr(p)).filter(Boolean).join(", ");
}

/**
 * Detects whether a string is a generic calendar / page heading rather than a physical venue name.
 */
export function isGenericCalendarHeader(text?: string | null): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  return (
    clean.length < 3 ||
    clean.length > 70 ||
    /\b(events?\s*(&|and)?\s*tickets?|upcoming\s*events?|calendar|event\s*calendar|schedule|what['’]?s\s*on|shows?\s*(&|and)?\s*events?|all\s*events?|find\s*events?|search\s*results?|ticket\s*center|box\s*office|home|welcome)\b/i.test(
      clean
    )
  );
}

/**
 * Detects whether an event is an online/virtual seminar, webinar, or remote meeting.
 * LiveTimeData is exclusively for in-person events; online events are strictly excluded.
 */
export function isOnlineOrVirtualEvent(title?: string, details?: string, venue?: string, url?: string): boolean {
  const combined = `${title || ""} ${details || ""} ${venue || ""} ${url || ""}`.toLowerCase();

  // Explicit online venue
  const cleanVenue = (venue || "").trim().toLowerCase();
  if (
    cleanVenue === "virtual" ||
    cleanVenue === "online" ||
    cleanVenue === "zoom" ||
    cleanVenue === "internet" ||
    cleanVenue === "virtual meeting" ||
    cleanVenue.startsWith("virtual ") ||
    cleanVenue.includes("online only")
  ) {
    return true;
  }

  // Keywords in title, details, venue, or URL
  if (
    /\b(webinar|online event|virtual event|zoom meeting|zoom call|livestream|live stream|virtual workshop|online workshop|virtual seminar|online seminar|play free online|virtual conference|online conference|online only auction|virtual auction|virtual book fair|virtual book club)\b/i.test(combined) ||
    /\b(online-seminar|virtual-seminar|online-workshop|virtual-workshop|zoom\.us|webex\.com|teams\.microsoft\.com)\b/i.test(combined) ||
    /\b(small[- ]business[- ]center.*(?:online|webinar|virtual))\b/i.test(combined) ||
    /\b(build your small bu[siness]* website with ai|small business startup certificate)\b/i.test(combined)
  ) {
    return true;
  }
  return false;
}

const ADULT_RE = /\b(x-rated|erotic|onlyfans|porn|fetish|swinger|nsfw|strip club)\b/i;
export function isAdultContent(text: string): boolean {
  return ADULT_RE.test(text);
}

/**
 * Titles that are not events: operating hours and academic / administrative deadlines.
 */
export function isNonEventTitle(title: string): boolean {
  return (
    /\b(hours of operation|operating hours|facility hours|open daily|park hours|visitor center hours|guest services hours|box office hours|business hours)\b/i.test(title) ||
    /\b(refund|last day to withdraw|withdraw deadline|grades due|session begin|session end|last day to receive|tuition due|payment deadline|add\/drop|drop\/add|census date|grade of ["']?w["']?|withdrawal processing)\b/i.test(title)
  );
}

function to12h(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m < 10 ? "0" + m : m} ${ampm}`;
}

/**
 * Reads the start time exactly as written in an ISO-like date-time string ("2026-11-10T19:30:00-05:00" -> "7:30 PM").
 * The local wall-clock time is taken from the string itself (no server-timezone shifts).
 * Returns "" (unconfirmed) when:
 *   - the string has no time component (date only),
 *   - the time is 00:00 (publishers use it as a "no time" placeholder),
 *   - the time is given in UTC ("Z"), because the event's local time is then unknown.
 */
export function formatTimeFromDate(isoStr?: string | null): string {
  if (!isoStr) return "";
  const s = String(isoStr).trim();
  const timeMatch = s.match(/[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i) || s.match(/[T ](\d{2}):(\d{2})/);
  if (!timeMatch) return "";
  if (/Z$/i.test(s)) return "";
  const h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return "";
  if (h === 0 && m === 0) return "";
  return to12h(h, m);
}

/**
 * Parse the first real start time from free text ("Times: Thurs., 6-7pm", "12-5 pm", "7:30 PM", "10am-2pm").
 * Returns "" when no unambiguous time exists (never guesses AM/PM).
 */
export function parseStartTime(text: string): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ");
  // range: 6-7pm / 12 - 5 pm / 10am-2pm / 6:30-9:00 PM
  const range = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
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
  // 24h clock "19:30" (common outside the US)
  const h24 = t.match(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/);
  if (h24) {
    const h = parseInt(h24[1], 10), m = parseInt(h24[2], 10);
    if (!(h === 0 && m === 0)) return to12h(h, m);
  }
  return "";
}

/**
 * Event date (YYYY-MM-DD) as the source states it. For ISO strings the local date portion is taken
 * verbatim (no UTC conversion, which would shift late-evening events to the next day).
 */
export function isoDateFromSource(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})(?:T|$)/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const d = parseHumanDateString(s);
  return d ? d.toISOString().slice(0, 10) : null;
}

// Localized month / weekday names (FR, ES, IT, PT, DE, NL, SV/DA/NO) -> English, so the date parsers below
// read "13 novembre 2026", "1er décembre 2026", "13. November 2026", "sábado 5 de diciembre de 2026".
// Numeric d/m/y is never reinterpreted (ambiguous); only spelled-out month names are translated.
const LOCAL_MONTHS: [RegExp, string][] = [
  [/(?<![\p{L}])(janvier|janv|enero|gennaio|janeiro|januar|januari|jänner)(?![\p{L}])\.?/giu, "January"],
  [/(?<![\p{L}])(février|fevrier|févr|fevr|febrero|febbraio|fevereiro|februar|februari)(?![\p{L}])\.?/giu, "February"],
  [/(?<![\p{L}])(mars|marzo|março|märz|maerz|maart)(?![\p{L}])\.?/giu, "March"],
  [/(?<![\p{L}])(avril|avr|abril|aprile)(?![\p{L}])\.?/giu, "April"],
  [/(?<![\p{L}])(mai|mayo|maggio|maio|mei|maj)(?![\p{L}])\.?/giu, "May"],
  [/(?<![\p{L}])(juin|junio|giugno|junho|juni)(?![\p{L}])\.?/giu, "June"],
  [/(?<![\p{L}])(juillet|juil|julio|luglio|julho|juli)(?![\p{L}])\.?/giu, "July"],
  [/(?<![\p{L}])(août|aout|agosto|augusti)(?![\p{L}])\.?/giu, "August"],
  [/(?<![\p{L}])(septembre|septiembre|settembre|setembro)(?![\p{L}])\.?/giu, "September"],
  [/(?<![\p{L}])(octobre|octubre|ottobre|outubro|oktober)(?![\p{L}])\.?/giu, "October"],
  [/(?<![\p{L}])(novembre|noviembre|novembro)(?![\p{L}])\.?/giu, "November"],
  [/(?<![\p{L}])(décembre|decembre|déc|diciembre|dicembre|dezembro|dezember)(?![\p{L}])\.?/giu, "December"],
];
const LOCAL_WEEKDAYS = /(?<![\p{L}])(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|måndag|mandag|tisdag|tirsdag|onsdag|torsdag|fredag|lördag|lørdag|söndag|søndag)(?![\p{L}])\.?,?\s*/giu;
const LOCAL_HINT = /(?<![\p{L}])(janvier|janv|février|fevrier|févr|mars|avril|avr|mai|juin|juillet|juil|août|aout|septembre|octobre|novembre|décembre|decembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|novembro|dezembro|januar|februar|märz|maerz|juni|juli|oktober|dezember|januari|februari|maart|mei|augusti|maj)(?![\p{L}])/iu;

/** Translate spelled-out non-English month / weekday names to English (date handler, spider repair 2026-11-10). */
export function localizeDateWords(s: string): string {
  if (!LOCAL_HINT.test(s)) return s;
  let out = s.replace(LOCAL_WEEKDAYS, "");
  out = out.replace(/\b(\d{1,2})(?:er|ère|º|°)(?![\p{L}])/giu, "$1").replace(/\b(\d{1,2})\.(?=\s*\p{L})/gu, "$1");
  out = out.replace(/\s+del?\s+/gi, " ");
  for (const [re, en] of LOCAL_MONTHS) out = out.replace(re, en);
  return out.replace(/\s+/g, " ").trim();
}

/** True if the date is before yesterday (UTC). publishEvent applies the exact timezone-aware rule. */
export function isClearlyPast(isoDate: string): boolean {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return isoDate < yesterday;
}

/**
 * Parses natural human date strings (including ranges like "September 2 - 20, 2026" or single dates "Oct 2, 2026").
 * Returned Date is anchored at 12:00 UTC on the stated calendar day.
 */
export function parseHumanDateString(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const clean = localizeDateWords(dateStr).replace(/\s+/g, " ").replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "").trim();

  // Range: "September 2 - 20, 2026" or "Sep 2 - 20, 2026"
  const rangeMatch = clean.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})$/);
  if (rangeMatch) {
    const [, monthStr, startDay, , year] = rangeMatch;
    const d = new Date(`${monthStr} ${startDay}, ${year} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Multi-month range: "October 27 - November 1, 2026"
  const multiMonthMatch = clean.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (multiMonthMatch) {
    const [, m1, d1, , , year] = multiMonthMatch;
    const d = new Date(`${m1} ${d1}, ${year} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Single date: "Sep 24, 2026" or "October 2, 2026"
  const singleMatch = clean.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/);
  if (singleMatch) {
    const d = new Date(`${singleMatch[1]} ${singleMatch[2]}, ${singleMatch[3]} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Day-first: "24 September 2026", "24 Sep 2026"
  const dayFirst = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]+)\.?,?\s+(\d{4})/);
  if (dayFirst) {
    const d = new Date(`${dayFirst[2]} ${dayFirst[1]}, ${dayFirst[3]} 12:00:00 UTC`);
    if (!isNaN(d.getTime())) return d;
  }

  // Single date without year: "Sep 24", "September 24", "Sep 24th" (next occurrence of that day)
  const monthDayMatch = clean.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (monthDayMatch) {
    const now = new Date();
    let d = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${now.getUTCFullYear()} 12:00:00 UTC`);
    if (!isNaN(d.getTime()) && d.getTime() < now.getTime() - 60 * 86400000) {
      d = new Date(`${monthDayMatch[1]} ${monthDayMatch[2]}, ${now.getUTCFullYear() + 1} 12:00:00 UTC`);
    }
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;
  return null;
}

/**
 * Validates whether an extracted string is a clean, genuine email address.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 6 || clean.length > 100) return false;

  // Standard email format ending with valid domain TLD
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|co|us|uk|de|ca|biz|info|me|events|live)$/i.test(clean)) {
    return false;
  }

  const junkKeywords = [
    "noreply", "no-reply", "donotreply", "example.com", "domain.com", "yourdomain", "sentry.io", "cloudflare",
    "wixpress", "bootstrap", "wordpress", "schema.org", "w3.org", "github.com", "google.com", "facebook.com",
    "instagram.com", "twitter.com", "eventbrite.com", "ticketmaster.com", "seatgeek.com", "@2x", "@3x", ".png",
    ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
  ];
  return !junkKeywords.some((j) => clean.includes(j));
}

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|co|us|uk|de|ca|biz|info|me|events|live)\b/gi;
/** Adds every valid email found in free text to `into`. */
export function collectEmails(text: string, into: Set<string>): void {
  for (const m of text.match(EMAIL_RE) || []) {
    const e = m.toLowerCase().trim();
    if (isValidEmail(e)) into.add(e);
  }
}
export function addEmail(raw: unknown, into: Set<string>): void {
  if (typeof raw !== "string") return;
  const e = raw.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
  if (isValidEmail(e)) into.add(e);
}

/** Ticket brokers / resale sites (never used as an event's official link). */
export function isTicketBrokerUrl(u?: string | null): boolean {
  return /(ticketmaster|eventbrite|livenation|stubhub|seatgeek|vividseats|gotickets)\./i.test(String(u || ""));
}

/**
 * Strict validator to guarantee only genuine recurring calendar hubs,
 * schedules, and venue directories enter the sources table.
 * Rejects add-to-calendar webmail links, date pagination loops, single-event permalinks, and social media.
 */
export function isValidCalendarSourceUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // 1. Must be http / https
    if (!parsed.protocol.startsWith("http")) return false;

    // 2. Reject webmail & add-to-calendar providers
    const blockedHosts = [
      "google.com", "calendar.google.com", "outlook.live.com", "outlook.office.com", "outlook.com", "live.com",
      "mail.yahoo.com", "yahoo.com", "apple.com", "icloud.com",
    ];
    if (blockedHosts.some((bh) => host === bh || host.endsWith("." + bh))) return false;

    // 3. Reject bot-blocked social platforms, ticket brokers & banned aggregators
    const blockedKeywords = [
      "facebook.", "instagram.", "twitter.", "x.com", "linkedin.", "tiktok.", "youtube.", "pinterest.", "snapchat.",
      "reddit.", "threads.net", "seatgeek.", "ticketmaster.", "livenation.", "stubhub.", "vividseats.", "gotickets.", "axs.com",
      "dice.fm", "etix.", "ticketweb.", "eventbrite.", "bandsintown.", "songkick.", "seated.", "windy.com",
    ];
    if (blockedKeywords.some((bk) => host.includes(bk) || host === bk.replace(/\.$/, ""))) return false;

    // 4. Reject static assets & documents
    if (/\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|zip|css|js|ics|vcf|ashx)(\?.*)?$/i.test(path)) return false;

    // 5. Strictly reject calendar date pagination loops, registration confirmation modals, and exports
    if (
      path.includes("/confirm") ||
      path.includes("/checkout") ||
      path.includes("/cart") ||
      search.includes("instance_id=") ||
      /\/(?:day|week|month|year)\/\d{4}/i.test(path) ||
      /\/\d{4}[-/]\d{2}(?:[-/]\d{2})?\/?/i.test(path) ||
      /\/(?:month|week|day|today)\/?$/i.test(path) ||
      path.includes("/tag/") ||
      search.includes("ical=") ||
      search.includes("outlook-ical=") ||
      search.includes("eventdisplay=") ||
      search.includes("tribe-bar-date") ||
      search.includes("eventdate") ||
      search.includes("startdt=") ||
      search.includes("enddt=") ||
      search.includes("action=template")
    ) {
      return false;
    }

    // 6. Reject single-event permalinks (e.g. /event/polar-express-16/ or Eventbrite single events /e/...)
    if (/\/event\/[^\/]+\/?$/i.test(path) || (/\/events\/[^\/]+\/[^\/]+\/?$/i.test(path) && !path.includes("/page/"))) return false;
    if (path.includes("/e/") || path.includes("/tickets/")) return false;

    // 7. Reject authentication, account, cart, checkout, and redirect loops
    if (
      path.includes("/account") || path.includes("/login") || path.includes("/logout") || path.includes("/signin") ||
      path.includes("/signup") || path.includes("/register") || path.includes("/basket") || path.includes("/privacy") ||
      path.includes("/terms") || search.includes("returnurl") || search.includes("redirect") || search.includes("next=") ||
      search.includes("dest=") || search.includes("goto=") || urlStr.length > 200
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects whether an event is mobile or a tour (walking tour, ghost tour, pub crawl, parade, 5k run, etc.)
 */
export function isMobileOrTourEvent(title?: string, details?: string, category?: string, venue?: string): boolean {
  const combined = `${title || ""} ${details || ""} ${category || ""} ${venue || ""}`.toLowerCase();
  return /\b(walking tour|ghost tour|haunted tour|historic tour|guided tour|trolley tour|sightseeing tour|pub crawl|bar crawl|beer crawl|wine crawl|brewery crawl|scavenger hunt|bike tour|parade|fun run|5k\b|10k\b|marathon\b|charity walk|turkey trot)\b/i.test(combined);
}

/** True if the event carries ANY page-sourced location signal. */
export function hasAnyLocation(ev: { city?: string; address?: string; lat?: number; lon?: number }): boolean {
  return !!(cleanStr(ev.city) || cleanStr(ev.address) || (ev.lat !== undefined && ev.lon !== undefined));
}
