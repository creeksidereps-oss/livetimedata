import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { publishEvent } from '@/lib/events/intake/publishEvent';

export const runtime = 'nodejs'; // Node runtime needed for heavier API work

// Initialize SDK - Automatically looks for process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

export async function POST(request: Request) {
  try {
    // cityName/stateName are accepted for backward compatibility but are only the page the uploader was on.
    // The event's location comes from the flyer itself (or stays empty and the event is held for review).
    const { base64Image, mimeType } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ ok: false, error: "No image payload provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "AI Engine Offline: GEMINI_API_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    // 1. Send the image to Gemini Vision to TRANSCRIBE the flyer (read only; never write or guess content)
    const prompt = `
      You are an event flyer transcription engine.
      Read this event poster/flyer and copy the details that are actually printed on it into the strict JSON schema below.
      Never invent, infer, summarize or embellish. If something is not printed on the flyer, return an empty string for it.

      Requirements:
      1. title: The name of the event, as printed
      2. category: Must be one of: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Other.
      3. venue: Name of the venue, as printed
      4. venue_address: Street address, as printed
      5. city: City / town, as printed
      6. region: State / province / region, as printed
      7. country: Country, as printed
      8. start_time: The start time as printed, formatted like "6:30 PM" or "10:00 AM". Empty if not printed.
      9. event_date: The date of the event in YYYY-MM-DD format. Empty if no date is printed.
      10. details: The descriptive text printed on the flyer, copied verbatim. Empty if there is none.
      11. safety_flag: If this poster contains adult content, severe violence, or spam, set this to true. Otherwise false.
      12. confidence: A number from 0 to 1 representing how confident you are in your transcription.

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
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    if (!str(extracted.event_date)) {
      // No date on the flyer = no listing (never default to today).
      return NextResponse.json({ ok: false, extracted, finalStatus: 'rejected', reasons: ['date_missing'], error: 'No event date could be read from the flyer.' }, { status: 422 });
    }

    // 2. AI moderation only: low confidence or a safety flag forces human review. publishEvent() decides the rest.
    const forcePending = !(Number(extracted.confidence) > 0.85 && extracted.safety_flag === false);

    // 3. Publish through the single intake gate (location verification, date/time rules, dedup)
    const result = await publishEvent({
      origin: 'vision',
      title: str(extracted.title),
      details: str(extracted.details),
      category: str(extracted.category) || 'Other',
      venue: str(extracted.venue),
      venueAddress: str(extracted.venue_address) || null,
      startTime: str(extracted.start_time),
      eventDate: str(extracted.event_date),
      location: {
        city: str(extracted.city) || null,
        region: str(extracted.region) || null,
        country: str(extracted.country) || null,
        address: str(extracted.venue_address) || null,
      },
      source: forcePending ? 'AI Ingestion - Pending' : 'AI Flyer Transcription',
      forcePending,
    });

    const finalStatus = result.outcome === 'published' ? 'live' : result.outcome;
    return NextResponse.json({
      ok: result.outcome !== 'rejected' && result.outcome !== 'retry',
      extracted,
      finalStatus,
      id: result.id,
      reasons: result.reasons,
      detail: result.detail,
    });

  } catch (error: any) {
    console.error("AI VISION EXTRACTION ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process image through the AI Vision engine." },
      { status: 500 }
    );
  }
}
