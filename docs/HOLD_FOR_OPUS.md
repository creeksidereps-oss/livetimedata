# Handoff for Opus: Spider Lifecycle & Ingestion Diagnostics

## Summary for Opus
The user is switching to Opus to address core architectural failures in the spider discovery and crawler ingestion system. 

The goal from the user: The spider system must cascade, recursively discover venues and calendar hubs, handle thousands of real events without stalling, and cleanly handle real-world venue websites rather than dying on firewalls, JavaScript shells, or producing single-digit event yields.

---

## 1. Current State & Where Code Lives
* **Single Intake Gate:** `src/lib/events/intake/publishEvent.ts` (enforces verified location, no default cities, in-person only, confirmed start time, date >= today).
* **Location Engine:** `src/lib/events/location/resolveLocation.ts` (Open-Meteo first, GeoNames backup, cached).
* **Spider Lifecycle Engine:** `src/lib/discovery/spider-lifecycle.ts`
* **Crawler Core:** `src/lib/events/crawl/` (`extract.ts`, `parsers.ts`, `helpers.ts`, `ingest.ts`).
* **Cloud Cron:** `/api/cron/spider-lifecycle` scheduled in `vercel.json` (`*/15 * * * *`).
* **Active Database Snapshot (as of 2026-11-09):**
  * `events`: 14,597 total (795 public upcoming, 7,528 in `pending_review`).
  * `sources`: 163 active, 10 failed, 41,250 in `legacy_hold` (user explicitly directed: **do not run legacy_hold**; new seeds only).

---

## 2. The Core Failures Diagnosed Today

### A. The Datacenter / Cloud WAF Block Problem (403 Forbidden & Socket Hang Up)
When Vercel serverless functions make direct `fetch()` calls to external venue websites, an enormous percentage are immediately blocked or hung up on by Cloudflare, Akamai, and municipal hosting firewalls:
* **Visit Raleigh (`#1213`):** 5/5 consecutive 403 Forbidden.
* **Statesville Parade, Downtown Statesville, Statesville Event Center (`#1033204`, `#547067`, `#49908`):** 5/5 consecutive 403 Forbidden.
* **ArtsCalendar Broward (`#1033957`):** 5/5 consecutive `socket hang up` (firewall connection reset on Vercel IPs).
* **Impact:** 30%–40% of all entered seeds died on the first hop before extracting a single byte.
* **Opus Task:** Design a resilient fetching strategy. Determine how to handle WAF shielding (headers, user-agents, proxy strategy, or discovering upstream JSON/REST API feeds like Simpleview or WordPress `/wp-json/` endpoints).

### B. The Cascading Spider & Sub-Page Model Is Not Scaling
* **Expectation:** Feeding a few seed calendar hubs should cascade recursively, discovering hundreds of connected venues, performers, and sub-pages, yielding thousands of events.
* **Observed Reality:** The 13 seeds spawned 145 sub-spiders, but most spawned sub-spiders found **0 events** (`[none]`).
* **Why:** 
  1. Modern event portals (Angular, React, Vue, ASP.NET) render event cards dynamically via client-side JavaScript or internal API calls; the static DOM parser in `extract.ts` only sees empty shell containers (`<div id="root">`, `<aa-sessions-dates>`).
  2. The sub-page URL heuristics in `isValidCalendarSourceUrl()` match sub-URLs that often turn out to be ticketing redirect wrappers or single-show landing pages that don't cascade further.
* **Opus Task:** Overhaul `src/lib/events/crawl/` to support deeper extraction, structured API discovery, and genuine recursive calendar hub following.

### C. Queue Stalling & Interval Architecture
* **Problem:** In `spider-lifecycle.ts`, once a source is crawled, it updates `next_scrape_due = NOW() + 30 days`. With a small, controlled seed list, the spider crawls once and the entire cron goes completely idle (`no due sources; generation complete`) for the next 34 runs.
* **Opus Task:** Re-architect the living spider lifecycle to manage crawl depth, seed exploration versus re-crawl intervals, and dynamic queue replenishment.

### D. Specific Seed Patterns Needing Architectural Handlers
1. **French & European Theatres/Arenas:**
   - Comédie-Française (`calendrier-2026-2027` - season-specific URLs, interactive JS agenda).
   - Accor Arena (`accorarena.com/fr/programmation` - Angular SSR custom web components, door/start times omitted from DOM and pushed to `billetterie` subdomain).
   - French ticketing clubs: PSG (`billetterie.psg.fr`), Paris FC, Stade de France.
2. **Major Sports League Roll-ups (Rule 7):**
   - Official NFL, NBA, MLB, NHL, Soccer schedules (`nfl.com/schedules`, `espn.com/*`). Need official league or direct schedule JSON endpoints that cleanly roll up matches to home stadium entities.
3. **Primary Racing Feeds:**
   - Replacement for secondary broker VividSeats: Equibase or official track calendars.
