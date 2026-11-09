# Project Guidelines & Rules - LiveTimeData

## Webcam Ingestion & Sourcing Rules

### Banned Sources
- **Windy.com / Windy Webcams:** **STRICTLY BANNED / DO NOT USE.**
  - **Reason:** Hijacks and steals traffic, forces external redirects, and degrades the user experience.
  - **Policy:** Never suggest, ingest, scrape, or integrate Windy.com or Windy Webcams into LiveTimeData.

### Preferred Sources
- Direct state & municipal Department of Transportation (DOT) 511 camera networks & ArcGIS REST layers.
- YouTube Live Streams (direct embeds, e.g. Explore.org, official city/harbor streams).
- Direct municipal, park service (NPS), and weather camera endpoints without traffic-hijacking wrappers.

### Sources Under Review / Backlog (To Audit When Project Resumes)
- **WorldCam.io:** Check feasibility for LiveTimeData (190k feeds directory, licensing/commercial API vs. scraping rules).
- **Webcams.travel:** Audit whether it redirects to Windy branding/wrappers or hijacks traffic before deciding whether to use or permanently ban.

## Event Ingestion & Policy Rules

### In-Person Only Policy (No Online / Virtual Events)
- **Online / Virtual Events:** **STRICTLY BANNED / DO NOT USE.**
  - **Reason:** LiveTimeData is exclusively a physical local community events and city intelligence platform.
  - **Policy:** Never ingest, scrape, approve, or display online events, virtual webinars, Zoom/Webex meetings, remote certificate workshops, or online-only auctions.
  - All yard sales and auctions must have a physical on-site street address.

### Start Time & Curation Requirements (TBD / TBA Policy)
- **TBD / TBA Start Times:** Never accept or publish events with unconfirmed "TBD" or "TBA" times directly to the live feed.
- **Curation List (`pending_review`):** Tentative, placeholder, or time-unknown listings must be held in `pending_review` until an official start time is verified.
- **Public Feed:** Strictly displays events with verified, confirmed start times or explicit full-day schedules.

### Current & Future Events Only (No Expired / Past Events)
- **Expired / Past Events:** **STRICTLY DISCARD / DO NOT INGEST.**
  - **Reason:** Old events consume database resources and confuse users without providing any actionable value.
  - **Policy:** Ingestion pipelines (email miners, spiders, news feeds, RSS) must strictly extract and insert current and future events (`event_date >= CURRENT_DATE`). Any event with a date prior to today must be discarded immediately before database insertion.




### Event Retention Policy (Stored Events)
- **Ingestion** still only accepts current/future events (see rule above).
- **Retention** of events already in the database (enforced daily by `/api/cron/event-retention`):
  - **Sale-type listings** (yard sales, garage sales, car boot / boot sales, rummage / tag / moving sales, estate sales, flea markets, auctions): **delete 7 days** after the event date.
  - **All other events:** keep for **18 months** after the event date, then delete.

## SEO / Indexing Rules
- **Growing index (set by owner, Nov 8 2026):** a city page becomes indexable and enters the sitemap **automatically once it has real content**: a verified upcoming event, a city report, approved fun facts, live photos, or live webcams (`src/lib/seo/cityIndexability.ts`). The curated set (`src/data/indexableCities.json` + homepage top-100) is always indexable. City pages without content stay live but `noindex`. Page robots tags and the sitemap use the same rule.
- **Sitemap:** `/sitemap.xml` is a sitemap index that grows automatically (`/sitemaps/static.xml`, `/sitemaps/cities-N.xml`, `/sitemaps/events-N.xml`, max 40k URLs each).
- **Events in the sitemap:** every verified, public, upcoming event is added as soon as it is published. After its date passes it leaves the sitemap and becomes `noindex` (page stays live until the 18-month retention delete).
- **Sale-type listings** (yard/garage/boot/estate sales, auctions, flea markets) are **never** in the sitemap and always `noindex`, because they are deleted 7 days after the event.
- **No site-wide canonical** in the root layout. Every indexable page declares its own canonical.
- **Internal links** to city pages must use clean, parameter-free URLs (`/time/{slug}`), never `?lat=&lon=` query strings. The legacy `/city-dashboard?slug=` route only 301-redirects to `/time/{slug}` (unknown city = 404). Event links are `https://www.livetimedata.com/events/{id}`.

