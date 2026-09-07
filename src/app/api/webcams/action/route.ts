import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Clean, absolute matching using the unique city slug from the URL
  const slug = searchParams.get("slug") || "statesville";
  const kind = searchParams.get("kind");
  const slot = Number(searchParams.get("slot") || 0);

  try {
    // 1. Find the exact matching city name using its unique text slug identifier
    const cityQuery = await sql`
      SELECT name FROM cities 
      WHERE slug = ${slug} 
      LIMIT 1;
    `;

    // Fallback to stylized name if the query is strictly empty
    let currentCityName = "Statesville";
    if (cityQuery.rows && cityQuery.rows.length > 0) {
      currentCityName = cityQuery.rows[0].name;
    }

    // 2. Pull the specific webcam matching this explicit city and slot placement
    const cameraQuery = await sql`
      SELECT id, embed_url FROM webcams 
      WHERE city_name = ${currentCityName} 
        AND kind = ${kind} 
        AND display_order = ${slot} 
        AND is_operational = true 
      LIMIT 1;
    `;

    if (cameraQuery.rows && cameraQuery.rows.length > 0) {
      return NextResponse.json({
        ok: true,
        embedUrl: cameraQuery.rows[0].embed_url,
        dbId: cameraQuery.rows[0].id
      });
    }

    return NextResponse.json({ ok: true, embedUrl: null });
  } catch (err) {
    console.error("Backend execution crash details:", err);
    return NextResponse.json({ ok: false, error: "Internal scanning error" }, { status: 500 });
  }
}