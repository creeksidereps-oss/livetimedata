import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT * FROM user_contributions 
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ contributions: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}