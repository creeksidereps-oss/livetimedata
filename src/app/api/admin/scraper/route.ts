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
            const venueName = ev._embedded?.venues?.[0]?.name || "Unknown Venue";
            const actualCity = ev._embedded?.venues?.[0]?.city?.name || cityName;
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
              actual_city: actualCity,
              official_info_url: ev.url || "",
              event_flyer_url
            });
          }
        }
      } catch(e) { console.error("SeatGeek fetch failed", e); }
    }

    // 4. Fetch Eventbrite via Google Search Scraper (Gemini)
    try {
      const ebPrompt = `
        Search Google for "site:eventbrite.com upcoming events in ${cityName} ${stateName}"
        Extract the top 5 events you find. Exclude any events that are "Virtual", "Online", or "Webinars".
        Return ONLY a raw JSON array of objects. Do NOT use markdown backticks.
        [
          {
            "title": "Event Name",
            "event_date": "YYYY-MM-DD",
            "start_time": "7:00 PM",
            "venue": "Venue Name",
            "official_info_url": "Eventbrite URL"
          }
        ]
      `;
      const ebRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: ebPrompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      if (ebRes.text) {
        const rawText = ebRes.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
             if (p.title && p.event_date && p.venue) {
               rawEvents.push({
                 title: p.title,
                 event_date: p.event_date,
                 start_time: p.start_time || "TBA",
                 venue: p.venue,
                 actual_city: cityName,
                 official_info_url: p.official_info_url || "",
                 event_flyer_url: ""
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
        You are an expert event data curator. I am providing you with hard, verified facts about an upcoming event.
        Your job is to provide two things:
        1. A strict, factual description (details) of what this event is and what to expect. You MUST use Google Search Grounding to find verified information about the event. IMPORTANT RULES FOR THE DESCRIPTION:
           - NEVER generate generic, hallucinated, or filler commentary.
           - ONLY state facts you can verify about THIS specific event.
           - If you cannot find verified information, write exactly: "Join us at ${ev.venue} for ${ev.title}!" Do NOT hallucinate anything else.
        2. The best matching category for our UI. Choose exactly ONE from this list: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Parades, Auditions, Comedy, Nightlife, Other.
        
        Event Data:
        Title: ${ev.title}
        Venue: ${ev.venue}
        Date: ${ev.event_date}
        City Context: ${ev.actual_city || cityName}, ${stateName}

        You MUST return ONLY a raw JSON object with exactly two keys: "details" and "category". 
        Do NOT wrap it in markdown backticks. Do NOT add any conversational text.
        {"details": "...", "category": "..."}
      `;

      let aiResponseText = `Join us at ${ev.venue} for ${ev.title}!`;
      let category = "Other";

      try {
        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] }
        });
        if (aiResponse.text) {
          const rawText = aiResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(rawText);
          aiResponseText = parsed.details || aiResponseText;
          category = parsed.category || "Other";
        }
      } catch (aiErr) {
        console.error("AI Generation failed for", ev.title);
      }

      await sql`
        INSERT INTO events (
          title, city_name, state_name, category, venue, source,
          start_time, event_date, details, official_info_url, event_flyer_url, status, view_count
        ) VALUES (
          ${ev.title},
          ${ev.actual_city || cityName},
          ${stateName || ''},
          ${category},
          ${ev.venue},
          'API Ingestion Engine - Auto-Approved',
          ${ev.start_time},
          ${ev.event_date}::timestamp,
          ${aiResponseText},
          ${ev.official_info_url},
          ${ev.event_flyer_url},
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
