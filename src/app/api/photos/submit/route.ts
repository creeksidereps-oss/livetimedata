import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    await sql`
      INSERT INTO photos (
        city_name, state_name, title, image_url, source, photographer_name, rights_released, status
      ) VALUES (
        ${data.cityName}, 
        ${data.stateName}, 
        ${data.title}, 
        ${data.imageUrl}, 
        ${data.source || 'User Submission'}, 
        ${data.photographerName || null}, 
        ${data.rightsReleased || false}, 
        'pending_review'
      )
    `;

    return NextResponse.json({ ok: true, message: "Photo submitted successfully for review." });
  } catch (error: any) {
    console.error("Photo Submission Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
