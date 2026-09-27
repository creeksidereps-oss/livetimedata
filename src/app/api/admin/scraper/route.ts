import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow up to 5 minutes on Vercel Pro

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to process arrays in chunks
async function processInBatches(items: any[], batchSize: number, processFn: (item: any) => Promise<any>) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(processFn));
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean));
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const { cityName, stateName, lat, lng } = await request.json();

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "Missing cityName parameter" }, { status: 400 });
    }

    // 1. Check Cooldown (7 days = 168 hours)
    try {
      const cooldownCheck = await sql`
        SELECT MAX(created_at) as last_ingest 
        FROM events 
        WHERE city_name = ${cityName} AND source ILIKE '%API Ingestion Engine%'
      `;
      const lastIngest = cooldownCheck.rows[0]?.last_ingest;
      if (lastIngest) {
        const hoursSince = (new Date().getTime() - new Date(lastIngest).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 168) {
          return NextResponse.json({ 
            ok: true, 
            skipped: true, 
            message: `City was ingested ${Math.round(hoursSince)} hours ago. Cooldown is 168 hours.` 
          });
        }
      }
    } catch (e) {
      console.error("Cooldown check failed (maybe table doesn't have created_at). Ignoring.", e);
    }

    console.log(`📡 [API INGESTION] Fetching massive event payload for ${cityName}, ${stateName}...`);

    let rawEvents: any[] = [];

    // 2. Fetch Ticketmaster (Size 25)
    if (process.env.TICKETMASTER_API_KEY) {
      try {
        const tmUrl = (lat && lng) ? `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&latlong=${lat},${lng}&radius=50&unit=miles&sort=date,asc&size=100` : `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${encodeURIComponent(cityName)}&sort=date,asc&size=100`;
        const res = await fetch(tmUrl);
        if (res.ok) {
          const data = await res.json();
          const events = data._embedded?.events || [];
          for (const ev of events) {
            const vObj = ev._embedded?.venues?.[0];
            const venueName = vObj?.name || "Unknown Venue";
            const actualCity = vObj?.city?.name || cityName;
            const stateCode = vObj?.state?.stateCode || stateName;
            const street1 = vObj?.address?.line1 || "";
            const zipCode = vObj?.postalCode || "";
            const venueAddress = street1 ? `${street1}, ${actualCity}, ${stateCode}${zipCode ? ` ${zipCode}` : ""}`.trim() : null;
            const titleLower = ev.name.toLowerCase();
            const venueLower = venueName.toLowerCase();
            
            const bannedTerms = ["virtual", "webinar", "online", "parking", "reserve access", "not a game ticket", "vip access", "vip pass"];
            const isBanned = bannedTerms.some(term => titleLower.includes(term) || venueLower.includes(term));
            if (isBanned) continue;

            let start_time = ev.dates?.start?.localTime || "TBA";
            if (start_time !== "TBA" && start_time.includes(":")) {
              const [h, m] = start_time.split(":");
              const hInt = parseInt(h, 10);
              const ampm = hInt >= 12 ? 'PM' : 'AM';
              const h12 = hInt % 12 || 12;
              start_time = `${h12}:${m} ${ampm}`;
            }

            let event_flyer_url = "";
            if (ev.images && ev.images.length > 0) {
              ev.images.sort((a: any, b: any) => b.width - a.width);
              event_flyer_url = ev.images[0].url;
            }

            rawEvents.push({
              title: ev.name,
              event_date: ev.dates?.start?.localDate,
              start_time: start_time,
              venue: venueName,
              venue_address: venueAddress,
              actual_city: actualCity,
              official_info_url: ev.url || "",
              event_flyer_url
            });
          }
        }
      } catch(e) { console.error("Ticketmaster fetch failed", e); }
    }

    // 3. Fetch SeatGeek (Size 25)
    if (process.env.SEATGEEK_CLIENT_ID) {
      try {
        const sgUrl = (lat && lng) ? `https://api.seatgeek.com/2/events?client_id=${process.env.SEATGEEK_CLIENT_ID}&lat=${lat}&lon=${lng}&range=50mi&per_page=100` : `https://api.seatgeek.com/2/events?client_id=${process.env.SEATGEEK_CLIENT_ID}&venue.city=${encodeURIComponent(cityName)}&per_page=100`;
        const res = await fetch(sgUrl);
        if (res.ok) {
          const data = await res.json();
          const events = data.events || [];
          for (const ev of events) {
            const venueName = ev.venue?.name || "Unknown Venue";
            const actualCity = ev.venue?.city || cityName;
            const street1 = ev.venue?.address || "";
            const street2 = ev.venue?.extended_address || "";
            const fullStreet = [street1, street2].filter(Boolean).join(", ");
            const stateCode = ev.venue?.state || stateName;
            const zipCode = ev.venue?.postal_code || "";
            const venueAddress = fullStreet ? `${fullStreet}, ${actualCity}, ${stateCode}${zipCode ? ` ${zipCode}` : ""}`.trim() : null;
            const titleLower = ev.title.toLowerCase();
            const venueLower = venueName.toLowerCase();
            
            const bannedTerms = ["virtual", "webinar", "online", "parking", "reserve access", "not a game ticket", "vip access", "vip pass"];
            const isBanned = bannedTerms.some(term => titleLower.includes(term) || venueLower.includes(term));
            if (isBanned) continue;

            let start_time = "TBA";
            let event_date = null;
            if (ev.datetime_local) {
              const dt = new Date(ev.datetime_local);
              event_date = dt.toISOString().split("T")[0];
              const hInt = dt.getHours();
              const ampm = hInt >= 12 ? 'PM' : 'AM';
              const h12 = hInt % 12 || 12;
              const m = dt.getMinutes().toString().padStart(2, '0');
              start_time = `${h12}:${m} ${ampm}`;
            }

            let event_flyer_url = "";
            if (ev.performers && ev.performers.length > 0 && ev.performers[0].image) {
              event_flyer_url = ev.performers[0].image;
            }

            rawEvents.push({
              title: ev.title,
              event_date: event_date,
              start_time: start_time,
              venue: venueName,
              venue_address: venueAddress,
              actual_city: actualCity,
              official_info_url: ev.url || "",
              event_flyer_url
            });
          }
        }
      } catch(e) { console.error("SeatGeek fetch failed", e); }
    }

    // 4. Fetch Eventbrite via Search Scraper (Gemini)
    try {
      const ebPrompt = `
        List 5 real upcoming public events, concerts, demos, expos, and festivals in ${cityName} ${stateName}.
        Exclude any events that are "Virtual", "Online", or "Webinars".
        Return ONLY a raw JSON array of objects with this schema:
        [
          {
            "title": "Clean Event Title",
            "event_date": "YYYY-MM-DD",
            "start_time": "e.g. 11:00 AM or 7:00 PM",
            "venue": "Specific venue or facility name (not just city/state)",
            "venue_address": "Street address if known (e.g. 123 Main St, City, State Zip) or null",
            "official_info_url": "Direct ticket or event URL if known, or Eventbrite URL",
            "event_flyer_url": "Direct image/flyer URL if known, or null",
            "hosting_entity": "Host/Organizer/Presenter name or null"
          }
        ]
      `;
      const ebRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: ebPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      if (ebRes.text) {
        const parsed = JSON.parse(ebRes.text);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
             if (p.title && p.event_date && p.venue) {
               rawEvents.push({
                 title: p.title,
                 event_date: p.event_date,
                 start_time: p.start_time || "TBA",
                 venue: p.venue,
                 venue_address: p.venue_address || null,
                 hosting_entity: p.hosting_entity || null,
                 actual_city: cityName,
                 official_info_url: p.official_info_url || "",
                 event_flyer_url: p.event_flyer_url || ""
               });
             }
          });
        }
      }
    } catch(e) { console.error("Eventbrite Gemini scrape failed", e); }


    // Remove duplicates based on title and date
    const uniqueEvents = [];
    const seen = new Set();
    for (const ev of rawEvents) {
      if (!ev.event_date || !ev.start_time || ev.venue === "Unknown Venue") continue;
      const key = `${ev.title}-${ev.event_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvents.push(ev);
      }
    }

    console.log(`[API INGESTION] Discovered ${uniqueEvents.length} unique events. Processing via Gemini...`);

    // 5. Parallel Processing through Gemini (Batch Size 10)
    const processedEvents = await processInBatches(uniqueEvents, 10, async (ev) => {
      // Check DB first to save tokens
      const existing = await sql`SELECT id FROM events WHERE title ILIKE ${ev.title} AND event_date = ${ev.event_date}::timestamp LIMIT 1`;
      if (existing.rows.length > 0) return null;

      const prompt = `
        You are an expert event data curator for LiveTimeData.com.
        Analyze this upcoming event and provide accurate, structured event intelligence.

        Event Data:
        Title: ${ev.title}
        Venue: ${ev.venue}
        Known Address: ${ev.venue_address || "None"}
        Date: ${ev.event_date}
        Time: ${ev.start_time}
        City Context: ${ev.actual_city || cityName}, ${stateName}

        TASK:
        Extract and return a strict JSON object with these exact keys:
        1. "details": A clear, engaging 1-3 sentence summary of what this event is and what attendees will experience. Include key performers, organizers, and activities.
        2. "category": Choose exactly ONE from: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Parades, Auditions, Comedy, Nightlife, Other.
        3. "venue_name": Clean name of the facility/venue (e.g. "George M. Holmes Convocation Center" or "527 S Upper St"). Do NOT return just the city/state.
        4. "venue_address": Complete street address (e.g. "318 NW 23rd Street, Miami, FL 33127"). If no street address can be determined, return null.
        5. "hosting_entity": Presenter, organizer, team, or headlining artist (e.g. "Appalachian State Mountaineers" or "Jacob H Khan") or null.

        Return ONLY raw JSON.
      `;

      let aiResponseText = `Join us at ${ev.venue} for ${ev.title}!`;
      let category = "Other";
      let venueName = ev.venue;
      let venueAddress = ev.venue_address || null;
      let hostingEntity = ev.hosting_entity || null;

      try {
        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        if (aiResponse.text) {
          const parsed = JSON.parse(aiResponse.text);
          aiResponseText = parsed.details || aiResponseText;
          category = parsed.category || "Other";
          if (parsed.venue_name && parsed.venue_name.toLowerCase() !== (cityName || '').toLowerCase()) {
            venueName = parsed.venue_name;
          }
          if (parsed.venue_address && parsed.venue_address.length > 5) {
            venueAddress = parsed.venue_address;
          }
          if (parsed.hosting_entity && parsed.hosting_entity.length > 1) {
            hostingEntity = parsed.hosting_entity;
          }
        }
      } catch (aiErr) {
        console.error("AI Generation failed for", ev.title);
      }

      if (!venueAddress && venueName) {
        const addrMatch = venueName.match(/\(([^)]*\d+[^)]*)\)/);
        if (addrMatch) {
          venueAddress = `${addrMatch[1].trim()}, ${ev.actual_city || cityName}, ${stateName || ''}`;
        } else {
          try {
            const known = await sql`
              SELECT venue_address FROM events
              WHERE LOWER(TRIM(city_name)) = ${(ev.actual_city || cityName).trim().toLowerCase()}
                AND (LOWER(TRIM(venue)) = ${venueName.trim().toLowerCase()} OR LOWER(TRIM(venue)) LIKE ${'%' + venueName.trim().toLowerCase() + '%'})
                AND venue_address IS NOT NULL AND LENGTH(TRIM(venue_address)) > 5
              ORDER BY id DESC LIMIT 1
            `;
            if (known.rows && known.rows.length > 0) {
              venueAddress = known.rows[0].venue_address;
            }
          } catch {}
        }
      }

      let flyerUrl = ev.event_flyer_url || null;
      if (!flyerUrl && (venueName || hostingEntity)) {
        try {
          const target = (hostingEntity || venueName).toLowerCase().trim();
          const banked = await sql`
            SELECT image_url, logo_url FROM entities
            WHERE (LOWER(name) = ${target} OR LOWER(normalized_name) = ${target} OR LOWER(name) LIKE ${'%' + target + '%'})
              AND (image_url IS NOT NULL OR logo_url IS NOT NULL)
            LIMIT 1
          `;
          if (banked.rows && banked.rows.length > 0) {
            flyerUrl = banked.rows[0].image_url || banked.rows[0].logo_url;
          }
        } catch {}
      }

      await sql`
        INSERT INTO events (
          title, city_name, state_name, category, venue, venue_address, hosting_entity, source,
          start_time, event_date, details, official_info_url, event_flyer_url, status, view_count
        ) VALUES (
          ${ev.title},
          ${ev.actual_city || cityName},
          ${stateName || ''},
          ${category},
          ${venueName},
          ${venueAddress},
          ${hostingEntity},
          'API Ingestion Engine - Auto-Approved',
          ${ev.start_time},
          ${ev.event_date}::timestamp,
          ${aiResponseText},
          ${ev.official_info_url},
          ${flyerUrl},
          'live',
          0
        )
      `;

      return { title: ev.title, status: 'live' };
    });

    return NextResponse.json({ ok: true, totalProcessed: processedEvents.length, processedEvents });

  } catch (error: any) {
    console.error("SCRAPER ERROR:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
