# Events Rewrite: Handoff (COMPLETE, deployed 2026-11-09)

Read this, then `GEMINI.md`. **The rewrite is finished and live. Do not redo or re-audit it.**

## Final state
- **Deployed to production:** commit `320ec42` on `main` (also on branch `rewrite/events`), via Vercel.
- **Rollback points:**
  - tag `checkpoint/pre-rewrite-live-2026-11-08`: code before the rewrite
  - tag `checkpoint/pre-rewrite-wip-2026-11-08`: the same plus the owner's WIP
- **Database backup before the purge:** `C:\Users\creek\livetimedata-backups\pre-purge-2026-11-08T23-19-10-594Z\` (NDJSON; read with `split("\n")`, not readline, because of U+2028 characters)
- **Purge executed:**
  - 67,811 events deleted; their IDs are in table `event_tombstones`
  - **14,276 events remain, 100% with a verified location** (`city_slug` + coordinates + country)
  - 3,893 are public and upcoming
  - Decision logs: `C:\Users\creek\livetimedata-backups\revalidate-EXECUTE-*`
- **Live checks** (https://www.livetimedata.com): 15/15 pass
  - `/sitemap.xml` is the index: static (6) + cities (8,526 URLs) + events (3,873 URLs)
  - `/city-dashboard?slug=x-` returns 308 to `/time/x`; unknown cities return 404
  - deleted events return 404; `/api/admin/scraper` returns 404
  - sampled event pages: `index, follow`, self-canonical, back link to `/time/{slug}`
- **Owner decisions made:** purge approved; `/api/admin/scraper` and `/api/events/trigger` deleted; deleted events return 404 (not 410).

## How the system works now (summary)
- **Only writer to `events`:** `publishEvent()` in `src/lib/events/intake/publishEvent.ts`.
- **Only place a location is decided:** `resolveLocation()` in `src/lib/events/location/`.
  - Open-Meteo first, GeoNames backup, cached in `geo_lookup_cache`.
  - No defaults. Ambiguous or unverifiable locations: automated sources are rejected, human submissions go to `pending_review`.
  - Every intake decision is logged in `event_intake_log`.
- **Crawler:** `src/lib/events/crawl/` (location only from the source page).
- **Reads:** `src/lib/events/query.ts` (verified events only, by coordinates). Also usable by the future app.
- **Indexability:** `src/lib/seo/cityIndexability.ts` (curated set OR real content); sitemap built in `src/lib/seo/sitemapData.ts`.
- **City Search is protected.** Run `node scripts/guards/protected-zone.cjs` before every commit.
- **Tests:**
  - `npx tsx scripts/tests/resolve-location.test.ts` (40)
  - `npx tsx scripts/tests/crawl-extract.test.ts` (52)
- **Migrations:** in `scripts/migrations/` (all applied). Runner: `node scripts/migrations/run-migration.cjs <file>`.

## Suggested next work (not started)
1. **Reseed events.** Spider-lifecycle is paused (not in `vercel.json`); re-enable when ready. Every source now goes through `publishEvent`.
2. **Review the `pending_review` queue** (7,232 held: TBD time or non-specific address) in admin curation.
3. **Phase 5 dead-code sweep** of the events feature.
4. **Out of scope, flagged:**
   - The webcams government adapters (`src/app/api/admin/scraper/government/adapters/nc.ts`, `nps.ts`) still have `"NC"`/`"US"` defaults.
   - `discover-entity` registers the first DuckDuckGo result as a source (check this against the Option A rule).
5. Open-Meteo's free tier is non-commercial; consider a paid key later.
6. Submit `https://www.livetimedata.com/sitemap.xml` in Google Search Console.
