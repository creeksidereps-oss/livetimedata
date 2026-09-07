import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { city_name, state_name, content, lat, lng, report_type = 'about' } = await req.json();

    // SAFETY GATE: If there is no content, don't try to save a blank report
    if (!content || content.length < 10) {
      return NextResponse.json({ ok: true, message: "Skipped empty save" });
    }

    const cleanCity = String(city_name || "").replace(/\+/g, " ").trim();
    const cleanState = String(state_name || "").replace(/\+/g, " ").trim();

    await sql`
      INSERT INTO city_reports (city_name, state_name, content, lat, lng, report_type)
      VALUES (${cleanCity}, ${cleanState}, ${content}, ${lat}, ${lng}, ${report_type})
      ON CONFLICT (city_name, state_name, report_type) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Save Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}