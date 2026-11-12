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
  | "calendar_link"
  | "detail_pages"
  | "sitemap"
  | "embedded_json"
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
  /** 'venue_site' when the location came from the venue's own stated address (venueLocation.ts), not the event card. */
  locationProvenance?: "event" | "venue_site";
}

/** What a crawled page is (spider repair 2026-11-10). */
export type PageClass = "hub" | "detail" | "facility" | "article" | "js_shell" | "empty";

/** A venue / performer / organizer found on a page (with the URL the page itself links to, if any). */
export interface FoundEntity {
  name: string;
  type: "venue" | "performer" | "organization";
  url?: string;
}

export interface CrawlResult {
  events: ExtractedEvent[];
  /**
   * Same-site listing pages (hubs) to spawn as new spiders. No cap (GEMINI.md Rule 10). Only filled when the
   * page produced current/future events or venues (owner rule); never single-event detail pages.
   */
  subUrls: string[];
  /** Pagination pages of THIS listing that were not reached inside the job (carried to crawl_frontier). */
  paginationUrls: string[];
  /** Venues / performers / organizers found on the page (spawned as entity spiders when they have a URL). */
  entities: FoundEntity[];
  extractedEmails: string[];
  /** Strategies that produced events on this page. */
  strategies: ExtractionStrategy[];
  pageClass: PageClass;
  /** Page title (used to name spawned spiders instead of "X Calendar Hub"). */
  pageTitle?: string;
  /** Venue-stated location result for this page. */
  venueLocationStatus?: "verified" | "none" | "multi_venue";
  siteVenues?: { name: string; address: string; citySlug: string; evidenceUrl: string }[];
  /** Design-only handler that should take this page (JS shell, season URL, ...). */
  handlerQueue?: string;
}
