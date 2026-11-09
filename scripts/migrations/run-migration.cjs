// scripts/migrations/run-migration.cjs
// Usage: node scripts/migrations/run-migration.cjs scripts/migrations/<file>.sql
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local"), quiet: true });
const { createPool } = require("@vercel/postgres");

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("pass a .sql file");
  const sqlText = fs.readFileSync(file, "utf8");
  const pool = createPool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sqlText);
    await client.query("COMMIT");
    console.log(`OK: applied ${path.basename(file)}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`FAILED (rolled back): ${e.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
