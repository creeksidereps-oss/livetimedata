# LiveTimeData — Spider Lifecycle, Events & Email Pipeline Handoff

*Generated on October 16, 2026 for the Next Development Session*

---

## 1. Core Platform Mandates

1. **Global Site Reality:** 
   * LiveTimeData is an international platform covering physical local communities, civic life, culture, sports, and events worldwide.
   * **STRICT PROHIBITION:** Never default missing cities, states, or regions to North Carolina, Raleigh, or any other fallback location. If a location is unknown, it must remain `null` or unassigned until accurately verified.

2. **In-Person Physical Events Only (Per Project Rules):**
   * Online/virtual webinars, Zoom meetings, and remote workshops are strictly prohibited.
   * Yard sales and estate sales must have a verified physical street address with a house/street number.

3. **Cost-Controlled / Zero-AI Crawling:**
   * Crawling and extraction must rely on deterministic HTML, JSON-LD, iCal, and structured feed parsing, keeping operating costs near zero.

---

## 2. The Integrated Architecture: Spiders + Email Newsletters

A core architectural pillar that needs to be properly realized:

### The Overlap Between Spiders and Email:
* **The Problem:** The spider was continuously crawling tens of thousands of web pages looking for event updates, consuming bandwidth and thread capacity.
* **The Intended Design:** Many organizations, municipalities, cultural venues, and community calendars publish their events via **email newsletters**.
* When LiveTimeData receives newsletters from a source at `LiveTimeData@gmail.com`:
  1. The **Email Ingestion Engine** parses and extracts the upcoming schedule directly from the newsletter.
  2. The source in `sources` is marked with a reduced crawl frequency (e.g. `scrape_interval_days = 60` or `status = 'pushed_via_newsletter'`), **bypassing the need to actively scrape that source's website**.
  3. The spiders should only crawl sources that do **not** have an active newsletter push feed, saving massive amounts of compute and avoiding redundant scraping.

---

## 3. Current System State & Metrics (October 16, 2026)

* **Current Spider State:** **OFF / IDLE** (0 `node.exe` processes running on machine).
* **Total Events in Database:** ~92,960 events.
* **Total Sources in `sources` Table:** 114,207 sources.
* **The Primary Lifecycle Bottleneck:**
  * **110,359 out of 114,207 sources (96.6%) have yielded 0 events.**
  * The crawler's recursive link discovery scraped any link with `/events/`, `/calendar/`, or `/shows/` and automatically enqueued them with `next_scrape_due = NOW()`.
  * This birthed **47,232 "Sub-Calendars"** and **22,711 "artist_tour" links**, many of which were static "About" pages, team rosters (e.g. 45,820 German amateur football club pages from `fussball.de`), or single expired event permalinks.
  * Over 40,000 dead/empty URLs were due to be scraped simultaneously, choking out legitimate calendar hubs.

---

## 4. Key Files & Architecture Components

### A. Crawling & Event Discovery
* `scripts/run_spiders_daemon.ts`: High-throughput daemon supporting multi-domain diversity batches and city yard sale aggregators.
* `scripts/spider_daemon.js`: Autonomous continuous crawler loop.
* `src/lib/discovery/calendar-crawler.ts`: Universal HTML / JSON-LD / iCal extraction engine, email scraping (`isValidEmail`), and calendar URL validation (`isValidCalendarSourceUrl`).
* `src/lib/events/dedup.ts`: Event deduplication engine (recently optimized with date-bucketing to prevent $O(N^2)$ freezes on large city inventories).
* `src/app/api/events/route.ts`: Public events API with spatial/radius search and in-person filtering.

### B. Email & Newsletter Ingestion
* `scripts/ingest_newsletters_pipeline.js`: Connects to `LiveTimeData@gmail.com` via IMAP, parses incoming newsletters, and ingests events, facts, and entities.
* `scripts/archive_newsletters.cjs`: Archives processed newsletter emails into dedicated IMAP mailboxes.
* `scripts/ingest_and_archive_sales_emails.cjs`: Dedicated pipeline for yard sale, garage sale, and consignment auction emails.
* `scrapers/email_hunter.js`: Extracts contact and newsletter subscription emails from discovered websites.
* Database Table: `email_contacts` (tracks discovered emails, categories, status, and associated venue/source).

---

## 5. Scope for the New Threads

### Thread Option A: The Spider Lifecycle & Source Curation Redesign
* **Objective:** Rethink what gets entered into `sources` and how the crawler executes.
* **Topics to Address:**
  1. **Strict Gatekeeping for New Sources:** Validate that a URL has actual recurring calendar markup (JSON-LD `Event`, iCal, or table schedules) *before* permanently saving it to `sources`.
  2. **Severing Recursive Link Loops:** Stop automatically birthing sub-links and tour links into the database as active sources.
  3. **Queue Pruning:** Deactivate or archive the 110,000 zero-yield non-calendar sources so the queue only schedules genuine global event hubs.
  4. **Integrating Push Feeds:** Update the crawler queue query to check if a source is covered by newsletter ingestion, skipping or throttling web crawls accordingly.

### Thread Option B: The Email & Newsletter Ingestion Pipeline
* **Objective:** Maximize event ingestion from email newsletters and link incoming emails to source records.
* **Topics to Address:**
  1. Routine polling and automated execution of `ingest_newsletters_pipeline.js`.
  2. Linking newsletter sender addresses back to the corresponding `sources` and `entities` records.
  3. Updating the source's `last_scraped_at` / `next_scrape_due` when a newsletter is received so the crawler doesn't duplicate work.
  4. Newsletter subscription discovery: using `email_contacts` to subscribe LiveTimeData to more community calendar digests.

---

## 6. How to Prompt the New Thread

When opening the new thread, you can prompt the new agent with:

> *"Please read `docs/SPIDER_LIFECYCLE_AND_EMAIL_HANDOFF.md` to get full context on our platform, our current database state, and our architecture. I want to rethink the spider lifecycle and how it connects with our email newsletter ingestion."*
