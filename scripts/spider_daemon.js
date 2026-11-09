// scripts/spider_daemon.js
/**
 * RETIRED — Autonomous Ever-Going Spider Daemon
 *
 * This standalone daemon used to crawl `sources` and INSERT rows into `events` directly, with its own
 * templated descriptions ("{title} live in concert at {venue}."), default times, and parent-source
 * city/state inheritance. That bypassed the publishing rules and stamped thousands of events with the
 * wrong city (e.g. non-US events labelled "Raleigh, NC, US").
 *
 * It has been retired. The same lifecycle now runs as the Vercel cron `/api/cron/spider-lifecycle`
 * (src/lib/discovery/spider-lifecycle.ts), which:
 *   - crawls one due source at a time with src/lib/events/crawl (page-stated locations only),
 *   - writes every event through publishEvent() (src/lib/events/intake/publishEvent.ts),
 *   - spawns child sources without inherited city/state,
 *   - never calls Gemini / Google Search ($0 spend).
 *
 * To run a lifecycle round manually, call the cron endpoint, e.g.:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/spider-lifecycle
 *
 * Former usage (no longer supported):
 *   node scripts/spider_daemon.js                 (Continuous daemon mode)
 *   node scripts/spider_daemon.js --single-run    (Runs one batch and exits)
 *   node scripts/spider_daemon.js --limit=5       (Custom batch size)
 */

console.error(
  [
    "[spider_daemon] RETIRED: this script no longer crawls or writes events.",
    "  Events may only be written through publishEvent() (src/lib/events/intake/publishEvent.ts).",
    "  Use the spider lifecycle cron instead: GET /api/cron/spider-lifecycle",
    "  (src/lib/discovery/spider-lifecycle.ts).",
  ].join("\n")
);
process.exit(1);
