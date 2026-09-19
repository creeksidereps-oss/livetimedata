import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import * as cheerio from "cheerio";

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
    const { imageBase64, text, url, defaultCity, defaultState } = body;

    if (!imageBase64 && !text && !url) {
      return NextResponse.json(
        { ok: false, error: "Please provide an image, text note, or website URL." },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const eventItemSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Official title or headline of the event" },
        venueName: { type: Type.STRING, description: "Venue, park, business, or location name" },
        venueAddress: { type: Type.STRING, description: "Street address if visible or mentioned" },
        cityName: { type: Type.STRING, description: "City where the event takes place" },
        stateName: { type: Type.STRING, description: "State (e.g. North Carolina, NC, etc.)" },
        startTime: { type: Type.STRING, description: "Start time (e.g. 7:00 PM, 10:00 AM)" },
        eventDates: {
          type: Type.ARRAY,
          items: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          description: "Dates for this specific event. If relative (e.g. 'this Friday'), calculate relative to today's date."
        },
        category: {
          type: Type.STRING,
          description: `Must be one of: ${CATEGORIES.join(", ")}`
        },
        details: { type: Type.STRING, description: "Concise summary of admission/pricing, description, and highlights." },
        performers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of bands, artists, headliners, sports teams, or special guests performing."
        },
        officialInfoUrl: { type: Type.STRING, description: "Official website, ticket link, or event page URL if available." }
      },
      required: ["title", "venueName", "eventDates", "category"]
    };

    const rootSchema = {
      type: Type.OBJECT,
      properties: {
        events: {
          type: Type.ARRAY,
          items: eventItemSchema,
          description: "List of all distinct events found. If it's a schedule, monthly calendar, or lineup with multiple dates/performers, return each distinct event separately."
        }
      },
      required: ["events"]
    };

    let response;

    if (imageBase64) {
      // Option A: Flyer or Screenshot Vision Extraction
      const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      const mimeType = matches ? `image/${matches[1]}` : "image/jpeg";
      const base64Data = matches ? matches[2] : imageBase64;

      const prompt = `You are a high-speed event intelligence extraction AI.
Today's date is ${todayStr}.
Analyze this flyer, poster, or screenshot (which may be a social media post, website screenshot, or venue calendar).

CRITICAL INSTRUCTIONS:
1. If this image lists MULTIPLE DISTINCT EVENTS, PERFORMANCES, ACTS, OR CALENDAR DATES (e.g. a venue's monthly concert calendar, a festival lineup over multiple days, or several upcoming events), extract EVERY DISTINCT EVENT as an individual item in the 'events' array.
2. If this is a single event, return an array with 1 item.
3. Identify any performers, bands, artists, or speakers and list them in the 'performers' array.
4. If city or state are not in the image, default to: City="${defaultCity || ""}", State="${defaultState || ""}".
5. Ensure dates are strictly YYYY-MM-DD.`;

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
          responseSchema: rootSchema
        }
      });
    } else if (url) {
      // Option C: Web URL Scrape & Ingestion (while browsing during meetings/downtime)
      let pageText = "";
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          cache: "no-store"
        });
        const html = await pageRes.text();
        const $ = cheerio.load(html);
        $("script, style, noscript, nav, footer, header").remove();
        pageText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 15000);
      } catch (fetchErr) {
        console.warn("Direct page fetch failed, analyzing URL string alone:", fetchErr);
        pageText = `Event URL: ${url}`;
      }

      const prompt = `You are an event extraction AI for LiveTimeData.
Today's date is ${todayStr}.
Source URL: ${url}
Extracted Page Content:
"""${pageText}"""

Extract all upcoming events found on this page into the 'events' array.
Include officialInfoUrl: "${url}".
If city/state are not specified, use: City="${defaultCity || ""}", State="${defaultState || ""}".
Calculate relative dates to ${todayStr}. Formats must be YYYY-MM-DD.`;

      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: rootSchema
        }
      });
    } else {
      // Option B: Voice / Text Note Extraction
      const prompt = `You are an event extraction AI for LiveTimeData.
Today's date is ${todayStr}.
Parse this quick voice note, text, or copied message into structured events:
"""${text}"""

If multiple distinct events are described, extract each one as a separate item in the 'events' array.
Default to: City="${defaultCity || ""}", State="${defaultState || ""}" if not specified.
Calculate relative dates like "this Saturday", "tomorrow", or "next Friday" relative to today (${todayStr}).
Format dates as YYYY-MM-DD.`;

      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: rootSchema
        }
      });
    }

    const parsedJson = JSON.parse(response.text || "{}");
    const rawEvents: any[] = Array.isArray(parsedJson.events) ? parsedJson.events : [];

    // Normalize each event
    const events = rawEvents.map((ev: any) => {
      return {
        title: ev.title || "Untitled Event",
        venueName: ev.venueName || "Local Venue",
        venueAddress: ev.venueAddress || "",
        cityName: ev.cityName || defaultCity || "",
        stateName: ev.stateName || defaultState || "",
        startTime: ev.startTime || "TBD",
        eventDates: Array.isArray(ev.eventDates) && ev.eventDates.length > 0 ? ev.eventDates : [todayStr],
        category: CATEGORIES.includes(ev.category) ? ev.category : "Community & Civic",
        details: ev.details || "",
        performers: Array.isArray(ev.performers) ? ev.performers : [],
        officialInfoUrl: ev.officialInfoUrl || (url ? url : "")
      };
    });

    return NextResponse.json({ ok: true, events, count: events.length });
  } catch (error: any) {
    console.error("Quick parse error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to parse event details" },
      { status: 500 }
    );
  }
}
