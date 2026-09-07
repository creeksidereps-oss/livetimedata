import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // In the future, this would be routed through Gemini for security checks first.
    // For now, it inserts directly into webcams with a 'pending_review' status.

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

    return NextResponse.json({ ok: true, message: "Webcam submitted successfully for review." });
  } catch (error: any) {
    console.error("Webcam Submission Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
