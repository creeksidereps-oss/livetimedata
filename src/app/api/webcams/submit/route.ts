import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { scheduleCityContentProvisioning } from "@/lib/cityContentWorkflow";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    await sql`
      INSERT INTO webcams (
        city_name, state_name, kind, title, source, status, embed_url, image_url, is_premium
      ) VALUES (
        ${data.cityName}, 
        ${data.stateName}, 
        ${data.kind || 'external'}, 
        ${data.title}, 
        ${data.source || 'Public Submission'}, 
        'pending_review', 
        ${data.embedUrl || null}, 
        ${data.imageUrl || null}, 
        ${data.isPremium || false}
      )
    `;

    if (data.cityName) {
      scheduleCityContentProvisioning({
        cityName: data.cityName,
        admin1: data.stateName,
        country: data.country || "United States",
      });
    }

    return NextResponse.json({ ok: true, message: "Webcam submitted successfully for review." });
  } catch (error: any) {
    console.error("Webcam Submission Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
