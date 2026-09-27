import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const city = searchParams.get('city');

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ ok: false, error: 'Entity name required' }, { status: 400 });
    }

    const cleanName = name.trim().toLowerCase();

    // 1. Query entities table for matching entity, venue, or performer
    const result = await sql`
      SELECT id, name, entity_type, image_url, logo_url, website_url, phone, email, city_name, state_name
      FROM entities 
      WHERE (LOWER(name) = ${cleanName} OR LOWER(normalized_name) = ${cleanName} OR LOWER(name) LIKE ${'%' + cleanName + '%'})
        AND (image_url IS NOT NULL OR logo_url IS NOT NULL)
      ORDER BY 
        CASE WHEN LOWER(name) = ${cleanName} THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `;

    // 2. Look up known street address from events or sources if available
    let knownAddress: string | null = null;
    try {
      const addressQuery = city
        ? await sql`
            SELECT venue_address FROM events
            WHERE LOWER(TRIM(city_name)) = ${city.trim().toLowerCase()}
              AND (LOWER(venue) = ${cleanName} OR LOWER(hosting_entity) = ${cleanName} OR LOWER(venue) LIKE ${'%' + cleanName + '%'})
              AND venue_address IS NOT NULL AND LENGTH(TRIM(venue_address)) > 5
            ORDER BY id DESC LIMIT 1
          `
        : await sql`
            SELECT venue_address FROM events
            WHERE (LOWER(venue) = ${cleanName} OR LOWER(hosting_entity) = ${cleanName} OR LOWER(venue) LIKE ${'%' + cleanName + '%'})
              AND venue_address IS NOT NULL AND LENGTH(TRIM(venue_address)) > 5
            ORDER BY id DESC LIMIT 1
          `;

      if (addressQuery.rows && addressQuery.rows.length > 0) {
        knownAddress = addressQuery.rows[0].venue_address;
      }
    } catch {
      // Non-blocking fallback
    }

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
          phone: row.phone,
          email: row.email,
          address: knownAddress,
        }
      });
    }

    // If no entity image was found, but a known address was resolved, return the address
    if (knownAddress) {
      return NextResponse.json({
        ok: true,
        entity: {
          name: cleanName,
          address: knownAddress,
        }
      });
    }

    return NextResponse.json({ ok: false, error: 'No banked entity found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Lookup error' }, { status: 500 });
  }
}
