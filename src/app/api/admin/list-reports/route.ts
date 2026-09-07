import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

// We use force-dynamic to ensure the catalogue is always live and updated
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // This SQL command fetches every report in the catalogue, newest first
    const { rows } = await sql`
      SELECT id, city_name, state_name, lat, lng, created_at 
      FROM city_reports 
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ ok: true, reports: rows });
  } catch (error: any) {
    console.error("Catalogue Fetch Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}