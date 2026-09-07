import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, city_name, state_name, lat, lng, report_type, content, created_at 
      FROM city_reports 
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ reports: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}