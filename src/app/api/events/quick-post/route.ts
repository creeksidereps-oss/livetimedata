import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const ADMIN_PIN = "0059";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body.pin || "").trim();

    // Verify VIP PIN
    if (pin !== ADMIN_PIN) {
      return NextResponse.json(
        { ok: false, error: "Invalid VIP Passcode. Access denied." },
        { status: 401 }
      );
    }

    const title = String(body.title || "").trim();
    const cityName = String(body.cityName || "").trim();
    const stateName = String(body.stateName || "").trim();
    const venueName = String(body.venueName || "").trim();
    const venueAddress = String(body.venueAddress || "").trim();
    const category = String(body.category || "Community & Civic").trim();
    const startTime = String(body.startTime || "TBD").trim();
    const eventDates: string[] = Array.isArray(body.eventDates) && body.eventDates.length > 0 
      ? body.eventDates 
      : [new Date().toISOString().split("T")[0]];
    const details = String(body.details || "").trim();
    const officialInfoUrl = String(body.officialInfoUrl || "").trim();
    const flyerBase64 = body.flyerBase64 || null;
    let finalEventFlyerUrl = String(body.eventFlyerUrl || "").trim();

    if (!title || !cityName || !venueName) {
      return NextResponse.json(
        { ok: false, error: "Title, City, and Venue are required." },
        { status: 400 }
      );
    }

    // Handle Flyer Image Save to /public/uploads/
    if (flyerBase64) {
      try {
        const matches = flyerBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const data = matches[2];
          const buffer = Buffer.from(data, "base64");
          const filename = `quick_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const uploadDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadDir, { recursive: true });
          await fs.writeFile(path.join(uploadDir, filename), buffer);
          finalEventFlyerUrl = `/uploads/${filename}`;
        }
      } catch (err) {
        console.error("Failed to save flyer image:", err);
      }
    }

    // Ensure City is registered in database for Nearby / Radius engine
    try {
      const cityCheck = await sql`SELECT id FROM cities WHERE LOWER(name) = LOWER(${cityName}) LIMIT 1`;
      if (cityCheck.rows.length === 0) {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName)}&country=USA&format=json&limit=1`,
          { headers: { "User-Agent": "LiveTimeData-QuickPost/1.0" }, cache: "no-store" }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          const lat = parseFloat(geoData[0].lat);
          const lon = parseFloat(geoData[0].lon);
          await sql`INSERT INTO cities (name, admin1, latitude, longitude) VALUES (${cityName}, ${stateName}, ${lat}, ${lon})`;
        }
      }
    } catch (geoErr) {
      console.warn("City registration skipped:", geoErr);
    }

    let firstInsertedId: number | null = null;

    // Instant Publication into Neon PostgreSQL
    for (const eventDateStr of eventDates) {
      // Duplicate check
      const existing = await sql`
        SELECT id FROM events
        WHERE title = ${title}
          AND city_name = ${cityName}
          AND event_date = ${eventDateStr}::timestamp
        LIMIT 1
      `;

      if (existing.rows.length > 0) {
        const existingId = existing.rows[0].id;
        await sql`UPDATE events SET duplicate_count = duplicate_count + 1 WHERE id = ${existingId}`;
        if (!firstInsertedId) firstInsertedId = existingId;
        continue;
      }

      const insertRes = await sql`
        INSERT INTO events (
          title, city_name, state_name, category, venue, venue_address,
          hosting_entity, source, start_time, event_date, details,
          user_name, user_email, official_info_url, event_flyer_url,
          view_count, status
        ) VALUES (
          ${title}, ${cityName}, ${stateName}, ${category}, ${venueName}, ${venueAddress},
          ${venueName}, 'Mobile Quick Post', ${startTime}, ${eventDateStr}::timestamp, ${details},
          'Admin Quick', 'admin@livetimedata.com', ${officialInfoUrl || null}, ${finalEventFlyerUrl || null},
          0, 'live'
        )
        RETURNING id
      `;

      if (insertRes.rows.length > 0 && !firstInsertedId) {
        firstInsertedId = insertRes.rows[0].id;
      }
    }

    return NextResponse.json({
      ok: true,
      eventId: firstInsertedId,
      eventUrl: firstInsertedId ? `/events/${firstInsertedId}` : `/city/${encodeURIComponent(cityName.toLowerCase())}`,
      title,
      cityName,
      stateName,
      datesCount: eventDates.length
    });
  } catch (err: any) {
    console.error("Quick post error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to publish event" }, { status: 500 });
  }
}
