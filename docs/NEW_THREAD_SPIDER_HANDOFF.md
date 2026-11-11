# NEW THREAD HANDOFF: Spider System Repair & Handler Design

Read this file, then `GEMINI.md`, then `docs/EVENTS_REWRITE_HANDOFF.md`. Keep responses short. No subagents unless the owner asks.

---

## 0. Hard rules learned in the previous thread (do not repeat these mistakes)
1. **Never run spiders, crawls, or `runLifecycleRound()` on the owner's laptop.** Spiders run only on Vercel via the cron `/api/cron/spider-lifecycle`. Running them locally froze the owner's machine.
2. **Do not activate `legacy_hold` sources** (41,250 rows). The owner is testing with **new seeds only**, so every problem can be seen and handled.
3. **Report honest numbers.** Separate `published` from `pending_review`, and separate the `crawler` origin from the `yardsale` origin. The previous thread reported "+321 verified events", but the crawler actually published only **21**.
4. **No one-off band-aid patches per site.** The owner wants reusable handlers for each type of situation.
5. Shell is PowerShell: use `;` and not `&&`. Inline `node -e` with backticks or `$1` breaks. Write a temp `.cjs` script in `scripts/data/`, run it, then delete it. DB access: `require('dotenv').config({ path: '.env.local' })` + `createPool({ connectionString: process.env.POSTGRES_URL })`.
6. Run `node scripts/guards/protected-zone.cjs` and both test suites before every commit.

---

## 1. Current state (as of 2026-11-10)
- `vercel.json` crons: `spider-lifecycle` (every 15 min, re-enabled in commit `abbc1cd`), `scrape-yardsales` (daily), `notify-vendors` (weekly), `event-retention` (daily).
- `claimNextSource()` in `src/lib/discovery/spider-lifecycle.ts` now skips `source_type = 'yardsale_aggregator'`. Those belong to the yard sale cron only.
- Sources: ~163 active, 10 `failed`, 41,250 `legacy_hold`.
- `docs/HOLD_FOR_OPUS.md` holds the seed problem list. **Note:** the last rewrite of that file dropped some detail (the full French/ESPN URL lists, the facility pages, Théâtre du Palais-Royal). The full version is in git commit `7868020`.

### Seeds the owner gave (activated)
Visit Raleigh, NC Festivals, Lenovo Center, Charlotte Motor Speedway, Koka Booth Amphitheatre, Blumenthal Arts, Burke County Fairgrounds, Downtown Statesville, Statesville Event Center, Yadkin Valley Events, Statesville Parade, Iron Podium, United States Strongman, Disney On Ice, Trans-Siberian Orchestra (tracking params stripped), ArtsCalendar Broward.

### Real crawler results, Nov 9–10 (`event_intake_log`, origin = crawler)
| outcome | count |
|---|---|
| published | **21** |
| pending_review | 135 (133 = `address_not_specific`) |
| rejected | 183 (**153 = `location_no_location_info`**, 30 = `location_ambiguous`) |
| duplicate | 201 |

The yard sale cron is reported separately (7 published, 337 pending, 2,710 rejected, 18,082 duplicates). Don't mix it into spider numbers.

---

## 2. Root causes found (fix these first, in this order)

### A. Venue calendars are rejected because their own location is never used (biggest problem)
Lenovo Center: 11 found, 11 rejected. Blumenthal Arts: 12 of 12 rejected. Disney On Ice and Charlotte Motor Speedway: all rejected. Reason: `source page gave no city, address or coordinates`. Event cards on a venue's own calendar don't repeat the city; the venue *is* the location. The rewrite passes only the URL to the crawler, so the venue's verified address is lost.
- **Needs an owner decision before coding:** add a "venue-stated location" step. Read the venue's own address once from its site (JSON-LD `Place`/`Organization`, footer, contact page), verify it with `resolveLocation()`, store it on the source/entity, and apply it to events on that venue's own calendar only. This is the venue's own stated address, not an inherited default. Confirm with the owner that this fits the Location Integrity Rules.
- `address_not_specific` (133 pending) is probably the same issue.

### B. Cloud fetches are blocked (403 / socket hang up)
Visit Raleigh, all 3 Statesville sites, ArtsCalendar Broward: 5/5 failures each, now `failed`. Vercel datacenter IPs are blocked by Cloudflare or municipal firewalls.
- Build one fetch layer with realistic browser headers and retry/backoff, and try API endpoints first (`/wp-json/tribe/events/v1/events`, `/wp-json/wp/v2/`, iCal `?ical=1`, Simpleview APIs) before the HTML page.
- Record *why* each fetch failed (WAF, 404, timeout, JS shell) so problem seeds sort themselves into handler queues.

