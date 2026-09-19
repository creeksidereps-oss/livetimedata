import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lonStr = searchParams.get("lon");

    if (!latStr || !lonStr) {
      return NextResponse.json({ ok: false, error: "Missing lat/lon parameters" }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ ok: false, error: "Invalid coordinates" }, { status: 400 });
    }

    // 1. Try BigDataCloud reverse geocode client (fast, reliable, free)
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        { headers: { "User-Agent": "LiveTimeData/1.0" }, cache: "no-store" }
      );
      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        const city = bdc.city || bdc.locality || bdc.principalSubdivisionDescription || "";
        const state = bdc.principalSubdivision || "";
        if (city) {
          return NextResponse.json({ ok: true, city, state, country: bdc.countryCode || "US" });
        }
      }
    } catch (e) {
      console.warn("BigDataCloud reverse geocode error:", e);
    }

    // 2. Try Nominatim OpenStreetMap fallback
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "User-Agent": "LiveTimeData-GPS/1.0" }, cache: "no-store" }
      );
      if (nomRes.ok) {
        const nom = await nomRes.json();
        const addr = nom.address || {};
        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || "";
        const state = addr.state || "";
        if (city) {
          return NextResponse.json({ ok: true, city, state, country: addr.country_code?.toUpperCase() || "US" });
        }
      }
    } catch (e) {
      console.warn("Nominatim reverse geocode error:", e);
    }

    // 3. Fallback: Query nearest city in Neon database
    try {
      const dbRes = await sql`
        SELECT name, admin1
        FROM cities
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY (
          (latitude - ${lat}) * (latitude - ${lat}) +
          (longitude - ${lon}) * (longitude - ${lon})
        ) ASC
        LIMIT 1
      `;
      if (dbRes.rows.length > 0) {
        return NextResponse.json({
          ok: true,
          city: dbRes.rows[0].name,
          state: dbRes.rows[0].admin1 || "",
          country: "US"
        });
      }
    } catch (e) {
      console.warn("DB nearest city error:", e);
    }

    return NextResponse.json({ ok: false, error: "Could not determine city" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
