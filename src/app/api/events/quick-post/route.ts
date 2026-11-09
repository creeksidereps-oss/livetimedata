import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { scheduleCityContentProvisioning } from "@/lib/cityContentWorkflow";
import { publishEvent, type IntakeResult } from "@/lib/events/intake/publishEvent";
import type { VerifiedLocation } from "@/lib/events/location/resolveLocation";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const ADMIN_PIN = "0059";

interface EventPayload {
  title: string;
  cityName: string;
  stateName?: string;
  countryName?: string;
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
          countryName: body.countryName,
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

    const createdEvents: Array<{ id: number; title: string; cityName: string; eventUrl: string; status: string; reasons: string[] }> = [];
    const notPublished: Array<{ title: string; eventDate: string | null; outcome: string; reasons: string[]; detail?: string }> = [];
    const verifiedCities = new Map<string, VerifiedLocation>();

    for (const ev of incomingEvents) {
      const title = String(ev.title || "").trim();
      // Location = exactly what the poster typed. No defaults.
      const cityName = String(ev.cityName || body.cityName || "").trim();
      const stateName = String(ev.stateName || body.stateName || "").trim();
      const countryName = String(ev.countryName || body.countryName || "").trim();
      const venueName = String(ev.venueName || "").trim();
      const venueAddress = String(ev.venueAddress || "").trim();
      const category = String(ev.category || "Community & Civic").trim();
      const startTime = String(ev.startTime || "").trim(); // missing/TBD -> pending_review (never a made-up time)
      const eventDates: string[] = Array.isArray(ev.eventDates) ? ev.eventDates.filter(Boolean) : [];
      const details = String(ev.details || "").trim();
      const officialInfoUrl = String(ev.officialInfoUrl || body.officialInfoUrl || "").trim();
      const performers: string[] = Array.isArray(ev.performers) ? ev.performers : [];

      if (!title || !venueName) {
        notPublished.push({ title: title || "(untitled)", eventDate: null, outcome: "rejected", reasons: [!title ? "title_missing" : "venue_missing"] });
        continue;
      }
      if (eventDates.length === 0) {
        // No date = no listing (never default to today).
        notPublished.push({ title, eventDate: null, outcome: "rejected", reasons: ["date_missing"] });
        continue;
      }

      // Every date goes through publishEvent() (location verification, date/time rules, dedup).
      let firstResult: IntakeResult | null = null;
      let verified: VerifiedLocation | undefined;
      for (const eventDateStr of eventDates) {
        const result = await publishEvent({
          origin: "quick_post",
          title,
          details,
          category,
          venue: venueName,
          venueAddress: venueAddress || null,
          hostingEntity: venueName,
          startTime,
          eventDate: eventDateStr,
          location: {
            city: cityName || null,
            region: stateName || null,
            country: countryName || null,
            address: venueAddress || null,
            sourceUrl: officialInfoUrl || null,
          },
          source: "Mobile Quick Post",
          officialInfoUrl: officialInfoUrl || null,
          eventFlyerUrl: finalEventFlyerUrl || null,
          userName: "Admin Quick",
          userEmail: "admin@livetimedata.com",
        });
        if (result.location) verified = result.location;
        if (result.id && (result.outcome === "published" || result.outcome === "pending_review" || result.outcome === "duplicate")) {
          if (!firstResult) firstResult = result;
          if (result.outcome === "pending_review") {
            notPublished.push({ title, eventDate: eventDateStr, outcome: result.outcome, reasons: result.reasons, detail: result.detail });
          }
        } else {
          notPublished.push({ title, eventDate: eventDateStr, outcome: result.outcome, reasons: result.reasons, detail: result.detail });
        }
      }

      if (firstResult?.id) {
        createdEvents.push({
          id: firstResult.id,
          title,
          cityName: verified?.cityName || cityName,
          eventUrl: `/events/${firstResult.id}`,
          status: firstResult.outcome,
          reasons: firstResult.reasons,
        });
      }

      if (verified) verifiedCities.set(verified.citySlug, verified);

      // Lifecycle seeding uses the verified location when we have one, else the poster's own text. Never a default country.
      const seedCity = verified?.cityName || cityName || null;
      const seedState = verified?.admin1 || stateName || null;
      const seedCountry = verified?.countryCode || null;

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
              ${venueName}, ${normVenue}, 'venue', ${seedCity}, ${seedState},
              ${seedCountry}, ${officialInfoUrl || null}, 'published', NOW(), NOW()
            )
            ON CONFLICT DO NOTHING;
          `;

          await sql`
            INSERT INTO venue_profiles (
              venue_name, city_name, state_name, website_url, is_trusted_source
            ) VALUES (
              ${venueName}, ${seedCity}, ${seedState}, ${officialInfoUrl || null}, true
            )
            ON CONFLICT (venue_name) DO UPDATE 
            SET website_url = COALESCE(venue_profiles.website_url, EXCLUDED.website_url);
          `;
        } catch (entityErr) {
          console.warn("Venue lifecycle insertion warning:", entityErr);
        }
      }

      // 4. LIFECYCLE SEEDING: Ingest Performers / Bands into Entities & Performers Graph
      // Performers tour; they get no home city from one gig.
      for (const performer of performers) {
        if (!performer || performer.trim().length < 2) continue;
        try {
          const normPerformer = performer.toLowerCase().trim();
          await sql`
            INSERT INTO entities (
              name, normalized_name, entity_type, city_name, state_name,
              country_code, verification_status, created_at, updated_at
            ) VALUES (
              ${performer}, ${normPerformer}, 'performer', NULL, NULL,
              NULL, 'published', NOW(), NOW()
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
              ${officialInfoUrl}, 'venue', ${venueName}, ${seedCity}, ${seedState},
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

    // Non-blocking city content provisioning, only for cities publishEvent verified (real country, no "United States" default)
    for (const loc of verifiedCities.values()) {
      scheduleCityContentProvisioning({
        cityName: loc.cityName,
        admin1: loc.admin1,
        country: loc.countryName,
        countryCode: loc.countryCode,
        lat: loc.lat,
        lon: loc.lon,
        timezone: loc.timezone,
      });
    }

    if (createdEvents.length === 0) {
      const why = notPublished.map((n) => `${n.title}${n.eventDate ? ` (${n.eventDate})` : ""}: ${n.outcome} - ${n.reasons.join(", ")}${n.detail ? ` (${n.detail})` : ""}`).join("; ");
      return NextResponse.json({ ok: false, error: `Nothing was saved. ${why}`, notPublished }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      count: createdEvents.length,
      events: createdEvents,
      notPublished,
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
