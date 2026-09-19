import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = [
  "Concerts",
  "Festivals",
  "Arts",
  "Sports",
  "Community & Civic",
  "Yard / Garage Sales",
  "Kids",
  "Holiday",
  "Nightlife",
  "Comedy",
  "Lectures",
  "Tours",
  "Clubs / Groups",
  "Other"
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageBase64, text, defaultCity, defaultState } = body;

    if (!imageBase64 && !text) {
      return NextResponse.json({ ok: false, error: "Please provide an image or text note." }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Official name/title of the event" },
        venueName: { type: Type.STRING, description: "Venue, park, business, or location name" },
        venueAddress: { type: Type.STRING, description: "Street address if available" },
        cityName: { type: Type.STRING, description: "City where event takes place" },
        stateName: { type: Type.STRING, description: "State (e.g. North Carolina, NC, etc.)" },
        startTime: { type: Type.STRING, description: "Start time (e.g. 7:00 PM, 10:00 AM)" },
        eventDates: {
          type: Type.ARRAY,
          items: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          description: "All upcoming dates for this event. If relative (e.g. 'this Saturday'), calculate based on today's date."
        },
        details: { type: Type.STRING, description: "Concise summary of what the event is, admission/pricing if mentioned, and key details." },
        category: {
          type: Type.STRING,
          description: `Must be one of: ${CATEGORIES.join(", ")}`
        }
      },
      required: ["title", "venueName", "eventDates", "category"]
    };

    let response;

    if (imageBase64) {
      // Option A: Image OCR / Vision Extraction
      const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      const mimeType = matches ? `image/${matches[1]}` : "image/jpeg";
      const base64Data = matches ? matches[2] : imageBase64;

      const prompt = `You are a high-speed event data extraction AI. 
Today's date is ${todayStr}.
Analyze this flyer, poster, or photo. Extract event details accurately into JSON.
If city or state are not mentioned on the flyer, use: City="${defaultCity || ""}", State="${defaultState || ""}".
Ensure dates are in YYYY-MM-DD format. If this is a recurring series or multiple dates are listed, include all of them.`;

      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    } else {
      // Option B: Voice / Text Note Extraction
      const prompt = `You are an event extraction AI for LiveTimeData.
Today's date is ${todayStr}.
Parse this quick voice note or text into structured event details:
"""${text}"""

If city or state are not in the text, use: City="${defaultCity || ""}", State="${defaultState || ""}".
Calculate relative dates like "this Saturday", "tomorrow", or "next Friday" relative to today (${todayStr}).
Format dates as YYYY-MM-DD.`;

      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    }

    const parsedJson = JSON.parse(response.text || "{}");

    // Apply fallbacks if AI didn't catch city/state
    if (!parsedJson.cityName && defaultCity) parsedJson.cityName = defaultCity;
    if (!parsedJson.stateName && defaultState) parsedJson.stateName = defaultState;
    if (!parsedJson.eventDates || parsedJson.eventDates.length === 0) {
      parsedJson.eventDates = [todayStr];
    }
    if (!parsedJson.category || !CATEGORIES.includes(parsedJson.category)) {
      parsedJson.category = "Community & Civic";
    }

    return NextResponse.json({ ok: true, event: parsedJson });
  } catch (error: any) {
    console.error("Quick parse error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to parse event details" }, { status: 500 });
  }
}
