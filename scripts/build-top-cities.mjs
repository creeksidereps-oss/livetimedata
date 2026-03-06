// scripts/build-top-cities.mjs
// Generates src/data/topCities.json from GeoNames cities15000.txt
// Output: top 10,000 cities by population with slug, name, admin1, country, lat, lon

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "scripts", "cities15000.txt");
const OUT_DIR = path.join(ROOT, "src", "data");
const OUT = path.join(OUT_DIR, "topCities.json");

// GeoNames fields (tab-separated):
// geonameid, name, asciiname, alternatenames, latitude, longitude, feature class, feature code,
// country code, cc2, admin1 code, admin2, admin3, admin4, population, elevation, dem, timezone, modification date

function slugify(parts) {
  const s = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "city";
}

// Minimal country + admin1 mappings (good enough for slugs + labels)
// If we don't know admin1 name, we’ll omit it (still works).
// You can expand these later if you want perfect admin1 names everywhere.
const COUNTRY_NAME = new Intl.DisplayNames(["en"], { type: "region" });

function countryToName(code) {
  try {
    return COUNTRY_NAME.of(code) || code;
  } catch {
    return code;
  }
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input file: ${INPUT}`);
    console.error(`Download cities15000.txt and place it at: scripts/cities15000.txt`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const cities = [];
  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 19) continue;

    const name = cols[1];
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    const countryCode = cols[8];
    const admin1Code = cols[10];
    const population = Number(cols[14]) || 0;

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || !countryCode) continue;

    const country = countryToName(countryCode);
    const admin1 = admin1Code ? admin1Code : "";

    const slug = slugify([name, admin1, country]);

    cities.push({
      slug,
      name,
      admin1: admin1 || undefined,
      country,
      lat,
      lon,
      population,
    });
  }

  // Sort by population desc
  cities.sort((a, b) => (b.population || 0) - (a.population || 0));

  // Deduplicate by slug (keep highest population)
  const seen = new Set();
  const top = [];
  for (const c of cities) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    top.push({
      slug: c.slug,
      name: c.name,
      admin1: c.admin1,
      country: c.country,
      lat: c.lat,
      lon: c.lon,
    });
    if (top.length >= 10000) break;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(top, null, 2), "utf8");

  console.log(`✅ Wrote ${top.length} cities to ${OUT}`);
}

main();