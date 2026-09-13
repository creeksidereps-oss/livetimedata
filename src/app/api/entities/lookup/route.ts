import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ ok: false, error: 'Entity name required' }, { status: 400 });
    }

    const cleanName = name.trim().toLowerCase();

    // Query entities table for matching entity or venue
    const result = await sql`
      SELECT id, name, entity_type, image_url, logo_url, website_url 
      FROM entities 
      WHERE (LOWER(name) = ${cleanName} OR LOWER(normalized_name) = ${cleanName} OR LOWER(name) LIKE ${'%' + cleanName + '%'})
        AND (image_url IS NOT NULL OR logo_url IS NOT NULL)
      ORDER BY 
        CASE WHEN LOWER(name) = ${cleanName} THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `;

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return NextResponse.json({
        ok: true,
        entity: {
          id: row.id,
          name: row.name,
          entityType: row.entity_type,
          imageUrl: row.image_url || row.logo_url,
          logoUrl: row.logo_url || row.image_url,
          websiteUrl: row.website_url,
        }
      });
    }

    return NextResponse.json({ ok: false, error: 'No banked graphic found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Lookup error' }, { status: 500 });
  }
}
