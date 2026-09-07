import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, failedUrl } = body;

    if (!failedUrl) {
      return NextResponse.json({ error: 'failedUrl is required' }, { status: 400 });
    }

    // Direct RAW SQL Insert into telemetry table
    await sql`
      INSERT INTO broken_links (event_id, failed_url, failure_timestamp)
      VALUES (${eventId || null}, ${failedUrl}, NOW());
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to log iframe telemetry:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
