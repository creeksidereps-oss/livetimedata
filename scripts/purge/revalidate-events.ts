// scripts/purge/revalidate-events.ts
//
// Phase 2: re-check EVERY stored event with the same rules as new intake (publishEvent / resolveLocation).
//   keep     -> verified location written to the row (city_slug, coordinates, country, canonical city name)
//   pending  -> verified location but unconfirmed time (TBD policy) -> status pending_review
//   delete   -> no verifiable location, junk title, templated/fake description, online, sale w/o street address
//
// Crawler-sourced rows do NOT trust their stored city/state/country (those were inherited from parent sources,
// e.g. 3,462 foreign events stamped "Raleigh, NC, US"). Their location must come from their own venue address.
//
// Usage:
//   npx tsx scripts/purge/revalidate-events.ts              (DRY RUN - report only, no event changes)
//   npx tsx scripts/purge/revalidate-events.ts --execute    (apply; run the backup first!)
import fs from "fs";
import path from "path";
import { pool } from "../../src/lib/db";
import { resolveLocation } from "../../src/lib/events/location/resolveLocation";
import { titleProblem, descriptionProblem, hasStreetAddress, startTimeProblem, detectKind } from "../../src/lib/events/intake/publishEvent";
import { ccTldCountry } from "../../src/lib/events/location/geoReference";

