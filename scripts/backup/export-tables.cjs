// scripts/backup/export-tables.cjs
// Full NDJSON export of tables before the Phase 2 purge. Read-only.
// Usage: node scripts/backup/export-tables.cjs [outDir]
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local"), quiet: true });
const { createPool } = require("@vercel/postgres");

const TABLES = ["events", "sources", "cities", "spider_lookup_needed", "yardsale_city_source_stats"];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = process.argv[2] || path.join("C:/Users/creek/livetimedata-backups", `pre-purge-${stamp}`);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const manifest = { createdAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    const exists = await pool.query(`SELECT to_regclass($1) AS r`, [t]);
    if (!exists.rows[0].r) { console.log(`skip ${t} (missing)`); continue; }
    const file = path.join(outDir, `${t}.ndjson`);
    const out = fs.createWriteStream(file);
    let last = null, n = 0;
    const key = (await pool.query(
      `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisprimary LIMIT 1`, [t])).rows[0]?.attname;
    if (key) {
      for (;;) {
        const { rows } = last === null
          ? await pool.query(`SELECT * FROM ${t} ORDER BY ${key} LIMIT 5000`)
          : await pool.query(`SELECT * FROM ${t} WHERE ${key} > $1 ORDER BY ${key} LIMIT 5000`, [last]);
        if (!rows.length) break;
        for (const r of rows) out.write(JSON.stringify(r) + "\n");
        n += rows.length; last = rows[rows.length - 1][key];
      }
    } else {
      const { rows } = await pool.query(`SELECT * FROM ${t}`);
      for (const r of rows) out.write(JSON.stringify(r) + "\n");
      n = rows.length;
    }
    await new Promise((r) => out.end(r));
    const count = Number((await pool.query(`SELECT COUNT(*) c FROM ${t}`)).rows[0].c);
    manifest.tables[t] = { exported: n, countAtEnd: count, file: path.basename(file) };
    console.log(`${t}: exported ${n} (table count ${count})`);
  }
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nBackup written to ${outDir}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
