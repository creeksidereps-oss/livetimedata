import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

const SEATGEEK_CLIENT_ID = process.env.SEATGEEK_CLIENT_ID;
const AFFILIATE_ID = process.env.SEATGEEK_AFFILIATE_ID || 'PENDING_APPROVAL';
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const EVENTBRITE_PRIVATE_TOKEN = process.env.EVENTBRITE_PRIVATE_TOKEN;

async function fetchSeatGeek(lat: number, lon: number, cityName: string, stateName: string) {
  if (!SEATGEEK_CLIENT_ID) return { success: false, error: "Missing Client ID" };
  const url = `https://api.seatgeek.com/2/events?lat=${lat}&lon=${lon}&range=30mi&per_page=100&sort=datetime_local.asc&client_id=${SEATGEEK_CLIENT_ID}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SeatGeek API Error: ${res.statusText}`);
    const data = await res.json();
    const events = data.events || [];
    let insertedCount = 0;
    
    for (const event of events) {
      const title = event.title;
      const venueName = event.venue?.name || 'Unknown Venue';
      const actualCity = event.venue?.city || cityName;
      const eventDate = event.datetime_utc;
      const startTime = event.datetime_local ? new Date(event.datetime_local).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'TBD';
      
      let category = 'Other';
      if (event.type.includes('sports') || event.type.includes('nfl') || event.type.includes('mlb')) category = 'Sports';
      else if (event.type.includes('concert') || event.type.includes('music')) category = 'Concerts';
      else if (event.type.includes('theater') || event.type.includes('broadway')) category = 'Arts';
      else if (event.type.includes('comedy')) category = 'Comedy';

      const affiliateUrl = `${event.url}?aid=${AFFILIATE_ID}`;
      const details = event.description || event.short_title || title;
      
      const { rowCount } = await sql`SELECT id FROM events WHERE title = ${title} AND venue = ${venueName} LIMIT 1`;
      if (rowCount === 0) {
        await sql`
          INSERT INTO events (title, city_name, state_name, category, venue, start_time, event_date, details, affiliate_url, source, status)
          VALUES (${title}, ${actualCity}, ${stateName}, ${category}, ${venueName}, ${startTime}, ${eventDate}, ${details}, ${affiliateUrl}, 'SeatGeek', 'live')
        `;
        insertedCount++;
      }
    }
    return { source: 'SeatGeek', found: events.length, inserted: insertedCount };
  } catch (error: any) {
    return { source: 'SeatGeek', error: error.message };
  }
}

async function fetchTicketmaster(lat: number, lon: number, cityName: string, stateName: string) {
  if (!TICKETMASTER_API_KEY) return { success: false, error: "Missing API Key" };
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&latlong=${lat},${lon}&radius=30&unit=miles&size=200&sort=date,asc`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ticketmaster API Error: ${res.statusText}`);
    const data = await res.json();
    const events = data._embedded?.events || [];
    let insertedCount = 0;
    
    for (const event of events) {
      const title = event.name;
      const venueName = event._embedded?.venues?.[0]?.name || 'Unknown Venue';
      const actualCity = event._embedded?.venues?.[0]?.city?.name || cityName;
      const eventDate = event.dates?.start?.dateTime || event.dates?.start?.localDate || null;
      if (!eventDate) continue;
      const startTime = event.dates?.start?.localTime || 'TBD';
      
      const segment = event.classifications?.[0]?.segment?.name?.toLowerCase() || '';
      let category = 'Other';
      if (segment.includes('sports')) category = 'Sports';
      else if (segment.includes('music')) category = 'Concerts';
      else if (segment.includes('arts') || segment.includes('theatre') || segment.includes('theater')) category = 'Arts';
      else if (segment.includes('comedy')) category = 'Comedy';

      const affiliateUrl = event.url;
      const details = event.info || event.description || event.pleaseNote || title;
      
      const { rowCount } = await sql`SELECT id FROM events WHERE title = ${title} AND venue = ${venueName} LIMIT 1`;
      if (rowCount === 0) {
        await sql`
          INSERT INTO events (title, city_name, state_name, category, venue, start_time, event_date, details, affiliate_url, source, status)
          VALUES (${title}, ${actualCity}, ${stateName}, ${category}, ${venueName}, ${startTime}, ${eventDate}, ${details}, ${affiliateUrl}, 'Ticketmaster', 'live')
        `;
        insertedCount++;
      }
    }
    return { source: 'Ticketmaster', found: events.length, inserted: insertedCount };
  } catch (error: any) {
    return { source: 'Ticketmaster', error: error.message };
  }
}