const EXECUTE = process.argv.includes("--execute");
const OUT_DIR = path.join("C:/Users/creek/livetimedata-backups", `revalidate-${EXECUTE ? "EXECUTE" : "dryrun"}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const HUMAN_SOURCES = /^(internal submission|user submission|quick[- ]post|snap|vision|admin|manual|flyer upload)/i;
// Sale aggregators are allowed by owner rule (yard-sale cron) and are identified by name.
const SALE_AGGREGATORS = /^(gsalr network|yardsalesearch|estatesales\.net|storagetreasures)/i;
const isUrl = (s: any) => { try { const u = new URL(String(s || "")); return /^https?:$/.test(u.protocol) && u.hostname.includes("."); } catch { return false; } };
const ONLINE_RE = /\b(online[- ]only|online event|virtual event|webinar|zoom meeting|livestream(ed)?|live stream|webex|online auction)\b/i;

type Decision = { action: "keep" | "pending" | "delete"; reasons: string[]; loc?: any };

function isHumanRow(r: any): boolean {
  const s = String(r.source || "");
  return HUMAN_SOURCES.test(s) || (!!r.user_email && !/^https?:\/\//i.test(s));
}

async function decide(r: any): Promise<Decision> {
  const title = String(r.title || "").trim();
  const venue = String(r.venue || "").trim();
  const address = String(r.venue_address || "").trim();
  const details = String(r.details || "").trim();
  const kind = r.listing_kind || detectKind(title, r.category);

  const tp = titleProblem(title, venue);
  if (tp && tp !== "title_is_venue") return { action: "delete", reasons: [tp] };
  if (tp === "title_is_venue") return { action: "delete", reasons: [tp] };
  if (ONLINE_RE.test(`${title} ${details} ${venue}`)) return { action: "delete", reasons: ["online_or_virtual"] };
  const dp = descriptionProblem(details, title);
  if (dp === "description_templated") return { action: "delete", reasons: [dp] };
  if (kind === "sale" && !hasStreetAddress(address)) return { action: "delete", reasons: ["sale_without_street_address"] };

  const human = isHumanRow(r);
  const sourceUrl = isUrl(r.source) ? r.source : isUrl(r.official_info_url) ? r.official_info_url : null;

  // Same rule as publishEvent: automated events must come from a real, crawlable page. Rows whose "source" is a
  // made-up label ("Visit Indiana & Official Festival Calendars", "API Ingestion Engine") and no real URL are the
  // bulk AI-generated lists - there is no page to verify them against.
  if (!human && !sourceUrl && !SALE_AGGREGATORS.test(String(r.source || ""))) {
    return { action: "delete", reasons: ["no_verifiable_source_url"] };
  }

  // Legacy pollution pattern: crawler rows whose "address" is just "City, ST" (e.g. 467 foreign events with
  // address "Ocean City, MD") - that city was inherited, not stated by the page. Not trustworthy.
  if (!human && !hasStreetAddress(address) && address.split(",").map((s) => s.trim()).filter(Boolean).length <= 2) {
    return { action: "delete", reasons: ["address_city_only_untrusted"] };
  }
  const loc = await resolveLocation(
    human
      ? { city: r.city_name, region: r.state_name, country: r.country_code, address, sourceUrl }
      : { address, sourceUrl } // crawler rows: stored city/state/country are untrusted (inherited)
  );
  if (!loc.ok) {
    if (loc.reason === "provider_unavailable") return { action: "keep", reasons: ["SKIPPED_geocoder_unavailable"] };
    return { action: "delete", reasons: ["location_" + loc.reason] };
  }
  if (title.toLowerCase() === loc.location.cityName.toLowerCase()) return { action: "delete", reasons: ["title_is_place_name"] };
  // Legacy pollution pattern: a crawler row from a country-code domain (.be, .ca, .fr ...) resolving to a
  // different country almost always carries an inherited address. Reseeding will bring real ones back.
  const tld = ccTldCountry(sourceUrl);
  if (!human && tld && tld !== loc.location.countryCode) return { action: "delete", reasons: ["country_conflicts_source_domain"] };

  const reasons: string[] = [];
  if (startTimeProblem(r.start_time)) reasons.push("start_time_unconfirmed");
  // Same rule as publishEvent: no specific street address -> held for review (never public).
  if (!hasStreetAddress(address)) reasons.push("address_not_specific");
  if (dp && !(kind === "sale" && (dp === "description_missing" || dp === "description_too_short"))) reasons.push(dp);
  return { action: reasons.length ? "pending" : "keep", reasons, loc: loc.location };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const log = fs.createWriteStream(path.join(OUT_DIR, "decisions.ndjson"));
  const counts: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};
  let lastId = 0, n = 0, skipped = 0;
  const t0 = Date.now();

  for (;;) {
    const { rows } = await pool.query(`SELECT * FROM events WHERE id > $1 ORDER BY id LIMIT 500`, [lastId]);
    if (!rows.length) break;
    for (const r of rows) {
      lastId = r.id; n++;
      const d = await decide(r);
      if (d.reasons.includes("SKIPPED_geocoder_unavailable")) { skipped++; continue; }
      counts[d.action] = (counts[d.action] || 0) + 1;
      for (const x of d.reasons) reasonCounts[x] = (reasonCounts[x] || 0) + 1;
      log.write(JSON.stringify({ id: r.id, action: d.action, reasons: d.reasons, title: r.title, was: `${r.city_name}, ${r.state_name || ""} [${r.country_code || ""}]`, now: d.loc ? `${d.loc.cityName}, ${d.loc.admin1 || ""} [${d.loc.countryCode}] /time/${d.loc.citySlug}` : null }) + "\n");

      if (!EXECUTE) continue;
      if (d.action === "delete") {
        await pool.query(`INSERT INTO event_tombstones (id, reason) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [r.id, d.reasons.join(",")]);
        await pool.query(`DELETE FROM events WHERE id = $1`, [r.id]);
      } else {
        const l = d.loc;
        await pool.query(
          `UPDATE events SET city_name=$2, state_name=$3, country_code=$4, country_name=$5, city_slug=$6,
             latitude=$7, longitude=$8, location_verified_at=NOW(), location_method=$9,
             listing_kind=COALESCE(listing_kind,$10),
             status = CASE WHEN $11 THEN 'pending_review' ELSE status END, updated_at=NOW()
           WHERE id=$1`,
          [r.id, l.cityName, l.admin1, l.countryCode, l.countryName, l.citySlug, l.lat, l.lon, "revalidate:" + l.method,
           r.listing_kind || detectKind(r.title, r.category), d.action === "pending"]
        );
      }
    }
    if (n % 2000 < 500) console.log(`${n} checked  ${JSON.stringify(counts)}  skipped=${skipped}  ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  await new Promise((r) => log.end(r));
  const summary = { mode: EXECUTE ? "EXECUTE" : "DRY RUN", checked: n, skippedGeocoderUnavailable: skipped, counts, reasonCounts, seconds: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${OUT_DIR}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
