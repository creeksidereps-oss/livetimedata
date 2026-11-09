# Events Rewrite: Handoff (state as of 2026-11-08 22:30 ET)

Read this file first, then `GEMINI.md`. **Do not re-audit what's already done.**

## Where things stand
- **Branch:** `rewrite/events`. All work is **uncommitted** (owner asked to commit at the end). **Nothing is deployed.** `main` is unchanged.
- **Rollback points (already pushed to GitHub):**
  - tag `checkpoint/pre-rewrite-live-2026-11-08`: the code that's live now
  - branch/tag `backup/pre-rewrite-2026-11-08` / `checkpoint/pre-rewrite-wip-2026-11-08`: live code plus the owner's WIP
- **Database backup** taken before any purge: `C:\Users\creek\livetimedata-backups\pre-purge-2026-11-08T23-19-10-594Z\`
  - NDJSON for events (82,099), sources, cities, spider_lookup_needed, yardsale_city_source_stats
  - Some descriptions contain U+2028 characters: read with `split("\n")`, not readline.
- **Protected zone (City Search):** never touch it. Verify with `node scripts/guards/protected-zone.cjs` (must print "Protected zone intact.").

## Phases
| Phase | Status |
|---|---|
| 1. New intake core | ✅ Done |
| 2. Data purge | ⏸️ Dry run done, **waiting for owner approval to EXECUTE** |
| 3. Pages / city defaults | ✅ Done |
| 4. Growing sitemap | ✅ Done |
| 5. Dead-code removal | ⬜ Partly done (old crawler deleted); rest not started |

## Phase 1: intake core (done)
- `src/lib/events/location/`
  - `geoReference.ts`: region/country/ccTLD reference data, used only to disambiguate
  - `geocoder.ts`: Open-Meteo first, GeoNames backup, cached in table `geo_lookup_cache`
  - `resolveLocation.ts`: the only place an event gets a location; no defaults; rejects ambiguous matches
  - `citySlug.ts`: canonical `/time/{slug}`, mirrors the search-landing slug logic; inserts verified `cities` rows
- `src/lib/events/intake/publishEvent.ts`: **the only writer to `events`**. Enforces 7 rules and logs every decision to `event_intake_log`.
- `src/lib/events/crawl/`: new crawler (Track A). JSON-LD, Tribe REST, iCal, AEG, Simpleview, DOM cards, tables. Location only from the page. The old `calendar-crawler.ts` (2,548 lines) is deleted. `scripts/spider_daemon.js` is retired (exits).
- All 12+ insert paths go through `publishEvent` (Track B): curation, quick-post, submit, vision, admin ingest, yard sales (`kind:"sale"`), discover-entity, spiders, rescrape.
- Return **410 Gone**, waiting on owner approval to delete:
  - `/api/admin/scraper`: invented events with Gemini on every city-page visit
  - `/api/events/trigger`: ticket aggregators
- **Defaults removed:**
  - Code: parent-city inheritance, `||'NC'`, `||'US'`, the 2-letter⇒US rule, fallbackCity/"Local", Statesville/Greenwich in `city-dashboard/ui.tsx`, the NC seed list (`seed-sources.ts` deleted), `'US' AS country_code` in the discover-entities cron.
  - Database column defaults dropped: `entities.country_code`, `outreach_targets.country`, `city_fun_facts.country_name`.

## Migrations already applied to production (all additive)
`scripts/migrations/` (runner: `node scripts/migrations/run-migration.cjs <file>`)
- `2026-11-08_events_location_integrity.sql`: events columns `city_slug`, `country_name`, `latitude`, `longitude`, `location_verified_at`, `location_method`, `listing_kind`; tables `geo_lookup_cache` and `event_intake_log`
- `2026-11-08b_event_tombstones.sql`: table `event_tombstones`
- `2026-11-08c_drop_country_defaults.sql`
- `2026-11-08d_content_indexes.sql`

## Phase 3/4 (done)
- **Event page** `src/app/events/[id]/page.tsx`:
  - back link goes to `/time/{city_slug}`; www canonical
  - indexable only if public + verified + upcoming + not a sale
  - non-public statuses return 404
- **Legacy** `src/app/city-dashboard/page.tsx`: 301 to `/time/{slug}`; unknown city returns 404 (no Greenwich).
- **Event reads by verified coordinates:** `src/lib/events/query.ts`, used by the rewritten `api/events/route.ts` and `api/events/search/route.ts`.
- **City indexability rule** `src/lib/seo/cityIndexability.ts`: curated set OR real content (verified event, city report, approved fun fact, live photo, live webcam). Applied to `time/` and `weather/` robots, imported below the protected section.
- **Sitemap:** index at `src/app/sitemap.xml/route.ts`; parts at `src/app/sitemaps/[part]/route.ts` (`static`, `cities-N`, `events-N`, 40k each); data in `src/lib/seo/sitemapData.ts`. Old `src/app/sitemap.ts` deleted.
- `GEMINI.md` updated: SEO rules plus a new "Location Integrity Rules" section.

## Verification status
- `npx tsc --noEmit -p .`: 0 errors
- `npx tsx scripts/tests/resolve-location.test.ts`: 40/40
- `npx tsx scripts/tests/crawl-extract.test.ts`: 52/52
- `npx next build`: passes
- Local smoke test: 15/15 (`next start -p 3107`). Note: the events sitemap stays empty until the purge runs, because no rows have `city_slug` yet.

## Phase 2: NEXT STEP (needs owner "go")
- **Script:** `scripts/purge/revalidate-events.ts`
  - dry run: `npx tsx scripts/purge/revalidate-events.ts`
  - execute: `npx tsx scripts/purge/revalidate-events.ts --execute`
  - Execute deletes failing rows (writing IDs to `event_tombstones` first) and writes the verified location onto kept rows.
- **Final dry run result** (report in `C:\Users\creek\livetimedata-backups\revalidate-dryrun-2026-11-09T03-10-59-442Z\`):
  - keep 7,048; pending_review 7,234; delete 67,817
  - 3,903 upcoming public events kept (3,880 non-sale and sitemap-eligible)
  - Top delete reasons: `no_verifiable_source_url` 25,788 (AI-generated "tourism calendar" lists); `address_city_only_untrusted` 23,586 (inherited "Raleigh, NC" / "Ocean City, MD"); templated or title-only descriptions 11,429
- **After executing:**
  1. Re-run the smoke checks (sitemap events part now non-empty).
  2. Re-run the protected-zone guard and tsc.
  3. `git add -A` and commit on `rewrite/events`.
  4. Ask the owner before merging to `main` / deploying.

## Open owner decisions
1. Approve the Phase 2 execute.
2. Delete `/api/admin/scraper` and `/api/events/trigger`?
3. Deleted event pages return 404 instead of 410: is that OK? (410 would need a DB check in the edge middleware.)
4. Phase 5 dead-code sweep for the events feature (after merge).

## Known leftovers / notes
- `src/app/api/admin/scraper/government/adapters` (webcams feature) still has `"NC"`/`"US"` defaults in `nc.ts`/`nps.ts`. Outside the events scope; flag it to the owner.
- `discover-entity` registers the first DuckDuckGo result as a source. This may violate the Option A rule (real calendar pages only); review it.
- Open-Meteo's free tier is non-commercial. The owner knows and accepts this for now.
- Crons in `vercel.json`: scrape-yardsales, notify-vendors, event-retention. Spider-lifecycle is paused (not in `vercel.json`).
- Windows/PowerShell: many files use CRLF. A CRLF-safe find/replace helper is at `C:\Users\creek\.gemini\antigravity\brain\913e52ce-cd2e-415f-bd4e-38192661baa9\scratch\replace.cjs` (spec: `{file, edits:[{find,replace}]}`).
