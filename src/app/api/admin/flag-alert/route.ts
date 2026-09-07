import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { cityName, stateName } = await request.json();

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "Missing location parameters" }, { status: 400 });
    }

    const city = cityName.trim();
    const state = stateName ? stateName.trim() : "System Context";

    console.log(`🚨 [WIDE-CAPTURE TRIGGERED]: Flag loading failed for ${city}, ${state}. Logging alert row.`);

    // Upsert a structural record noting the exact city coordinates/context missing a valid file match
    await sql`
      INSERT INTO city_reports (city_name, state_name, lat, lng, report_type, content, system_alert, created_at, updated_at)
      VALUES (${city}, ${state}, 0, 0, 'about', 'System pending asset alignment.', 'missing_flag', NOW(), NOW())
      ON CONFLICT (city_name, state_name, report_type)
      DO UPDATE SET system_alert = 'missing_flag', updated_at = NOW();
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("❌ Wide-capture logging error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}