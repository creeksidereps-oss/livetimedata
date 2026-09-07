import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs'; // Node runtime needed for heavier API work

// Initialize SDK - Automatically looks for process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

export async function POST(request: Request) {
  try {
    const { base64Image, mimeType, cityName, stateName } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ ok: false, error: "No image payload provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "AI Engine Offline: GEMINI_API_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    // 1. Send the image to Gemini Vision to extract event data as JSON
    const prompt = `
      You are an expert event data extraction engine. 
      Analyze this event poster/flyer and extract the exact details into the following strict JSON schema. 
      
      Requirements:
      1. title: The name of the event
      2. category: Must be one of: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Other.
      3. venue: Name of the venue or location
      4. start_time: The start time, formatted perfectly like "6:30 PM" or "10:00 AM".
      5. event_date: The date of the event in standard YYYY-MM-DD format.
      6. details: A comprehensive description of the event.
      7. safety_flag: If this poster contains adult content, severe violence, or spam, set this to true. Otherwise false.
      8. confidence: A number from 0 to 1 representing how confident you are in your extraction.

      Output ONLY raw JSON. No markdown formatting blocks.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("AI returned empty data.");

    const extracted = JSON.parse(resultText);

    // 2. Autonomous Decision Engine (AI Auto-Approval Logic)
    // If confidence is high and there are no safety flags, it bypasses human curation.
    let status = 'pending_review';
    let source = 'AI Ingestion - Pending';

    if (extracted.confidence > 0.85 && extracted.safety_flag === false) {
      status = 'live';
      source = 'AI Auto-Approval';
    }

    // 3. Inject directly into the Postgres Database
    await sql`
      INSERT INTO events (
        title,
        city_name,
        state_name,
        category,
        venue,
        source,
        start_time,
        event_date,
        details,
        status,
        view_count
      ) VALUES (
        ${extracted.title || 'Unknown Event'},
        ${cityName || 'Unknown City'},
        ${stateName || ''},
        ${extracted.category || 'Other'},
        ${extracted.venue || 'Unknown Venue'},
        ${source},
        ${extracted.start_time || 'TBD'},
        ${extracted.event_date ? extracted.event_date + '::timestamp' : new Date().toISOString() + '::timestamp'},
        ${extracted.details || ''},
        ${status},
        0
      )
    `;

    return NextResponse.json({ 
      ok: true, 
      extracted, 
      finalStatus: status 
    });

  } catch (error: any) {
    console.error("AI VISION EXTRACTION ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process image through the AI Vision engine." },
      { status: 500 }
    );
  }
}
