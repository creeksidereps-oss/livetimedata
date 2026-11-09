// src/lib/events/crawl/types.ts
//
// Shapes produced by the crawler extraction layer.
// LOCATION DISCIPLINE: city / region / country / address / lat / lon carry ONLY what the source page
// (or its own feed) states for that event. They are left empty when the page does not say.
// There are no fallback / parent-source / domain-derived locations anywhere in this module.

export type ExtractionStrategy =
  | "jsonld"
  | "tribe_rest"
  | "ical"
  | "aeg_feed"
  | "simpleview_api"
  | "dom_card"
  | "html_table"
  | "adapter_simpleview_sitemap"
  | "adapter_saffire";

export interface ExtractedEvent {
  title: string;
  /** Description text from the source. "" when the source gives none (never templated). */
  details: string;
  category: string;
  /** Venue name as written by the source. "" when absent. */
  venue: string;
  /** Start time as stated by the source ("7:30 PM", "All Day" only when the source says all-day). "" when unconfirmed. */
  startTime: string;
  /** Event date (YYYY-MM-DD) in the event's own local calendar, as stated by the source. */
  eventDate: string;

  // ---- page-sourced location (all optional; empty when the page doesn't say) ----
  city?: string;
  region?: string;
  country?: string;
  /** Full venue address as stated by the source (street line and whatever locality text the source gives). */
  address?: string;
  lat?: number;
  lon?: number;

  /** URL of the page / feed the event was read from. */
  sourceUrl: string;
  officialInfoUrl?: string;
  eventFlyerUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  performerName?: string;
  performerUrl?: string;
  organizerName?: string;
  organizerUrl?: string;
  venueUrl?: string;
  strategy: ExtractionStrategy;
}

export interface CrawlResult {
  events: ExtractedEvent[];
  /** Sub-pages to spawn as new spiders (capped at 10). */
  subUrls: string[];
  /** Total distinct sub-pages discovered before the 10-page cap (flag for admin review if > 10). */
  subUrlsTotal: number;
  extractedEmails: string[];
  /** Strategies that produced events on this page. */
  strategies: ExtractionStrategy[];
}