async function fetchEventbrite(lat: number, lon: number, cityName: string, stateName: string) {
  if (!EVENTBRITE_PRIVATE_TOKEN) return { success: false, error: "Missing Token" };
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${lat}&location.longitude=${lon}&location.within=30mi&sort_by=date&page_size=100`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${EVENTBRITE_PRIVATE_TOKEN}` } });
    if (!res.ok) throw new Error(`Eventbrite API Error: ${res.statusText}`);
    const data = await res.json();
    const events = data.events || [];
    let insertedCount = 0;
    
    for (const event of events) {
      const title = event.name?.text || 'Event';
      const venueName = 'Eventbrite Location'; 
      const eventDate = event.start?.utc;
      const startTime = event.start?.local ? new Date(event.start.local).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'TBD';
      
      const category = 'Other'; // Could map if available
      const affiliateUrl = event.url;
      const details = event.summary || event.description?.text || title;
      
      const { rowCount } = await sql`SELECT id FROM events WHERE title = ${title} LIMIT 1`;
      if (rowCount === 0) {
        await sql`
          INSERT INTO events (title, city_name, state_name, category, venue, start_time, event_date, details, affiliate_url, source, status)
          VALUES (${title}, ${cityName}, ${stateName}, ${category}, ${venueName}, ${startTime}, ${eventDate}, ${details}, ${affiliateUrl}, 'Eventbrite', 'live')
        `;
        insertedCount++;
      }
    }
    return { source: 'Eventbrite', found: events.length, inserted: insertedCount };
  } catch (error: any) {
    return { source: 'Eventbrite', error: error.message };
  }
}

export async function POST(request: Request) {
  try {
    const { lat, lng, cityName, stateName } = await request.json();
    
    if (!lat || !lng || !cityName) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Check if we have fetched for this city in the last 24 hours
    // We use city_reports as a handy log ledger
    const { rows } = await sql`
      SELECT created_at FROM city_reports 
      WHERE city_name = ${cityName} AND state_name = ${stateName} AND report_type = 'event_scrape_log'
      ORDER BY created_at DESC LIMIT 1
    `;

    if (rows.length > 0) {
      const lastScraped = new Date(rows[0].created_at).getTime();
      const now = new Date().getTime();
      const hoursSince = (now - lastScraped) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        return NextResponse.json({ 
          message: "Skipped", 
          reason: `City was scraped ${hoursSince.toFixed(1)} hours ago.` 
        });
      }
    }

    // Trigger the fetches concurrently to speed it up (since we are only doing 1 city)
    const [sgRes, tmRes, ebRes] = await Promise.all([
      fetchSeatGeek(lat, lng, cityName, stateName),
      fetchTicketmaster(lat, lng, cityName, stateName),
      fetchEventbrite(lat, lng, cityName, stateName)
    ]);

    // Log the successful run so we don't spam it for another 24 hours
    await sql`
      INSERT INTO city_reports (lat, lng, city_name, state_name, report_type, content)
      VALUES (${lat}, ${lng}, ${cityName}, ${stateName}, 'event_scrape_log', 'Success')
    `;

    return NextResponse.json({ 
      message: "Scraping complete", 
      results: { seatgeek: sgRes, ticketmaster: tmRes, eventbrite: ebRes } 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
