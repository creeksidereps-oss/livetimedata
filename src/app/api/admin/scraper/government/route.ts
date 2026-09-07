import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ALL_ADAPTERS } from "./adapters";
import { GovCamera } from "./adapters/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    console.log("[GOV SCRAPER] Starting modular government webcam synchronization...");
    
    let allCameras: GovCamera[] = [];

    // 1. Run all adapters
    for (const adapter of ALL_ADAPTERS) {
      console.log(`[GOV SCRAPER] Running adapter: ${adapter.name}...`);
      const cams = await adapter.fetchCameras();
      allCameras = allCameras.concat(cams);
      console.log(`[GOV SCRAPER] Adapter ${adapter.id} returned ${cams.length} cameras.`);
    }

    console.log(`[GOV SCRAPER] Total cameras fetched across all states: ${allCameras.length}`);
    let camsScraped = 0;

    // 2. Fast Bulk Ingestion (Skip YouTube search to prevent Vercel 10s Timeouts)
    // We process in chunks of 50 to maximize speed without overloading the DB connection pool.
    const chunkSize = 50;
    for (let i = 0; i < allCameras.length; i += chunkSize) {
      const chunk = allCameras.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (cam) => {
        try {
          const existing = await sql`SELECT id FROM webcams WHERE title = ${cam.title} LIMIT 1`;
          if (existing.rows.length === 0) {
            await sql`
              INSERT INTO webcams (
                city_name, state_name, kind, title, source, status, embed_url, image_url, view_count
              ) VALUES (
                ${cam.cityName}, ${cam.stateName}, 'traffic', ${cam.title}, ${cam.source}, 'live', ${cam.embedUrl}, ${cam.imageUrl}, ${Math.floor(Math.random() * 200)}
              )
            `;
            camsScraped++;
          }
        } catch (dbErr) {
          console.error(`[GOV SCRAPER] Error inserting ${cam.title}:`, dbErr);
        }
      }));
    }

    return NextResponse.json({ 
      ok: true, 
      added: camsScraped, 
      total: allCameras.length,
      message: `Successfully loaded ${allCameras.length} cameras from source. Inserted ${camsScraped} new cameras into database.` 
    });
  } catch (error: any) {
    console.error("[GOV SCRAPER ERROR]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
