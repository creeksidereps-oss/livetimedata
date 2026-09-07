import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { cityName, stateName } = await req.json();

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "Missing cityName parameter" }, { status: 400 });
    }

    // 1. Cooldown / Check if we already have photos for this city
    const existing = await sql`
      SELECT COUNT(*) as count FROM photos 
      WHERE city_name ILIKE ${cityName} AND source = 'Wikimedia Commons'
    `;
    
    if (existing.rows[0].count > 0) {
      return NextResponse.json({ ok: true, skipped: true, message: "City already seeded with Wikipedia photos." });
    }

    console.log(`[PHOTO SCRAPER] Fetching Wikipedia images for ${cityName}, ${stateName}...`);

    // 2. Query Wikipedia for images used on the city's main article
    const articleTitle = stateName ? `${cityName}, ${stateName}` : cityName;
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&generator=images&gimlimit=50&prop=imageinfo&iiprop=url&format=json&redirects=1`;

    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "LiveTimeData-PhotoBot/1.0" }
    });
    
    if (!res.ok) {
      throw new Error(`Wikipedia API responded with ${res.status}`);
    }

    const data = await res.json();
    const pages = data.query?.pages;

    if (!pages) {
      return NextResponse.json({ ok: true, skipped: true, message: "No Wikipedia page or images found for this city." });
    }

    // 3. Filter and parse the images
    const validImages = [];
    
    for (const pageId in pages) {
      const imgInfo = pages[pageId].imageinfo?.[0];
      const title = pages[pageId].title;

      if (!imgInfo || !imgInfo.url) continue;
      
      const url = imgInfo.url.toLowerCase();
      const titleLower = title.toLowerCase();
      
      const baseUrl = url.split('?')[0];

      // Strict photo filter: ONLY allow common photo formats. 
      // This automatically eliminates 99% of UI icons, SVGs, and transparent UI assets.
      if (!baseUrl.endsWith('.jpg') && !baseUrl.endsWith('.jpeg') && !baseUrl.endsWith('.webp') && !baseUrl.endsWith('.avif')) {
        continue;
      }
      
      if (
        titleLower.includes('map') || titleLower.includes('flag') ||
        titleLower.includes('seal') || titleLower.includes('logo') ||
        titleLower.includes('signature') || titleLower.includes('weatherbox') ||
        titleLower.includes('pushpin') || titleLower.includes('location') ||
        titleLower.includes('collage') || titleLower.includes('montage')
      ) {
        continue;
      }

      // Clean up the title to look nice
      const cleanTitle = title.replace('File:', '').replace(/\.[a-zA-Z]+$/, '').replace(/_/g, ' ').substring(0, 50);

      validImages.push({
        url: imgInfo.url, // Original capitalization for the URL
        title: cleanTitle
      });
    }

    // 4. Save to Database
    let inserted = 0;
    for (let i = 0; i < Math.min(validImages.length, 12); i++) {
      const img = validImages[i];
      // Distribute across the 12 boxes
      const displayOrder = i + 1; 

      await sql`
        INSERT INTO photos (
          city_name, state_name, title, image_url, source, status, display_order
        ) VALUES (
          ${cityName}, 
          ${stateName || ''}, 
          ${img.title}, 
          ${img.url}, 
          'Wikimedia Commons', 
          'approved',
          ${displayOrder}
        )
      `;
      inserted++;
    }

    console.log(`[PHOTO SCRAPER] Successfully seeded ${inserted} Wikipedia photos for ${cityName}`);

    return NextResponse.json({ ok: true, seeded: inserted });

  } catch (error: any) {
    console.error("[PHOTO SCRAPER ERROR]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
