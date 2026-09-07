import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Initialize the new Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System instructions to enforce the JSON schema
const SYSTEM_INSTRUCTION = `
You are an expert event data extraction assistant. Your job is to extract event details from flyers, posters, or email text.
You must return a raw JSON object (do not wrap in markdown code blocks) with the following strict structure:
{
  "title": "String - The name of the event",
  "cityName": "String - City where it takes place (infer from venue if not explicit)",
  "stateName": "String - State (optional)",
  "category": "String - (e.g. Music, Sports, Theater, Festival, Charity)",
  "venue": "String - Name of the venue or location",
  "startTime": "String - Time (e.g. '7:00 PM', 'Doors open 6pm')",
  "eventDate": "String - ISO Date YYYY-MM-DD",
  "details": "String - A nice paragraph describing the event",
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

    // 4. Smart Routing Logic
    // If the AI is highly confident AND we have the core fields, mark it live. Otherwise, send to admin queue.
    const isHighConfidence = aiData.confidenceScore && aiData.confidenceScore >= 90;
    const hasCoreFields = aiData.title && aiData.cityName && aiData.eventDate && aiData.venue;
    const status = (isHighConfidence && hasCoreFields) ? 'live' : 'pending_review';

    // 5. Insert into Database
    // Convert YYYY-MM-DD string to Date object
    const parsedDate = aiData.eventDate ? new Date(aiData.eventDate) : new Date();

    const result = await db.insert(events).values({
      title: aiData.title || 'Untitled Event',
      cityName: aiData.cityName || 'Unknown City',
      stateName: aiData.stateName || null,
      category: aiData.category || 'General',
      venue: aiData.venue || 'TBD',
      startTime: aiData.startTime || 'TBD',
      eventDate: parsedDate,
      details: aiData.details || 'No details provided.',
      eventFlyerUrl: eventFlyerUrl,
      source: 'AI Ingestion Pipeline',
      status: status
    }).returning();

    return NextResponse.json({
      success: true,
      message: `Event ingested and routed to ${status}`,
      aiConfidence: aiData.confidenceScore,
      event: result[0]
    });

  } catch (error: any) {
    console.error("AI Ingestion Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
