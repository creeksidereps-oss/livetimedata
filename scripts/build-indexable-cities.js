// scripts/build-indexable-cities.js
// Builds src/data/indexableCities.json: the curated set of city pages that are
// submitted to Google (sitemap + index,follow). All other city pages stay live
// but are served with noindex until they gain real content.
//
// Qualifying signals (any one):
//   - current/upcoming event (event_date >= today, not rejected/pending)
//   - a webcam
//   - an approved fun fact
//   - a written city report
// Each candidate slug is verified against production: must return 200 and its
// canonical must point to itself.
//
// Usage: node scripts/build-indexable-cities.js [--no-verify]
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sql } = require("@vercel/postgres");

const BASE = "https://www.livetimedata.com";
const VERIFY = !process.argv.includes("--no-verify");

const US = { AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",PR:"Puerto Rico" };
const US_REV = Object.fromEntries(Object.entries(US).map(([k, v]) => [v.toLowerCase(), k]));

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
function region(admin) {
  const a = String(admin || "").trim();
  if (!a) return "";
  if (US[a.toUpperCase()]) return a.toUpperCase();
  if (US_REV[a.toLowerCase()]) return US_REV[a.toLowerCase()];
  return norm(a);
}
const key = (name, admin) => `${norm(name)}|${region(admin)}`;
function isJunk(name) {
  const t = String(name || "").trim();
  if (t.length < 2) return true;
  if (/\d|@|:|\//.test(t)) return true; // road cams: "I-80 WB MM 19", "US95 @ Clover Dr"
  if (/\b(rest area|nationwide|statewide|various|online|virtual|tba|tbd|unknown|area)\b/i.test(t)) return true;
  if (t === t.toUpperCase() && t.length > 3) return true; // "ALABAMA", "US50 EUREKA"
  return false;
}

async function main() {
  const [cities, ev, cams, facts, reps] = await Promise.all([
    sql.query(`SELECT slug, name, admin1, country_name, country_code, latitude, longitude, timezone FROM cities
               WHERE name IS NOT NULL AND slug IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
                 AND NOT (latitude = 0 AND longitude = 0)`),
    sql.query(`SELECT city_name, state_name, COUNT(*)::int n FROM events
               WHERE event_date >= CURRENT_DATE AND city_name IS NOT NULL
                 AND COALESCE(status,'') NOT IN ('rejected','pending_review','archived','deleted')
               GROUP BY 1,2`),
    sql.query(`SELECT city_name, state_name, COUNT(*)::int n FROM webcams WHERE city_name IS NOT NULL GROUP BY 1,2`),
    sql.query(`SELECT city_name, state_name, COUNT(*)::int n FROM city_fun_facts WHERE is_approved = TRUE GROUP BY 1,2`),
    sql.query(`SELECT city_name, state_name, COUNT(*)::int n FROM city_reports WHERE content IS NOT NULL AND LENGTH(content) > 150 GROUP BY 1,2`),
  ]);

  // signals keyed by name|region, plus name-only fallback for rows with no region
  const sig = new Map();
  const add = (rows, field) => {
    for (const r of rows) {
      if (isJunk(r.city_name)) continue;
      const k = key(r.city_name, r.state_name);
      const s = sig.get(k) || { events: 0, webcams: 0, facts: 0, reports: 0 };
      s[field] += r.n;
      sig.set(k, s);
    }
  };
  add(ev.rows, "events"); add(cams.rows, "webcams"); add(facts.rows, "facts"); add(reps.rows, "reports");

  // Region -> set of keys per city name, used to recover signals whose state is
  // wrong/missing (e.g. international events stored with state "NC").
  const regionsByName = new Map();
  for (const c of cities.rows) {
    if (isJunk(c.name)) continue;
    const n = norm(c.name);
    if (!regionsByName.has(n)) regionsByName.set(n, new Set());
    regionsByName.get(n).add(key(c.name, c.admin1));
  }
  for (const [k, s] of [...sig.entries()]) {
    const n = k.split("|")[0];
    const regs = regionsByName.get(n);
    if (!regs || regs.has(k)) continue;
    if (regs.size === 1) {
      // name is unambiguous in our cities table: attribute signal to it
      const target = [...regs][0];
      const t = sig.get(target) || { events: 0, webcams: 0, facts: 0, reports: 0 };
      for (const f of Object.keys(s)) t[f] += s[f];
      sig.set(target, t);
    }
  }

  // pick one city row per key (prefer shortest slug; verification adopts the live canonical)
  const byKey = new Map();
  for (const c of cities.rows) {
    if (isJunk(c.name)) continue;
    const k = key(c.name, c.admin1);
    const s = sig.get(k);
    if (!s) continue;
    const prev = byKey.get(k);
    if (!prev || c.slug.length < prev.row.slug.length) byKey.set(k, { row: c, s });
  }
  let list = [...byKey.values()].map(({ row, s }) => ({
    slug: row.slug.toLowerCase(),
    name: row.name,
    admin1: row.admin1 || "",
    country: row.country_name || (row.country_code === "US" ? "United States" : ""),
    country_code: row.country_code || "",
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    ...s,
  }));
  console.log(`candidates from cities table: ${list.length}`);

  // Signal cities with no row in `cities`: generate a slug and let production
  // resolve it (geocoding). Verified below by requiring the region in the title.
  const slugify = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const covered = new Set(byKey.keys());
  const rawByKey = new Map();
  for (const rows of [ev.rows, cams.rows, facts.rows, reps.rows]) for (const r of rows) {
    if (isJunk(r.city_name)) continue;
    const k = key(r.city_name, r.state_name);
    if (!rawByKey.has(k)) rawByKey.set(k, r);
  }
  for (const [k, s] of sig.entries()) {
    if (covered.has(k)) continue;
    const n = k.split("|")[0];
    if (regionsByName.get(n)?.size === 1) continue; // already merged into a known city
    const r = rawByKey.get(k);
    if (!r || !r.state_name) continue;
    const reg = region(r.state_name);
    const regFull = US[reg] || String(r.state_name).trim();
    list.push({
      slug: `${slugify(r.city_name)}-${slugify(regFull)}`,
      name: r.city_name.trim(), admin1: regFull, country: US[reg] ? "United States" : "", country_code: US[reg] ? "US" : "",
      lat: 0, lon: 0, generated: true, ...s,
    });
  }
  console.log(`candidates total: ${list.length}`);

  if (VERIFY) {
    const ok = [];
    const stats = { err: 0 };
    let i = 0;
    const worker = async () => {
      while (i < list.length) {
        const c = list[i++];
        try {
          let res;
          for (let attempt = 0; attempt < 4; attempt++) {
            res = await fetch(`${BASE}/time/${c.slug}`, { redirect: "manual", signal: AbortSignal.timeout(30000) }).catch(() => null);
            if (res && (res.status === 200 || res.status === 404)) break;
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
          if (!res) { stats.err++; continue; }
          stats[res.status] = (stats[res.status] || 0) + 1;
          if (res.status !== 200) continue;
          const html = await res.text();
          const m = html.match(/rel="canonical" href="([^"]+)"/);
          const canon = m ? m[1] : "";
          if (c.generated) {
            const title = (html.match(/<title>([^<]*)/) || [])[1] || "";
            if (!title.toLowerCase().includes(c.admin1.toLowerCase())) continue;
          }
          if (canon === `${BASE}/time/${c.slug}`) ok.push(c);
          else if (canon.startsWith(`${BASE}/time/`)) {
            // page resolves under a different canonical slug; adopt it if unique
            ok.push({ ...c, slug: canon.slice(`${BASE}/time/`.length) });
          }
        } catch {}
        if (i % 250 === 0) process.stdout.write(`  verified ${i}/${list.length}\r`);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    console.log("\nstatus counts:", JSON.stringify(stats));
    const seen = new Set();
    list = ok.filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)));
    console.log(`\nverified: ${list.length}`);
  }

  list.sort((a, b) => (a.country || "").localeCompare(b.country || "") || a.admin1.localeCompare(b.admin1) || a.name.localeCompare(b.name));
  const out = path.join(__dirname, "..", "src", "data", "indexableCities.json");
  fs.writeFileSync(out, JSON.stringify(list.map(({ slug, name, admin1, country, country_code }) => ({ slug, name, admin1, country, country_code })), null, 0).replace(/},{/g, "},\n{"));
  const csv = ["slug,city,state_region,country,upcoming_events,webcams,facts,reports",
    ...list.map((c) => [c.slug, c.name, c.admin1, c.country, c.events, c.webcams, c.facts, c.reports].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  fs.writeFileSync(path.join(__dirname, "..", "src", "data", "indexableCities.csv"), csv);
  console.log(`wrote ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
