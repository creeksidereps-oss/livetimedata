import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { cityName, stateName } = await req.json();

    // The Concentric Circle Fetching Logic for Photos
    
    // Priority 1: Exact City Match
    const { rows: local } = await sql`
      SELECT * FROM photos 
      WHERE city_name ILIKE ${cityName} 
      AND (${stateName} = '' OR state_name ILIKE ${stateName} OR state_name = '') 
      AND status = 'approved' 
      ORDER BY display_order ASC, view_count DESC LIMIT 300
    `;

    // Combine them to maintain the legacy return signature for now
    let results = [...local];

    // Lazy Loading Scraper: If we have no photos, automatically trigger the Wikipedia scraper, wait, and refetch!
    if (results.length === 0) {
      const scraperUrl = new URL('/api/admin/scraper/photos', req.url);
      try {
        const scrapeRes = await fetch(scraperUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityName, stateName })
        });
        
        if (scrapeRes.ok) {
          // Refetch from DB!
          const { rows: newlyScraped } = await sql`
            SELECT * FROM photos 
            WHERE city_name ILIKE ${cityName} 
            AND (${stateName} = '' OR state_name ILIKE ${stateName} OR state_name = '') 
            AND status = 'approved' 
            ORDER BY display_order ASC, view_count DESC LIMIT 300
          `;
          results = [...newlyScraped];
        }
      } catch (err) {
        console.error("Auto-scrape failed during fetch:", err);
      }
    }

    return NextResponse.json({ ok: true, photos: results });
  } catch (error: any) {
    console.error("Photo Fetch Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
