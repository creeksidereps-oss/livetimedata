import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") || "live";
    const q = url.searchParams.get("q");
    
    let webcams;
    if (q) {
      const searchStr = `%${q}%`;
      const result = await sql`
        SELECT * FROM webcams 
        WHERE status = ${statusFilter} 
        AND (city_name ILIKE ${searchStr} OR state_name ILIKE ${searchStr} OR country ILIKE ${searchStr} OR title ILIKE ${searchStr})
        ORDER BY id DESC LIMIT 500
      `;
      webcams = result.rows;
    } else {
      const result = await sql`
        SELECT * FROM webcams 
        WHERE status = ${statusFilter}
        ORDER BY id DESC LIMIT 500
      `;
      webcams = result.rows;
    }
    
    return NextResponse.json({ ok: true, webcams });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { city_name, state_name, country, kind, title, embed_url, status = 'live' } = await req.json();
    const source = embed_url.includes('youtube') ? 'YouTube' : (embed_url.includes('p4panorama') ? 'P4Panorama' : 'Admin');
    
    await sql`
      INSERT INTO webcams (city_name, state_name, country, kind, title, source, status, embed_url, display_order, is_premium)
      VALUES (${city_name}, ${state_name}, ${country}, ${kind}, ${title}, ${source}, ${status}, ${embed_url}, 100, true)
    `;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, status, city_name, state_name, country, kind, display_order } = await req.json();
    if (!id) throw new Error("ID required");

    const orderVal = display_order ? parseInt(display_order) : 100;

    if (kind) {
      await sql`
        UPDATE webcams 
        SET status = ${status}, city_name = ${city_name}, state_name = ${state_name}, country = ${country}, kind = ${kind}, display_order = ${orderVal}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE webcams 
        SET status = ${status}, city_name = ${city_name}, state_name = ${state_name}, country = ${country}, display_order = ${orderVal}
        WHERE id = ${id}
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("ID required");

    await sql`DELETE FROM webcams WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
