// src/app/api/events/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const state = searchParams.get("state") || "";
    const nearby = searchParams.get("nearby") === "true";

    if (!city) {
      return NextResponse.json({ ok: false, error: "City parameter is required." }, { status: 400 });
    }

    let rows: any[] = [];

    if (nearby) {
      // Haversine Radius Search (30 miles)
      try {
        const result = await sql`
          WITH target_city AS (
            SELECT latitude, longitude FROM cities 
            WHERE LOWER(name) = LOWER(${city})
            ORDER BY CASE WHEN LOWER(admin1) = LOWER(${state}::text) THEN 0 ELSE 1 END ASC
            LIMIT 1
          )
          SELECT e.* 
          FROM events e
          JOIN cities c ON LOWER(e.city_name) = LOWER(c.name)
          CROSS JOIN target_city tc
          WHERE e.status NOT IN ('pending', 'pending_review', 'legal_hold')
            AND 3959 * acos(
                  LEAST(1.0, GREATEST(-1.0,
                    cos(radians(tc.latitude)) * cos(radians(c.latitude)) * 
                    cos(radians(c.longitude) - radians(tc.longitude)) + 
                    sin(radians(tc.latitude)) * sin(radians(c.latitude))
                  ))
                ) <= 30
          ORDER BY e.event_date ASC
        `;
        rows = result.rows;
      } catch (dbErr) {
        console.error("Nearby search failed (likely missing lat/lon columns):", dbErr);
        // Fallback: Just return empty array if DB schema lacks coordinates
        rows = [];
      }
    } else {
      // Standard Exact City Match
      let result;
      if (state) {
        result = await sql`
          SELECT * FROM events 
          WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
          AND (LOWER(state_name) = LOWER(${state}) OR state_name IS NULL OR state_name = '')
          AND status NOT IN ('pending', 'pending_review', 'legal_hold')
          ORDER BY event_date ASC
        `;
      } else {
        result = await sql`
          SELECT * FROM events 
          WHERE LOWER(city_name) LIKE LOWER(${city} || '%')
          AND status NOT IN ('pending', 'pending_review', 'legal_hold')
          ORDER BY event_date ASC
        `;
      }
      rows = result.rows;
    }

    // Format them correctly for the frontend
    const events = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      venue: row.venue,
      source: row.source,
      startTime: row.start_time,
      eventDate: row.event_date,
      details: row.details,
      affiliateUrl: row.affiliate_url,
      venue_address: row.venue_address,
      hosting_entity: row.hosting_entity,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      official_info_url: row.official_info_url,
      social_urls: row.social_urls,
      registration_url: row.registration_url,
      event_flyer_url: row.event_flyer_url,
      cityName: row.city_name,
    }));

    return NextResponse.json({ ok: true, events }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error: any) {
    console.error("GET Events Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch events" }, { status: 500 });
  }
}