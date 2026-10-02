import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawImage = body.imageBase64 || body.image;
    if (!rawImage) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }

    // Extract the raw base64 data without the data:image/png;base64, prefix
    const matches = rawImage.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ ok: false, error: "Invalid image format" }, { status: 400 });
    }
    
    const mimeType = `image/${matches[1]}`;
    const base64Data = matches[2];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract the event details from this flyer/image/QR. If this is a concert series, festival series, or recurring event that lists multiple dates, extract EVERY single date shown and add them all to the eventDates array. Do not miss any dates. Extract the actual city and state/country where the event takes place without guessing." },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            venueName: { type: Type.STRING },
            venueAddress: { type: Type.STRING },
            cityName: { 
              type: Type.STRING, 
              description: "City or town where event occurs. NEVER guess or default to Statesville NC unless explicitly stated." 
            },
            stateName: { 
              type: Type.STRING, 
              description: "State, province, or region (e.g. NC, CA, Île-de-France). Leave blank if international without states." 
            },
            countryName: { 
              type: Type.STRING, 
              description: "Country name e.g. United States, United Kingdom, France, Australia." 
            },
            details: { type: Type.STRING },
            startTime: { type: Type.STRING },
            eventDates: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING, description: "Format: YYYY-MM-DD" } 
            },
            categories: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Must be chosen from: Concerts, Festivals, Food Trucks, Yard / Garage Sales, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Parades, Other. CRITICAL: Do NOT lump every event happening at a festival into 'Festivals'. Musical performances/bands must be 'Concerts', food vendor rallies must be 'Food Trucks', running events must be 'Sports', art exhibits must be 'Arts'."
            }
          },
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");

    return NextResponse.json({ ok: true, event: parsedJson });
  } catch (error: any) {
    console.error("Autofill Image error:", error);
    return NextResponse.json({ ok: false, error: "AI failed to extract details from this image." }, { status: 500 });
  }
}
