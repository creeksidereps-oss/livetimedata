import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db'; 

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryName = searchParams.get('countryName');

    if (!countryName) {
      return NextResponse.json(
        { success: false, error: 'Missing countryName parameter' },
        { status: 400 }
      );
    }

    // Convert special characters to standard English matching formats instantly
    // This bridges the gap between 'Türkiye' and your database asset naming structures
    const cleanCountry = countryName
      .trim()
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U');

    // Executing standard tagged template literal query to ensure absolute syntax safety
    const result = await sql`
      SELECT country_name, asset_filename, aspect_ratio 
      FROM country_flags 
      WHERE country_name = ${cleanCountry}
      OR LOWER(country_name) LIKE ${'%' + cleanCountry.toLowerCase() + '%'}
      LIMIT 1;
    `;

    if (!result || !result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `No asset configuration found for country: ${countryName}` },
        { status: 404 }
      );
    }

    const flagRecord = result.rows[0];

    return NextResponse.json({
      success: true,
      country: flagRecord.country_name,
      videoUrl: `/assets/flags/${flagRecord.asset_filename}`,
      aspectRatio: flagRecord.aspect_ratio
    }, { status: 200 });

  } catch (error) {
    console.error('Database query failure during flag retrieval:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server data error' },
      { status: 500 }
    );
  }
}