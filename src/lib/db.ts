import { createPool } from '@vercel/postgres';
import * as dotenv from 'dotenv';

if (!process.env.POSTGRES_URL) {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
}

// Create the connection pool
export const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

// Prevent unhandled error events from crashing long-running daemons when Neon idle connections close
pool.on('error', (err: any) => {
  console.warn('[DB POOL] Recoverable idle client error:', err?.message || err);
});

/**
 * Export a template literal function matching exactly what your existing pages
 * like `src/app/page.tsx` and your flag API require to execute queries.
 */
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  // Convert template literal tags cleanly into standard text queries for the pool execution layer
  let queryText = strings[0];
  for (let i = 1; i < strings.length; i++) {
    queryText += `$${i}` + strings[i];
  }
  return pool.query(queryText, values);
};