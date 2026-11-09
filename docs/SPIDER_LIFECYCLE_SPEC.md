# Spider Lifecycle Spec (owner vision, Nov 3 2026)

> Source of truth for the spider rewrite. Every new chat working on spiders must read this first.
> Written from the owner's own description. Do not add rules here without owner approval.

## 1. Core idea
Admin gives ONE start (venue, artist, team, festival, calendar, flyer, schedule, game, ...).
That start becomes **Spider 1**. Each spider does one job, spawns, and dies. The tree grows on its own and goes global naturally.

Example chain: `boplex.com/events-ticketing` (78 events) → Victoria Monét (23 tour dates) → Fox Theatre Atlanta (32 shows / 137 dates) → Mannheim Steamroller → ... and UBC Thunderbird Arena (Vancouver) appears within 2 jumps.

## 2. What ONE spider does
1. **Get ALL events** on its page. Sites deliver events differently (pagination, "load more", JSON feed, sitemap, JSON-LD, iframe widget). The spider must find the way that gets all of them (78 of 78, not 20 of 78). Methods are reusable **site readers** (adapters), picked per site.
2. **Create events**, one row per date when an event runs on multiple dates: title, date, time, address, venue name, host (when known), good image, description from the source (optionally a brief AI rewrite with no invented facts).
3. **Record the source** in the sources table for a monthly re-crawl (unless it is a dead-end source; see §4), with everything available:
   - url, emails, phone, address, social media links
   - category (venue, music group, artist, lecture, sports team, sports league, festival, ...)
   - **where it came from** (admin seed / found on another source's calendar / aggregator / submission form) + parent source + date found
4. **Report:** events found, events created, events held (with the reason for each).
5. **Spawn one spider per event found** (per event, not per date: 32 Fox shows = 32 spiders, not 137).
6. **Die.**

## 3. Spawned spiders are not all the same (the part earlier chats got wrong)
There is NO single rule for every spawned spider. A spawned spider starts by working out **what it is looking at**, then follows the handler for that case. Examples:

| Spawned from | Spider is about | Its job |
|---|---|---|
| Event at a venue (Boplex → Victoria Monét) | the performer / act | find the act's own tour / events list, crawl it |
| Tour date (Victoria Monét → Fox Theatre) | the venue | find the venue's own calendar, crawl it |
| Event on a ticket reseller (tickets-center.com) | the real venue or act behind it | use the reseller only to learn names/dates; find the official site for the monthly cycle |
| Sports game | team / league | roll up to the league schedule |
| Festival | festival | crawl the lineup + schedule |

New cases get **new handlers**. A fix for one case must never change other handlers.

## 4. Aggregators: two kinds
- **Dead-end aggregators** (ticket resellers like tickets-center.com, Bandsintown, Seated): may be used to *discover* events/entities, but are **never added to the monthly cycle**.
- **Living aggregators** (yardsales.com, gsalr.com, ...): keep producing current data, so they **can** be in the monthly cycle.
- Which list a domain is on is an admin-editable table, not code.

## 5. Problems go to a work queue
Anything a spider cannot resolve (no official site found, events missing a time, page blocked, unclear category, ...) goes into an **issues queue** with the reason, for admin or a designated AI to handle. The lifecycle keeps growing meanwhile. Held events wait for a separate review system.

## 6. Universal rules (apply to every spider; only admin can override)
- No Google Grounded Search / paid search. Run as close to $0 as possible; any cost is tightly managed.
- Never invent facts (URLs, dates, times, addresses, hosts).
- Current and future events only. In-person only.
- No geographic borders.

Everything else is a **per-handler** detail, not a global rule.

## 7. Scale
1 → 78 → ~1,600 → ~32,000 spiders in 3 jumps. So the system needs a queue, **dedupe by entity** (the Fox Theatre is crawled once, however many artists lead to it), and a steady processing rate.

## 8. Owner answers (Nov 3 2026)
- **Graphic required on every event.** Use, in order: the event's own flyer or graphic, then the artist's logo or image, then the venue's or festival's logo. Most events have good flyers, so look for them first.
- **Check first, no duplicates.** Before a new spider does anything, it checks (a) the master sources bank and (b) the email-newsletter source bank for its entity. If the entity is already in either one, the spider is done. There must never be duplicate entities in the master source database.
- **Typical spawn directions:**
  - a) Venues spawn spiders for their events (the acts).
  - b) Artists, bands, performances, lectures, teams and league schedules spawn venues, and sometimes festivals.
  - c) Yard, boot, estate and garage sales and auctions are usually one-offs. They spawn nothing and are not added to the sources bank. The exception is living aggregators (craigslist, yardsales.com, gsalr.com, more to research). These run on their own cron, not the monthly lifecycle.
  - d) League schedules will need many handlers over time. The system must handle what we know now and grow a new handler each time we hit a new wall.
- **Name search at \$0** is still an open design item. A rogue AI once ran up Grounded Search costs, which is why the universal no-paid-search rule exists.
- **Budget:** limited. It grows once the calendar is working and in front of users.
- **Situational rules move into handlers.** The 10-page threshold was a guard against loops through newspapers and stale schedules. The real fix is handlers that know what to look for on each kind of site.
- **No sleep system.** Spiders keep firing and never stay on one site long. A source is never revisited sooner than 30 days in the normal cycle.
- **Monthly re-crawl in day groups.** All sources due on a given day (for example, the 1st) fire together, then run whatever lifecycle they find. Re-crawls spawn spiders only for new events, so spawning tapers off over time. Email and user submissions will eventually outnumber spider finds.

## 9. Owner decisions (Nov 3 2026, round 2)
- **Name search:** use only free options 1–4: links on the page, Wikidata, MusicBrainz, OpenStreetMap. Anything unresolved goes to the issues queue. **Review the queue after 48 hours** to decide whether more search methods are needed.
- **One new master entities bank.** Nothing from the old `sources`, `entities`, `performers` or spider queue tables moves over. Entities return through seeds, the lifecycle and user submissions.
- **Email-newsletter sources** don't exist yet. That system will be designed later, and the dedupe check will include it once it exists.
- **User submission form must seed the lifecycle.** Do this right after the lifecycle is running.
- **Handlers are built as each situation comes up,** from real cases, not guessed in advance. `calendar-crawler.ts` gets broken up into handlers.
- **Crons:** keep the daily sale-type cron (yard, estate, consignment and garage sales, auctions; audition aggregators will join it). Revisit its timing and sources later. Cancel every other event cron; the lifecycle replaces them.
- **notify-vendors** is an email feature, not a cron. It stays frozen until the calendar works.
- **`scripts/spider_daemon.js`** must never run (it freezes the owner's PC). Delete it once the new lifecycle is live.
- **Old spider data** (`spider_lookup_needed`, `spider_admin_review`, ...) gets discarded, not migrated.
- **Existing events are kept.** When a new event duplicates an existing one, copy any true information or graphic from the old row onto the new one, keep the new one and delete the old one. A full audit of old events comes later.
