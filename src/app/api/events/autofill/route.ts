import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { url, text } = await request.json();
    if (!url && !text) {
      return NextResponse.json({ ok: false, error: "No URL or text provided" }, { status: 400 });
    }

    let rawContent = "";

    if (url) {
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
      rawContent = htmlText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                           .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                           .substring(0, 50000);
    } else {
      rawContent = (text || "").substring(0, 20000);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract the event details from this source content:\n\n${rawContent}`,
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
    console.error("Autofill error:", error);
    return NextResponse.json({ ok: false, error: "AI failed to extract details from this input." }, { status: 500 });
  }
}
