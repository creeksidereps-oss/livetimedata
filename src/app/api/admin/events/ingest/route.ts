import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { publishEvent } from '@/lib/events/intake/publishEvent';

// Initialize the new Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System instructions to enforce the JSON schema.
// Transcription only: the model copies what the flyer/email says and never invents, infers or embellishes.
const SYSTEM_INSTRUCTION = `
You are an event data transcription assistant. Your job is to copy event details exactly as they appear in flyers, posters, or email text.
Never invent, infer, summarize or embellish. If a detail is not written in the material, return null for it.
You must return a raw JSON object (do not wrap in markdown code blocks) with the following strict structure:
{
  "title": "String - The name of the event, as written",
  "venueAddress": "String - Street address, as written",
  "cityName": "String - City where it takes place, as written (do NOT infer it)",
  "stateName": "String - State / province / region, as written (optional)",
  "countryName": "String - Country, as written (optional)",
  "category": "String - (e.g. Music, Sports, Theater, Festival, Charity)",
  "venue": "String - Name of the venue or location, as written",
  "startTime": "String - Start time as written (e.g. '7:00 PM')",
  "eventDate": "String - ISO Date YYYY-MM-DD",
  "details": "String - The descriptive text from the material, copied verbatim (do NOT write your own)",
  "confidenceScore": "Number - 0 to 100. Rate how confident you are that all details are accurate."
}
If a field is completely missing, return null for that field, but keep the key.
`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const textData = formData.get('text') as string | null;

    if (!imageFile && !textData) {
      return NextResponse.json({ error: 'Must provide either an image file or text data.' }, { status: 400 });
    }

    let eventFlyerUrl = null;
    let geminiContent: any[] = [];

    // 1. Process Text (Email Body)
    if (textData) {
      geminiContent.push({ text: `Please extract event details from this text:\n\n${textData}` });
    }

    // 2. Process Image (Flyer)
    if (imageFile) {
      // Save locally to public/uploads
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `flyer_${Date.now()}_${Math.floor(Math.random() * 1000)}.${imageFile.name.split('.').pop() || 'png'}`;
      const uploadDir = join(process.cwd(), 'public', 'uploads');
      const filepath = join(uploadDir, filename);
      await writeFile(filepath, buffer);
      
      eventFlyerUrl = `/uploads/${filename}`;

      // Convert image for Gemini API inline parsing
      geminiContent.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: imageFile.type
        }
      });
      geminiContent.push({ text: "Please extract event details from this flyer image." });
    }

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiContent,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1, // Keep it deterministic
        responseMimeType: "application/json"
      }
    });

    if (!response.text) {
      throw new Error("AI failed to return content.");
    }

    // Parse the JSON
    let aiData;
    try {
      aiData = JSON.parse(response.text);
    } catch (e) {
      throw new Error("AI returned invalid JSON: " + response.text);
    }

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    if (!str(aiData.eventDate)) {
      // No date = no listing (never default to today).
      return NextResponse.json({ error: 'No event date could be read from the material, so nothing was saved.', aiConfidence: aiData.confidenceScore }, { status: 422 });
    }

    // 4. Smart Routing Logic
    // If the AI is highly confident AND we have the core fields, it may go live (if publishEvent's rules pass).
    // Otherwise it is held for the admin queue.
    const isHighConfidence = aiData.confidenceScore && aiData.confidenceScore >= 90;
    const hasCoreFields = aiData.title && aiData.cityName && aiData.eventDate && aiData.venue;

    // 5. Insert through the single intake gate. Location = only what the material states; no defaults.
    const result = await publishEvent({
      origin: 'admin_curation',
      title: str(aiData.title),
      details: str(aiData.details),
      category: str(aiData.category) || 'General',
      venue: str(aiData.venue),
      venueAddress: str(aiData.venueAddress) || null,
      startTime: str(aiData.startTime),
      eventDate: str(aiData.eventDate),
      location: {
        city: str(aiData.cityName) || null,
        region: str(aiData.stateName) || null,
        country: str(aiData.countryName) || null,
        address: str(aiData.venueAddress) || null,
      },
      eventFlyerUrl,
      source: 'AI Ingestion Pipeline',
      forcePending: !(isHighConfidence && hasCoreFields),
    });

    if (result.outcome === 'rejected' || result.outcome === 'retry') {
      return NextResponse.json({
        error: `Event not saved (${result.outcome}): ${result.reasons.join(', ')}${result.detail ? ` - ${result.detail}` : ''}`,
        aiConfidence: aiData.confidenceScore,
        reasons: result.reasons,
      }, { status: result.outcome === 'retry' ? 503 : 422 });
    }

    const status = result.outcome === 'published' ? 'live' : result.outcome;
    return NextResponse.json({
      success: true,
      message: `Event ingested and routed to ${status}${result.reasons.length ? ` (${result.reasons.join(', ')})` : ''}`,
      aiConfidence: aiData.confidenceScore,
      reasons: result.reasons,
      event: {
        id: result.id,
        status,
        title: str(aiData.title),
        eventDate: str(aiData.eventDate),
        startTime: str(aiData.startTime),
        venue: str(aiData.venue),
        cityName: result.location?.cityName || str(aiData.cityName),
        category: str(aiData.category) || 'General',
        details: str(aiData.details),
        eventFlyerUrl,
      }
    });

  } catch (error: any) {
    console.error("AI Ingestion Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
