// scripts/tests/resolve-location.test.ts   run: npx tsx scripts/tests/resolve-location.test.ts
import { resolveLocation, type LocationHints } from "../../src/lib/events/location/resolveLocation";
import { titleProblem, descriptionProblem, hasStreetAddress, startTimeProblem, detectKind } from "../../src/lib/events/intake/publishEvent";
import { pool } from "../../src/lib/db";

type Expect = { ok: true; cc: string; name?: RegExp; admin1?: RegExp } | { ok: false; reason: string };
const cases: [string, LocationHints, Expect][] = [
  ["Stockholm + .se source", { city: "Stockholm", sourceUrl: "https://borsen.se/event/1" }, { ok: true, cc: "SE" }],
  ["Stockholm, no hints", { city: "Stockholm" }, { ok: false, reason: "ambiguous" }],
  ["Praha, CZ (native name)", { city: "Praha", country: "CZ" }, { ok: true, cc: "CZ", name: /prag/i }],
  ["Bruxelles + .be", { city: "Bruxelles", sourceUrl: "https://whall.be/x" }, { ok: true, cc: "BE" }],
  ["Ludwigsburg, Germany (4 in DE -> must not guess)", { city: "Ludwigsburg", country: "Germany" }, { ok: false, reason: "ambiguous" }],
  ["Ludwigsburg, Baden-Württemberg", { city: "Ludwigsburg", region: "Baden-Württemberg", country: "DE" }, { ok: true, cc: "DE" }],
  ["Haines, AK", { city: "Haines", region: "AK" }, { ok: true, cc: "US", admin1: /alaska/i }],
  ["Greenwich, UK (3 in England -> must not guess)", { city: "Greenwich", country: "United Kingdom" }, { ok: false, reason: "ambiguous" }],
  ["Greenwich, London address", { address: "King William Walk 1, Greenwich, London SE10 9NN, United Kingdom" }, { ok: true, cc: "GB" }],
  ["Greenwich, CT", { city: "Greenwich", region: "CT" }, { ok: true, cc: "US", admin1: /connecticut/i }],
  ["Springfield (ambiguous)", { city: "Springfield" }, { ok: false, reason: "ambiguous" }],
  ["Perth, WA -> Australia", { city: "Perth", region: "WA" }, { ok: true, cc: "AU" }],
  ["Seattle, WA -> USA", { city: "Seattle", region: "WA" }, { ok: true, cc: "US" }],
  ["Toronto, ON -> Canada", { city: "Toronto", region: "ON" }, { ok: true, cc: "CA" }],
  ["Empty location", { city: "" }, { ok: false, reason: "no_location_info" }],
  ["'Local' placeholder", { city: "Local" }, { ok: false, reason: "no_location_info" }],
  ["Swedish address only", { address: "Drottninggatan 12, 111 51 Stockholm, Sweden" }, { ok: true, cc: "SE" }],
  ["US address only", { address: "123 Fayetteville St, Raleigh, NC 27601" }, { ok: true, cc: "US", admin1: /north carolina/i }],
  ["Paris + .fr", { city: "Paris", sourceUrl: "https://www.accorarena.com.fr/" }, { ok: true, cc: "FR" }],
  ["Haz-Zebbug, Malta", { city: "Haz-Zebbug", country: "Malta" }, { ok: true, cc: "MT" }],
  // Regressions from the Phase 2 dry run (full region names were mistaken for city names -> "Calvary, Georgia")
  ["Stadium, Charlotte, North Carolina", { address: "Bank of America Stadium, Charlotte, North Carolina" }, { ok: true, cc: "US", name: /charlotte/i, admin1: /north carolina/i }],
  ["Street, Statesville, North Carolina", { address: "108 N Center St, Statesville, North Carolina" }, { ok: true, cc: "US", name: /statesville/i }],
  ["Statesville, NC 28677", { address: "299 Old Mountain Road, Statesville, NC 28677" }, { ok: true, cc: "US", name: /statesville/i }],
  ["Region name alone is not a city", { address: "North Carolina" }, { ok: false, reason: "no_location_info" }],
  ["Saipan, MP (2-letter ISO code is a country, not a city)", { address: "Paseo de Marianas, Garapan, Saipan, MP" }, { ok: true, cc: "MP" }],
  ["Rincón, PR -> never Costa Rica (2 Rincóns in PR -> must not guess)", { city: "Rincón", region: "PR" }, { ok: false, reason: "ambiguous" }],
];

const rules: [string, unknown, unknown][] = [
  ["title id_123", titleProblem("id_6778958 at Chapel Krypta"), "title_is_id"],
  ["title time", titleProblem("15:00"), "title_is_time_or_date"],
  ["title ok", titleProblem("Def Leppard at Movistar Arena"), null],
  ["desc template", descriptionProblem("Hardcore Superstar live in concert at Börsen in Stockholm, .", "x"), "description_templated"],
  ["desc ok", descriptionProblem("Celebrated Alaskan event showcasing frontier heritage and wildlife viewing.", "x"), null],
  ["addr US", hasStreetAddress("123 Main St, Haines, AK"), true],
  ["addr SE", hasStreetAddress("Drottninggatan 12, Stockholm"), true],
  ["addr FR", hasStreetAddress("12 rue de Rivoli, Paris"), true],
  ["addr vague", hasStreetAddress("Downtown Raleigh"), false],
  ["addr venue-only", hasStreetAddress("Börsen"), false],
  ["time TBD", startTimeProblem("TBD"), "start_time_unconfirmed"],
  ["time ok", startTimeProblem("7:00 PM"), null],
  ["kind sale", detectKind("Huge Multi-Family Yard Sale"), "sale"],
  ["kind event", detectKind("Def Leppard at Movistar Arena"), "event"],
];

(async () => {
  let pass = 0, fail = 0;
  for (const [label, got, want] of rules) {
    const ok = got === want;
    ok ? pass++ : fail++;
    console.log(`${ok ? "PASS" : "FAIL"}  rule: ${label}  -> ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
  }
  for (const [label, hints, want] of cases) {
    const r = await resolveLocation(hints);
    let ok = false, info = "";
    if (r.ok) {
      const l = r.location;
      info = `${l.cityName}, ${l.admin1}, ${l.countryCode} -> /time/${l.citySlug} [${l.method}/${l.provider}]`;
      ok = want.ok && l.countryCode === want.cc && (!want.name || want.name.test(l.cityName)) && (!want.admin1 || want.admin1.test(l.admin1 || ""));
    } else {
      info = `${r.reason}: ${r.detail}`;
      ok = !want.ok && r.reason === want.reason;
    }
    ok ? pass++ : fail++;
    console.log(`${ok ? "PASS" : "FAIL"}  loc: ${label}  -> ${info}`);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
})();
