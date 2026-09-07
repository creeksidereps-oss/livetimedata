import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ ok: false, error: "No URL provided" }, { status: 400 });
    }

    // Cost-Saving Pre-Flight Check
    const existingCheck = await sql`
      SELECT id FROM events 
      WHERE official_info_url = ${url} OR social_urls ILIKE '%' || ${url} || '%' OR affiliate_url = ${url} OR registration_url = ${url}
      LIMIT 1
    `;

    if (existingCheck.rows.length > 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "This event has already been submitted to our database! Save your AI credits!" 
      });
    }

    // Fetch the raw HTML
    const fetchRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    const htmlText = await fetchRes.text();
    
    if (htmlText.includes("Access Denied") || htmlText.includes("Cloudflare") || htmlText.includes("Security check")) {
      return NextResponse.json({ 
        ok: false, 
        error: "This website actively blocks automated AI reading. Please fill out the form manually." 
      });
    }

    // Strip major scripts to save token context
    const cleanText = htmlText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract the event details from this HTML:\n\n${cleanText.substring(0, 50000)}`,
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
              description: "Must be chosen from: Festivals, Concerts, Sports, Venues, Tours, Lectures, Local, Clubs / Groups, Conventions, Holiday, Arts, Kids, Seniors, Other"
            }
          },
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");

    return NextResponse.json({ ok: true, event: parsedJson });
  } catch (error: any) {
    console.error("Autofill error:", error);
    return NextResponse.json({ ok: false, error: "AI failed to extract details from this link." }, { status: 500 });
  }
}
