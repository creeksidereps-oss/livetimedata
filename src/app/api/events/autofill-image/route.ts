import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }

    // Extract the raw base64 data without the data:image/png;base64, prefix
    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
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
            { text: "Extract the event details from this flyer/image/QR. If this is a concert series, festival series, or recurring event that lists multiple dates, extract EVERY single date shown and add them all to the eventDates array. Do not miss any dates." },
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
            details: { type: Type.STRING },
            startTime: { type: Type.STRING },
            eventDates: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING, description: "Format: YYYY-MM-DD" } 
            },
            categories: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Must be chosen from: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Parades, Other"
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
