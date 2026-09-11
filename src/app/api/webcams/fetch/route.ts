import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { cityName, stateName, countryName } = await req.json();

    // The Concentric Circle Fetching Logic
    
    // Priority 1: Exact City Matches FIRST, then State/Region Matches for Row 1
    let regional: any[] = [];
    if (cityName) {
      // First, get exact city matches. Ensure we don't grab identical city names from other states/countries!
      if (countryName && stateName) {
        const { rows: strictRows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} 
          AND (
            state_name ILIKE ${stateName} 
            OR country ILIKE ${countryName}
            OR state_name ILIKE ${countryName}
            OR state_name IS NULL OR state_name = ''
          )
          AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC LIMIT 12
        `;
        regional = strictRows;
      } else if (stateName) {
        const { rows: strictRows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} 
          AND (state_name ILIKE ${stateName} OR state_name IS NULL OR state_name = '')
          AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC LIMIT 12
        `;
        regional = strictRows;
      } else {
        const { rows: cityRows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC LIMIT 12
        `;
        regional = cityRows;
      }

      // Safe fallback if strict combination produced 0 results
      if (regional.length === 0) {
        const { rows: fallbackCity } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC LIMIT 12
        `;
        regional = fallbackCity;
      }
    }
    
    // Then fill the remaining with state matches if needed
    if (stateName && regional.length < 24) {
      const needed = 24 - regional.length;
      const { rows: stateRows } = await sql`
        SELECT * FROM webcams 
        WHERE (state_name ILIKE ${stateName} OR state_name ILIKE ${countryName || ''})
        AND state_name IS NOT NULL AND state_name != ''
        AND city_name NOT ILIKE ${cityName}
        AND status IN ('live', 'approved')
        ORDER BY display_order DESC, view_count DESC LIMIT ${needed}
      `;
      regional = [...regional, ...stateRows];
    }

    // Priority 2: Country Matches for Row 2
    let countryData: any[] = [];
    if (countryName) {
      const { rows } = await sql`
        SELECT * FROM webcams 
        WHERE (country ILIKE ${countryName} AND country IS NOT NULL AND country != '')
        AND status IN ('live', 'approved')
        ORDER BY display_order DESC, view_count DESC LIMIT 24
      `;
      countryData = rows;
    }

    // Build Row 1 (State/Region Grid) - 12 Items Max
    let row1 = [...regional].slice(0, 12);

    // Fallback for Row 2: Popular Themed Collections if country doesn't have enough
    if (countryData.length < 12) {
      const needed = 12 - countryData.length;
      const { rows: themedCams } = await sql`
        SELECT * FROM webcams 
        WHERE status IN ('live', 'approved') AND kind IN ('beach', 'wildlife', 'airport-cam', 'traffic')
        ORDER BY view_count DESC LIMIT 50
      `;
      const additional = themedCams.filter((r: any) => !countryData.some(g => g.id === r.id)).slice(0, needed);
      countryData = [...countryData, ...additional];
    }

    // Build Row 2 (Country/Themed Grid) - 12 Items Max
    // Filter out items already in Row 1
    let row2 = countryData.filter(r => !row1.some(l => l.id === r.id)).slice(0, 12);
    
    let local = row1;
    regional = row2;

    // Priority 3: Global Most Popular (The 3rd Row)
    const excludedIds = new Set([...local.map((r: any) => r.id), ...(regional.map((r: any) => r.id))]);

    let global: any[] = [];
    
    // First: Try to get manually curated 'global-curated' cams specific to this country
    if (countryName) {
      const { rows: countryCurated } = await sql`
        SELECT * FROM webcams 
        WHERE status = 'live' AND kind = 'global-curated' AND country ILIKE ${'%' + countryName + '%'}
        ORDER BY id DESC LIMIT 24
      `;
      global = countryCurated.filter((r: any) => !excludedIds.has(r.id)).slice(0, 12);
    }
    
    // Fallback 1: Try to get manually curated 'global-curated' cams from anywhere
    if (global.length < 12) {
      const { rows: generalCurated } = await sql`
        SELECT * FROM webcams 
        WHERE status = 'live' AND kind = 'global-curated'
        ORDER BY id DESC LIMIT 36
      `;
      const needed = 12 - global.length;
      const additional = generalCurated
        .filter((r: any) => !excludedIds.has(r.id) && !global.some(g => g.id === r.id))
        .slice(0, needed);
      global = [...global, ...additional];
    }

    // Fallback 2: Fill the rest with the most popular global cams
    if (global.length < 12) {
      const needed = 12 - global.length;
      const { rows: popularGlobal } = await sql`
        SELECT * FROM webcams 
        WHERE status = 'live'
        ORDER BY view_count DESC LIMIT 50
      `;
      const additional = popularGlobal
        .filter((r: any) => !excludedIds.has(r.id) && !global.some(g => g.id === r.id))
        .slice(0, needed);
      global = [...global, ...additional];
    }

    // Premium 360 Tour for this specific city
    const { rows: tourRows } = await sql`
      SELECT * FROM webcams 
      WHERE city_name ILIKE ${cityName} AND kind = '360_tour' AND status = 'live'
      ORDER BY id DESC LIMIT 1
    `;
    const featuredTour = tourRows.length > 0 ? tourRows[0] : null;

    // Right Rail Cams (wildlife-cam, weather-cam, etc.)
    // We fetch all live webcams for the city, so RightRail.tsx can perform exact matches first,
    // and then use the remaining ones as fallbacks for empty slots.
    let rightRailCams: any[] = [];
    if (cityName) {
      if (countryName && stateName) {
        const { rows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} 
          AND (
            state_name ILIKE ${stateName} 
            OR country ILIKE ${countryName}
            OR state_name ILIKE ${countryName}
            OR state_name IS NULL OR state_name = ''
          )
          AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = rows;
      } else if (stateName) {
        const { rows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} 
          AND (state_name ILIKE ${stateName} OR state_name IS NULL OR state_name = '')
          AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = rows;
      } else {
        const { rows } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = rows;
      }

      // Safe fallback: if city has webcams in database, never let state mismatch hide them!
      if (rightRailCams.length === 0) {
        const { rows: exactCity } = await sql`
          SELECT * FROM webcams 
          WHERE city_name ILIKE ${cityName} AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = exactCity;
      }
    }

    // Smart Lazy Loading Scraper:
    // If the city has fewer than 5 webcams, check when it was last scraped.
    // If never scraped OR last scrape was >= 7 days ago, trigger the live scraper automatically!
    if (rightRailCams.length < 5 && cityName) {
      try {
        const { rows: scrapeCheck } = await sql`
          SELECT MAX(created_at) as last_scraped 
          FROM webcams 
          WHERE city_name ILIKE ${cityName}
        `;
        const lastScraped = scrapeCheck[0]?.last_scraped;
        let shouldScrape = false;

        if (!lastScraped) {
          shouldScrape = true;
        } else {
          const daysSinceScrape = (Date.now() - new Date(lastScraped).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceScrape >= 7) {
            shouldScrape = true;
          }
        }

        if (shouldScrape) {
          const scraperUrl = new URL('/api/admin/scraper/webcams', req.url);
          const scrapeRes = await fetch(scraperUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cityName, stateName })
          });
          if (scrapeRes.ok) {
            const { rows: newlyScraped } = await sql`
              SELECT * FROM webcams 
              WHERE city_name ILIKE ${cityName} AND status IN ('live', 'approved')
              ORDER BY display_order DESC, view_count DESC
            `;
            if (newlyScraped.length > 0) {
              rightRailCams = newlyScraped;
              if (local.length === 0) local = newlyScraped.slice(0, 12);
            }
          }
        }
      } catch (err) {
        console.error("Auto-scrape failed during webcam fetch:", err);
      }
    }

    // If city STILL has no webcams, fallback to state/region or country to prevent empty boxes (SEO requirement)
    if (rightRailCams.length === 0 && (stateName || countryName)) {
      if (stateName) {
        const { rows: stateFallbacks } = await sql`
          SELECT * FROM webcams 
          WHERE (state_name ILIKE ${stateName} OR state_name ILIKE ${countryName || ''}) AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = stateFallbacks;
      }
      if (rightRailCams.length === 0 && countryName) {
        const { rows: countryFallbacks } = await sql`
          SELECT * FROM webcams 
          WHERE country ILIKE ${countryName} AND status IN ('live', 'approved')
          ORDER BY display_order DESC, view_count DESC
        `;
        rightRailCams = countryFallbacks;
      }
    }

    // Filter out useless "current time" livestreams and deduplicate webcams
    const filterAndDedupeCams = (cams: any[]) => {
      const seenStreams = new Set<string>();
      const seenTitles = new Set<string>();
      const result: any[] = [];

      for (const c of cams) {
        if (!c) continue;
        const t = (c.title || "").toLowerCase().trim();
        if (t.includes("what time is it") || t.includes("current time in") || t.includes("current time")) {
          continue;
        }

        // Extract clean key from YouTube embed or image URL
        let streamKey = "";
        const embed = c.embed_url || "";
        const ytMatch = embed.match(/(?:youtube\.com\/embed\/|youtu\.be\/|v=)([^?&]+)/i);
        if (ytMatch) {
          streamKey = `yt:${ytMatch[1].toLowerCase()}`;
        } else if (c.embed_url) {
          streamKey = c.embed_url.trim().toLowerCase();
        } else if (c.image_url) {
          streamKey = c.image_url.trim().toLowerCase();
        }

        if (streamKey && seenStreams.has(streamKey)) {
          continue;
        }
        if (t && seenTitles.has(t)) {
          continue;
        }

        if (streamKey) seenStreams.add(streamKey);
        if (t) seenTitles.add(t);
        result.push(c);
      }
      return result;
    };

    return NextResponse.json({ 
      ok: true, 
      local: filterAndDedupeCams(local), 
      regional: filterAndDedupeCams(regional), 
      global: filterAndDedupeCams(global), 
      featuredTour, 
      rightRailCams: filterAndDedupeCams(rightRailCams) 
    });
  } catch (error: any) {
    console.error("Webcam Fetch Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
