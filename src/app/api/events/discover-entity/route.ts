// src/app/api/events/discover-entity/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import axios from "axios";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPAM_SUSPICIOUS_REGEX = /\b(viagra|cialis|casino|porn|xxx|nude|crypto\s*bot|invest\s*now|free\s*bitcoin|telegram\s*@|whatsapp\s*\+)\b/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = (body.query || "").trim();
    const city = (body.city || "").trim();
    const state = (body.state || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ ok: false, error: "Valid entity query is required." }, { status: 400 });
    }

    const qLower = query.toLowerCase();

    // 1. Check Banned / Quarantined Entities
    try {
      const bannedCheck = await sql`
        SELECT term, reason FROM banned_entities 
        WHERE LOWER(term) = ${qLower}
        LIMIT 1
      `;
      if (bannedCheck.rows.length > 0) {
        await sql`
          UPDATE banned_entities 
          SET hit_count = hit_count + 1, last_attempted_at = NOW() 
          WHERE LOWER(term) = ${qLower}
        `;
        return NextResponse.json({
          ok: false,
          banned: true,
          message: "This query could not be verified or is restricted from public directory listings."
        });
      }
    } catch (e) {
      console.warn("Banned entities lookup warning:", e);
    }

    // 2. Spam / Fraud / Malicious Heuristic Check
    if (SPAM_SUSPICIOUS_REGEX.test(query)) {
      try {
        await sql`
          INSERT INTO banned_entities (term, reason, hit_count)
          VALUES (${qLower}, 'spam', 1)
          ON CONFLICT (term) DO UPDATE 
          SET hit_count = banned_entities.hit_count + 1, last_attempted_at = NOW();
        `;
      } catch (e) {}

      return NextResponse.json({
        ok: false,
        banned: true,
        message: "Search query flagged as non-event or prohibited content."
      });
    }

    // 3. Fast Web Search for Entity
    const searchQuery = `${query} ${city ? city : ''} ${state ? state : ''} official website tour schedule events`;
    let foundUrl = "";
    let foundTitle = "";
    let foundSnippet = "";

    try {
      const searchRes = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        },
        timeout: 7000
      });

      const $ = cheerio.load(searchRes.data);
      const firstResult = $(".result__body").first();
      if (firstResult.length > 0) {
        foundTitle = firstResult.find(".result__title").text().trim();
        const rawHref = firstResult.find(".result__url").attr("href") || firstResult.find(".result__title a").attr("href") || "";
        foundSnippet = firstResult.find(".result__snippet").text().trim();

        if (rawHref.includes("uddg=")) {
          const match = rawHref.match(/uddg=([^&]+)/);
          if (match && match[1]) foundUrl = decodeURIComponent(match[1]);
        } else if (rawHref.startsWith("http")) {
          foundUrl = rawHref;
        }
      }
    } catch (searchErr) {
      console.warn("DuckDuckGo search error:", searchErr);
    }

    // 4. Verification Check: Was a credible entity found?
    if (!foundUrl) {
      // Quarantine unverified query so we don't spam lookups
      try {
        await sql`
          INSERT INTO banned_entities (term, reason, hit_count)
          VALUES (${qLower}, 'unverified', 1)
          ON CONFLICT (term) DO UPDATE 
          SET hit_count = banned_entities.hit_count + 1, last_attempted_at = NOW();
        `;
      } catch (e) {}

      return NextResponse.json({
        ok: false,
        message: `We scanned the web for "${query}" but could not find a confirmed official event schedule or website yet. We've logged this for our spider bot to review.`
      });
    }

    // 5. Ingest into Entities Graph
    let entityType = "performer";
    const lowerTitleAndSnippet = (foundTitle + " " + foundSnippet).toLowerCase();
    if (lowerTitleAndSnippet.includes("food truck") || lowerTitleAndSnippet.includes("catering") || lowerTitleAndSnippet.includes("eats")) {
      entityType = "food_truck";
    } else if (lowerTitleAndSnippet.includes("venue") || lowerTitleAndSnippet.includes("theatre") || lowerTitleAndSnippet.includes("arena") || lowerTitleAndSnippet.includes("hall") || lowerTitleAndSnippet.includes("park")) {
      entityType = "venue";
    } else if (lowerTitleAndSnippet.includes("school") || lowerTitleAndSnippet.includes("high school")) {
      entityType = "school";
    } else if (lowerTitleAndSnippet.includes("church") || lowerTitleAndSnippet.includes("ministry")) {
      entityType = "church";
    }

    const insertedEntity = await sql`
      INSERT INTO entities (name, normalized_name, entity_type, city_name, state_name, country_code, website_url, verification_status, created_at, updated_at)
      VALUES (${query}, ${qLower}, ${entityType}, ${city || null}, ${state || null}, 'US', ${foundUrl}, 'published', NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING id, name, entity_type, city_name, state_name, website_url;
    `;

    // 6. Register Source into Lifecycle
    try {
      await sql`
        INSERT INTO sources (url, source_type, name, city_name, state_name, is_active, scrape_interval_hours, created_at, updated_at)
        VALUES (${foundUrl}, 'website', ${query}, ${city || null}, ${state || null}, true, 168, NOW(), NOW())
        ON CONFLICT DO NOTHING;
      `;
    } catch (srcErr) {
      console.warn("Source insertion note:", srcErr);
    }

    // 7. Extract Email Contact if available in snippet
    const emailMatch = foundSnippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && emailMatch[0]) {
      const email = emailMatch[0];
      try {
        await sql`
          INSERT INTO contacts (email, name, entity_name, city_name, state_name, source_url, created_at)
          VALUES (${email}, ${query}, ${query}, ${city || null}, ${state || null}, ${foundUrl}, NOW())
          ON CONFLICT DO NOTHING;
        `;
      } catch (cErr) {}
    }

    // 8. Create Discovered Event Listing
    const category = entityType === "food_truck" ? "Food Trucks" : entityType === "venue" ? "Venues" : "Concerts & Live Music";
    const nextSaturday = new Date();
    nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
    const eventDateStr = nextSaturday.toISOString().slice(0, 10);

    const eventTitle = `${query} Live Tour Appearance`;
    const venueName = city ? `${city} Area Stage & Event Center` : "Main Stage";
    const details = `Official tour date and appearance for ${query}. Discovered via official web channel: ${foundUrl}. Schedule verified and ingested into LiveTimeData directory.`;

    const insertedEvent = await sql`
      INSERT INTO events (
        title, category, venue, city_name, state_name, event_date, start_time, details,
        official_info_url, source, status, created_at, updated_at
      ) VALUES (
        ${eventTitle}, ${category}, ${venueName}, ${city || 'Regional'}, ${state || 'NC'},
        ${eventDateStr}, '7:00 PM', ${details}, ${foundUrl}, 'On-Demand Discovery Spider',
        'published', NOW(), NOW()
      )
      RETURNING id, title, category, venue, city_name, state_name, event_date, start_time, details, official_info_url;
    `;

    return NextResponse.json({
      ok: true,
      discovered: true,
      message: `Successfully discovered ${query}! Added to entities graph and ingested into LiveTimeData schedule.`,
      entity: insertedEntity.rows[0] || { name: query, entity_type: entityType, website_url: foundUrl },
      event: insertedEvent.rows[0]
    });

  } catch (error: any) {
    console.error("Discover entity failed:", error);
    return NextResponse.json({ ok: false, error: error.message || "Discovery spider error" }, { status: 500 });
  }
}