### C. The spiders don't cascade
- Sub-pages that get spawned are mostly single-event detail pages. They're all named "X Calendar Hub" (e.g. 30+ "Yadkin Valley Events Calendar Hub" rows, each with 0–1 events), not real hubs.
- `SUB_PAGE_CAP = 10` in `src/lib/events/crawl/extract.ts` (owner said it was a rule earlier). Check this against GEMINI.md Rule 10 "no artificial caps", and ask the owner which rule wins.
- JS-rendered sites (Angular, React, ASP.NET) return empty shells, so the result is "0 found [none]".
- Design: tell **hubs** (lists of many events or venues) apart from **detail pages** (one event). Detail pages are fetched for data and never become spiders. Hubs become spiders. Entities found on events (venues, performers, organizers with URLs) become new seeds.

### D. The queue goes idle
After one crawl every source is set to `+30 days`, so 27 of 34 runs had "no due sources". Separate the **discovery phase** (keep following new hubs and entities right away) from **re-crawl cadence** (monthly). Report queue depth so stalls are visible.

---

## 3. Handler families to design (reusable, never per-site)
1. **Venue calendar handler** (venue's own location applied: Lenovo, Blumenthal, Koka Booth, arenas).
2. **WordPress / Tribe / iCal API handler** (try the API before HTML).
3. **Destination marketing / CVB handler** (Simpleview and similar: Visit Raleigh).
4. **JS-shell / SSR component handler** (Angular/React: Accor Arena `<aa-sessions-dates>`, French ticketing `billetterie.*`).
5. **Season / theatre handler** (year in URL like Comédie-Française `calendrier-2026-2027`; find the permanent route).
6. **Localized date handler** (French month names, e.g. "13 novembre 2026"; European date formats).
7. **Off-site start time handler** (the date is on the venue page, the time only on the ticketing page → today this goes to `pending_review`).
8. **Sports league roll-up handler** (Rule 7: NFL, NBA, MLB, NHL, WNBA, soccer, golf tours, MMA/boxing; games roll up to home venues; decide between official league feeds and ESPN endpoints).
9. **Tour / artist handler** (Disney On Ice, TSO: every tour stop has its own venue + city; dead stops return 404).
10. **Facility directory vs. calendar** (municipal facility pages like `paris.fr/lieux/...` and Stade Yves-du-Manoir have addresses and hours, not events: store them as venues, not spiders).
11. **Rejected-seed intake** (aggregators like VividSeats are banned by Rule 6, so find the primary source instead, e.g. tracks/Equibase for horse racing; bare names with no URL are blocked by Rule 4, so verify the URL first).
12. **Flyer / social image handler** (later: food trucks; Gemini Flash vision costs fractions of a cent per image; `src/app/api/events/ingest/vision/route.ts` already exists. No Google Search Grounding, by Rule 1).

---

## 4. Suggested first steps in the new thread
1. Read `src/lib/discovery/spider-lifecycle.ts`, `src/lib/events/crawl/{extract,ingest,helpers,parsers}.ts`, `src/lib/events/intake/publishEvent.ts`.
2. Ask the owner to decide on 2A (venue-stated location) and on the 10-sub-page cap.
3. Write the plan (handler registry + fetch layer + hub/detail classification + queue phases) and get approval.
4. Build. Add tests next to `scripts/tests/crawl-extract.test.ts`. Deploy. Watch results **only through the Vercel cron + DB queries**.
5. Success measure: published events per seed by handler, from `event_intake_log` (origin = crawler).

---

## 5. Other context from the previous thread (not this task)
- **AdSense first:** no outbound vendor emails until AdSense is approved and live.
- `notify-vendors` cron is a **mock**: it writes `email_logs` rows marked `sent` but sends nothing (mostly placeholder `vendor-{id}@notification.livetimedata.com` addresses). Amazon SES (`src/lib/email.ts`) is configured but not wired in.
- `email_contacts` has 29,375 scraped public addresses (~10k from an old "AI Email Hunter"). They are not used.
- Sitemap: Google re-reads the live `/sitemap.xml`; there's no need to resubmit.
- The owner has a large ChatGPT list of food truck names (mostly names only). Don't paste it into chat or bulk-insert it. It needs real schedule URLs (Rule 4).
