import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Uses the sql method on the pool to avoid callable type signature errors
    const result = await sql`
      SELECT geoname_id, name, country_code, slug
      FROM cities
      LIMIT 10
      `;

    return NextResponse.json({
      ok: true,
      cities: result.rows || [],
    });
  } catch (error: any) {
    console.error("Test API route failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}