## Location Integrity Rules (set by owner, Nov 8 2026)
- **No location defaults anywhere:** never inherit a parent source's city/state, never `|| 'NC'` / `|| 'US'` / `|| "United States"`, never assume a 2-letter region is a US state, never fall back to Statesville / Raleigh / Greenwich / "Local". No DB column may default a country.
- **Single intake gate:** every new event row is written only by `publishEvent()` (`src/lib/events/intake/publishEvent.ts`). Location comes only from what the source itself states, verified by `resolveLocation()` (Open-Meteo first, GeoNames backup, same strategy as City Search). Ambiguous or unverifiable location: automated sources are rejected, human submissions are held in `pending_review`.
- **No AI-fabricated event content:** no generated events, descriptions, times, venues, or addresses. AI may only moderate/classify human submissions.
- **City Search is protected:** never modify `src/app/api/search/route.ts`, `CitySearch.tsx`, `ModalCitySearch.tsx`, `HomeSearch.tsx`, `api/cities/search`, `api/geocode/**`, or the search-landing section of `time/[slug]` and `weather/[slug]`. Verify with `node scripts/guards/protected-zone.cjs`.
- **Long-term goal:** keep all city pages as they propagate, and promote them into the index as they gain real content.

## Spider Lifecycle Rules (set by owner, Oct 20 – Nov 1, 2026)
1. **No paid AI searches in spiders.** Never call Gemini / Google Search Grounding from spiders or crons (~$35 per 1,000 searches). Entities that would need a lookup are logged to `spider_lookup_needed` instead. Spiders run at **$0 Google spend**.
2. **Never remove `GEMINI_API_KEY`.** The live site uses it in many places.
3. **One entity per spider:** crawl it, spawn new spiders for what it discovered, die. No waiting. It is a continuous living cycle (`/api/cron/spider-lifecycle`, every 15 min).
4. **Option A gatekeeper:** a venue/entity only gets a spider if it has a real events/calendar page found on the web. Never fabricate URLs (e.g. `www.{name}.com/events`). No calendar = address only.
5. **Monthly (30-day) crawl** for all new spiders unless the owner says otherwise.
6. **No aggregators** (Bandsintown, Seated, etc.).
7. **League roll-up:** team matches roll up to the league schedule source, not one spider per team.
8. **No geographic borders.** LiveTimeData is a global site; never filter or default to one country/state.
9. **No hardcoded seeds in code.** Seeds and sources live in the `sources` table (and `docs/EVENT_CALENDARS_TO_CRAWL.csv` / `NEW_LIFECYCLE_SOURCES.csv`).
10. **No artificial caps** on events, emails or sub-pages per source/entity.
11. **Failed task rule:** retry after 1 hour, drop (`status='failed'`) after 5 failures.
12. **Every job started must finish**; no new job starts that cannot finish before the run ends.

## Sale-Type Listings Cron (separate rules, `/api/cron/scrape-yardsales`)
- Covers yard sales, garage sales, car boot / boot sales, auctions, storage / lien sales, estate sales, and foreign-language equivalents.
- **Aggregator exception:** these listings may (and must) come from aggregator sites. Rule 6 of the Spider Lifecycle does not apply here. This is why sale-type listings have their own cron.
- **No geographic borders:** all cities are rotated daily; never filter by country/state.
- **True information only:** no date = no listing; no confirmed start time = `pending_review`; never fabricate times, dates or hosts. Host may be empty (time and location are what matter). Real numeric street address required.
- **Zero-yield report:** per city + platform yield is tracked in `yardsale_city_source_stats` for admin curation (no auto-culling).
- Runs **daily**; owner will tune per area / aggregator / season once there is data.
