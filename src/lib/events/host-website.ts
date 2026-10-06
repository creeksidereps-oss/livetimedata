// src/lib/events/host-website.ts

// Explicit blacklisted domain patterns (social media, ticket brokers, calendar aggregators, shorteners)
const BLACKLISTED_DOMAINS = [
  // Social Media & Video
  "facebook.com", "fb.me", "fb.com",
  "instagram.com", "instagr.am",
  "twitter.com", "x.com", "t.co",
  "tiktok.com",
  "linkedin.com",
  "pinterest.com", "pin.it",
  "youtube.com", "youtu.be",
  "threads.net",
  "nextdoor.com",
  "reddit.com",
  "snapchat.com",
  "twitch.tv",
  "tumblr.com",
  "vimeo.com",
  "discord.com", "discord.gg",
  "t.me", "telegram.org",

  // Ticket Aggregators / Brokers / Marketplaces
  "eventbrite.com", "eventbrite.co.uk", "evb.gg",
  "ticketmaster.com", "ticketmaster.ca", "livenation.com",
  "seatgeek.com", "stubhub.com", "vividseats.com", "axs.com",
  "ticketweb.com", "etix.com", "dice.fm", "feverup.com",
  "brownpapertickets.com", "tickets.com", "universe.com",
  "ticketfly.com", "eventim.de", "eventim.com", "seetickets.com",
  "seetickets.us", "bandsintown.com", "songkick.com", "gametime.co",
  "tickpick.com", "goldstar.com", "todaytix.com", "telecharge.com",
  "broadway.com", "moshtix.com.au", "cityline.com", "ticketek.com.au",

  // Calendar / Blog / Search Aggregators & Directories
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com",
  "onthecheap.com", // covers *.onthecheap.com
  "livingonthecheap.com",
  "northcarolinahauntedhouses.com", "hauntedhouses.com", "hauntworld.com",
  "patch.com", "eventful.com", "allevents.in", "timeout.com", "meetup.com",
  "yelp.com", "tripadvisor.com", "foursquare.com", "citysearch.com",
  "thrillist.com", "eventsnearhere.com", "spinbackpromos.com",

  // Link Shorteners / Redirectors
  "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "is.gd",
  "linktr.ee", "cutt.ly", "rebrand.ly", "qrco.de",

  // Internal LiveTimeData
  "livetimedata.com", "localhost"
];

const BLACKLISTED_PATH_PATTERNS = [
  /\/login\b/i,
  /\/signin\b/i,
  /\/cart\b/i,
  /\/checkout\b/i,
  /\/redirect\b/i,
  /[?&]returnurl=/i,
  /[?&]next=/i,
  /[?&]redirect_to=/i
];

/**
 * Returns true if the given URL is a legitimate official host or venue website
 * and NOT a social media network, ticket broker, calendar aggregator, or link shortener.
 */
export function isLegitimateHostWebsite(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || !host.includes(".")) return false;

    // Check domain blacklist
    for (const badDomain of BLACKLISTED_DOMAINS) {
      if (host === badDomain || host.endsWith("." + badDomain) || host.includes(badDomain)) {
        return false;
      }
    }

    // Check path / redirect patterns
    for (const pattern of BLACKLISTED_PATH_PATTERNS) {
      if (pattern.test(parsed.pathname) || pattern.test(parsed.search)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if the host entity name is a known aggregator, scraper, or broker
 * (e.g. "Charlotte on the Cheap", "Eventbrite", "Ticketmaster").
 */
export function isBlacklistedHostName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return true;
  const n = name.trim().toLowerCase();
  if (n.length < 2) return true;
  return (
    n.includes("on the cheap") ||
    n.includes("onthecheap") ||
    n.includes("eventbrite") ||
    n.includes("facebook") ||
    n.includes("ticketmaster") ||
    n.includes("livetimedata") ||
    n.includes("local venue") ||
    n.includes("wordpress") ||
    n === "events" ||
    n === "calendar" ||
    n === "admin"
  );
}

/**
 * Formats a verified host URL cleanly for user display (e.g. "usghostadventures.com/charlotte-ghost-tour")
 */
export function formatDisplayHostUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const domain = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    const full = `${domain}${path}`;
    return full.length > 55 ? `${full.slice(0, 52)}...` : full;
  } catch {
    return rawUrl;
  }
}
