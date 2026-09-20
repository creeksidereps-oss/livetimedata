import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const ADMIN_PIN = "0059";

interface EventPayload {
  title: string;
  cityName: string;
  stateName?: string;
  venueName: string;
  venueAddress?: string;
  category?: string;
  startTime?: string;
  eventDates?: string[];
  details?: string;
  officialInfoUrl?: string;
  performers?: string[];
}

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

    // Support either batch array or single event fields
    let incomingEvents: EventPayload[] = [];
    if (Array.isArray(body.events) && body.events.length > 0) {
      incomingEvents = body.events;
    } else if (body.title && body.venueName) {
      incomingEvents = [
        {
          title: body.title,
          cityName: body.cityName,
          stateName: body.stateName,
          venueName: body.venueName,
          venueAddress: body.venueAddress,
          category: body.category,
          startTime: body.startTime,
          eventDates: body.eventDates,
          details: body.details,
          officialInfoUrl: body.officialInfoUrl,
          performers: body.performers
        }
      ];
    }

    if (incomingEvents.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No events provided for publication." },
        { status: 400 }
      );
    }

    // Handle Flyer/Screenshot Image Save
    const flyerBase64 = body.flyerBase64 || null;
    let finalEventFlyerUrl = String(body.eventFlyerUrl || "").trim();

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
        console.error("Failed to save flyer/screenshot image:", err);
      }
    }

    const createdEvents: Array<{ id: number; title: string; cityName: string; eventUrl: string }> = [];

    for (const ev of incomingEvents) {
      const title = String(ev.title || "").trim();
      const cityName = String(ev.cityName || body.cityName || "").trim();
      const stateName = String(ev.stateName || body.stateName || "").trim();
      const venueName = String(ev.venueName || "").trim();
      const venueAddress = String(ev.venueAddress || "").trim();
      const category = String(ev.category || "Community & Civic").trim();
      const startTime = String(ev.startTime || "TBD").trim();
      const eventDates: string[] = Array.isArray(ev.eventDates) && ev.eventDates.length > 0
        ? ev.eventDates
        : [new Date().toISOString().split("T")[0]];
      const details = String(ev.details || "").trim();
      const officialInfoUrl = String(ev.officialInfoUrl || body.officialInfoUrl || "").trim();
      const performers: string[] = Array.isArray(ev.performers) ? ev.performers : [];

      if (!title || !cityName || !venueName) continue;

      // 1. Auto-Register City for Distance/Radius calculations if not in database
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

      // 2. Insert into Events Table (Live Status)
      let firstInsertedId: number | null = null;
      for (const eventDateStr of eventDates) {
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

      if (firstInsertedId) {
        createdEvents.push({
          id: firstInsertedId,
          title,
          cityName,
          eventUrl: `/events/${firstInsertedId}`
        });
      }

      // 3. LIFECYCLE SEEDING: Ingest Venue into Entities & Venue Profiles (Businesses & named venues only)
      const isResidentialAddress = /^[0-9]+\s+[A-Za-z]/.test(venueName.trim()) || /^#[0-9]+/.test(venueName.trim());
      if (!isResidentialAddress) {
        try {
          const normVenue = venueName.toLowerCase().trim();
          await sql`
            INSERT INTO entities (
              name, normalized_name, entity_type, city_name, state_name,
              country_code, website_url, verification_status, created_at, updated_at
            ) VALUES (
              ${venueName}, ${normVenue}, 'venue', ${cityName}, ${stateName || null},
              'US', ${officialInfoUrl || null}, 'published', NOW(), NOW()
            )
            ON CONFLICT DO NOTHING;
          `;

          await sql`
            INSERT INTO venue_profiles (
              venue_name, city_name, state_name, website_url, is_trusted_source
            ) VALUES (
              ${venueName}, ${cityName}, ${stateName || null}, ${officialInfoUrl || null}, true
            )
            ON CONFLICT (venue_name) DO UPDATE 
            SET website_url = COALESCE(venue_profiles.website_url, EXCLUDED.website_url);
          `;
        } catch (entityErr) {
          console.warn("Venue lifecycle insertion warning:", entityErr);
        }
      }

      // 4. LIFECYCLE SEEDING: Ingest Performers / Bands into Entities & Performers Graph
      for (const performer of performers) {
        if (!performer || performer.trim().length < 2) continue;
        try {
          const normPerformer = performer.toLowerCase().trim();
          await sql`
            INSERT INTO entities (
              name, normalized_name, entity_type, city_name, state_name,
              country_code, verification_status, created_at, updated_at
            ) VALUES (
              ${performer}, ${normPerformer}, 'performer', ${cityName}, ${stateName || null},
              'US', 'published', NOW(), NOW()
            )
            ON CONFLICT DO NOTHING;
          `;

          await sql`
            INSERT INTO performers (name, type, official_site)
            VALUES (${performer}, 'band', ${officialInfoUrl || null})
            ON CONFLICT (name) DO NOTHING;
          `;
        } catch (perfErr) {
          console.warn("Performer lifecycle warning:", perfErr);
        }
      }

      // 5. LIFECYCLE SEEDING: Register Source into Spider Crawl Schedule
      if (officialInfoUrl && officialInfoUrl.startsWith("http")) {
        try {
          await sql`
            INSERT INTO sources (
              url, source_type, name, city_name, state_name,
              scrape_interval_days, next_scrape_due, status, created_at, updated_at
            ) VALUES (
              ${officialInfoUrl}, 'venue', ${venueName}, ${cityName}, ${stateName || null},
              14, NOW(), 'active', NOW(), NOW()
            )
            ON CONFLICT (url) DO UPDATE 
            SET next_scrape_due = NOW(), status = 'active';
          `;
          console.log(`[LIFECYCLE SEEDED] Registered ${officialInfoUrl} into scrape queue`);
        } catch (srcErr) {
          console.warn("Source lifecycle queue warning:", srcErr);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      count: createdEvents.length,
      events: createdEvents,
      primaryEventUrl: createdEvents.length > 0 ? createdEvents[0].eventUrl : `/`,
      lifecycleSeeded: {
        venuesAdded: incomingEvents.map(e => e.venueName),
        sourcesEnqueued: incomingEvents.filter(e => e.officialInfoUrl).length
      }
    });
  } catch (err: any) {
    console.error("Quick post error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to publish events" },
      { status: 500 }
    );
  }
}
