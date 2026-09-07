import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

// Strips out space and character anomalies so database matches are flawless every single time
function clean(val: any) {
  return String(val || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

// Custom delay utility for our background retry system
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, type = 'about', countryName = 'Global' } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    const cityName = clean(body.cityName);
    const stateName = clean(body.stateName);
    
    // Cost-Saving Regional Cache Override for Holidays
    const queryCityName = type === 'holidays' ? 'REGION_HOLIDAY' : cityName;
    const queryStateName = type === 'holidays' ? `${stateName}_${countryName}` : stateName;

    console.log(`🔎 Library Check Execution: ${queryCityName}, ${queryStateName} [${type}]`);

    // 1. SURGICAL MATCH AGAINST ACTIVE NEON-COQUELICOT-RIBBON SCHEMA
    const { rows } = await sql`
      SELECT content FROM city_reports 
      WHERE city_name = ${queryCityName} 
      AND state_name = ${queryStateName} 
      AND report_type = ${type}
      LIMIT 1
    `;

    if (rows.length > 0 && rows[0].content && rows[0].content.length > 100) {
      console.log(`✅ [LIBRARY HIT]: Stored record pulled for ${cityName} [${type}]`);
      return NextResponse.json({ report: rows[0].content, cached: true });
    }

    // 2. PRODUCTION AI ENGINE AUTONOMOUS RECOVERY STRATEGY (Fallback if data isn't cached yet)
    console.log(`📡 [AI GENERATE]: Compiling backup report asset for ${queryCityName} [${type}]`);
    
    const todayStr = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date());
    let prompt = "";
    
    if (type === 'facts') {
      prompt = `Provide 12 verified fun facts about ${cityName}, ${stateName}. You MUST use Google Search Grounding to verify every single fact. DO NOT hallucinate or invent history. If deep historical facts are scarce, you MUST provide real geographic data (exact lat/long, elevation, climate, regional geography, demographics). Use **Bold Titles** for each item and number them 1-12. CRITICAL: Do NOT include any introductory or concluding sentences (like "Here are 12 facts..."). Start immediately with "1. **[Title]**".`;
    } else if (type === 'on_this_day') {
      prompt = `Today is ${todayStr}. Provide a bulleted list of 10 verified historical events that occurred on this exact date in history, focusing primarily on ${cityName}, ${stateName}, or ${countryName}. You MUST use Google Search Grounding to verify every single event. DO NOT hallucinate or invent dates. If local history is scarce, include verified major national or global events. Format with clean bold dates.`;
    } else if (type === 'holidays') {
      prompt = `Write a verified travel and cultural guide to the national and regional holidays celebrated in ${stateName}, ${countryName}. You MUST use Google Search Grounding to verify every holiday and date. DO NOT hallucinate. CRITICAL: You must include a future planning calendar showing the exact dates for all mentioned holidays for the next 3 years (2026, 2027, and 2028). Use ### for headers.`;
    } else {
      prompt = `Write a factual City Intelligence Report for ${cityName}, ${stateName}. You MUST use Google Search Grounding to verify all geographic, demographic, and cultural data. DO NOT hallucinate. Focus on real atmosphere, local character, climate, and precise location. Use ### for section headers. CRITICAL: Do NOT output a top-level title or # header for the report itself (e.g., do not write "City Intelligence Report: [City]"). Start immediately with the first ### section header.`;
    }

    let aiRes: Response | null = null;
    let retries = 3;
    let delayMs = 1500; // Wait 1.5 seconds before retrying a 503 spike

    // Background Retry Execution Frame Loop
    while (retries > 0) {
      aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }] 
          })
        }
      );

      // If Google returns a 503 (High Demand), do not crash—silently pause and retry
      if (aiRes.status === 503) {
        console.warn(`⏳ [AI SERVER BUSY 503]: High demand spike encountered. Retrying in ${delayMs}ms... (${retries} attempts remaining)`);
        retries--;
        await delay(delayMs);
        delayMs *= 2; // Exponential backoff spacing expansion
        continue;
      }

      break;
    }

    if (!aiRes || !aiRes.ok) {
      const errorText = aiRes ? await aiRes.text() : "No server response context reached.";
      throw new Error(`AI Engine gateway rejected request: ${errorText}`);
    }

    const data = await aiRes.json();
    const reportText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (reportText) {
      // 3. ARCHIVE UPSERT CORRECTION LAYER
      try {
        await sql`
          INSERT INTO city_reports (city_name, state_name, lat, lng, report_type, content, created_at, updated_at)
          VALUES (${queryCityName}, ${queryStateName}, ${lat}, ${lng}, ${type}, ${reportText}, NOW(), NOW())
          ON CONFLICT (city_name, state_name, report_type) 
          DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
        `;
        console.log(`💾 [LIBRARY SAVE]: Successfully archived new context entry for ${queryCityName} [${type}]`);
      } catch (e: any) {
        console.error("❌ ARCHIVE SAVE FAILED:", e.message);
      }
      return NextResponse.json({ report: reportText, cached: false });
    }
    throw new Error("AI engine parsed response returned empty metadata frames.");
  } catch (err: any) {
    console.error("❌ ROUTE PIPELINE FAULT:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}