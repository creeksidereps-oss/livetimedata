// scripts/guards/protected-zone.cjs
// Fails (exit 1) if any part of the City Search system differs from the pre-rewrite checkpoint.
// Usage: node scripts/guards/protected-zone.cjs
const { execSync } = require("child_process");
const fs = require("fs");

const BASE = "checkpoint/pre-rewrite-live-2026-11-08";
const WHOLE_FILES = [
  "src/app/api/search/route.ts",
  "src/components/CitySearch.tsx",
  "src/components/ModalCitySearch.tsx",
  "src/components/HomeSearch.tsx",
  "src/app/api/cities/search/route.ts",
  "src/app/api/geocode/route.ts",
  "src/app/api/geocode/reverse/route.ts",
];
// Search-landing branch: from file start up to (not including) this marker must be byte-identical.
const LANDING = [
  { file: "src/app/time/[slug]/page.tsx", marker: "// 2. In-memory fast cache lookup" },
  { file: "src/app/weather/[slug]/page.tsx", marker: "// 2. In-memory fast cache lookup" },
];

const norm = (s) => s.replace(/\r\n/g, "\n");
const atBase = (f) => norm(execSync(`git show "${BASE}:${f}"`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const now = (f) => norm(fs.readFileSync(f, "utf8"));

let bad = 0;
for (const f of WHOLE_FILES) {
  const ok = atBase(f) === now(f);
  console.log(`${ok ? "OK  " : "FAIL"} ${f}`);
  if (!ok) bad++;
}
for (const { file, marker } of LANDING) {
  const b = atBase(file), n = now(file);
  const bi = b.indexOf(marker), ni = n.indexOf(marker);
  const ok = bi > 0 && ni > 0 && b.slice(0, bi) === n.slice(0, ni);
  console.log(`${ok ? "OK  " : "FAIL"} ${file} (search landing branch, before "${marker}")`);
  if (!ok) bad++;
}
console.log(bad ? `\nPROTECTED ZONE VIOLATED (${bad})` : "\nProtected zone intact.");
process.exit(bad ? 1 : 0);
