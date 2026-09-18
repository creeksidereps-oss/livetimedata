// src/app/api/facts/featured/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(val: any): string {
  return String(val || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = searchParams.get("city") || "";
    const rawState = searchParams.get("state") || "";
    const rawCountry = searchParams.get("country") || "United States";

    const cityName = clean(rawCity);
    const stateName = clean(rawState);
    const countryName = clean(rawCountry);

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "City name required" }, { status: 400 });
    }

    const cityKey = `${cityName.toLowerCase()}_${stateName.toLowerCase()}`;

    // 1. Fetch all approved facts for this city
    let { rows: facts } = await sql`
      SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
      FROM city_fun_facts
      WHERE LOWER(city_name) = LOWER(${cityName})
        AND is_approved = TRUE
      ORDER BY id ASC
    `;

    let currentScope = "city";

    // 2. Fallback hierarchy: If no city facts yet, check state facts
    if (facts.length === 0 && stateName) {
      const stateResult = await sql`
        SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
        FROM city_fun_facts
        WHERE city_name = 'STATE_FACTS'
          AND LOWER(state_name) = LOWER(${stateName})
          AND is_approved = TRUE
        ORDER BY id ASC
      `;
      if (stateResult.rows.length > 0) {
        facts = stateResult.rows;
        currentScope = "state";
      }
    }

    // 3. Fallback hierarchy: If still 0 facts, check verified National / Global curiosities from the database
    if (facts.length === 0) {
      const nationalResult = await sql`
        SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
        FROM city_fun_facts
        WHERE scope = 'national'
          AND is_approved = TRUE
        ORDER BY id ASC
      `;
      if (nationalResult.rows.length > 0) {
        facts = nationalResult.rows;
        currentScope = "national";
      }
    }

    // 4. Default National Oddity Fallback if still empty
    if (facts.length === 0) {
      facts = [
        {
          id: 0,
          title: "The Prime Meridian Alignment",
          description: "All global civil timekeeping and longitudinal mapping coordinates are measured relative to the Prime Meridian line established at the Royal Observatory in Greenwich, dividing the eastern and western hemispheres of planet Earth.",
          category: "world_record",
          scope: "national"
        }
      ];
      currentScope = "national";
    }

    // 5. Atomic Global Turn Increment Across All Users
    let turnIndex = 0;
    try {
      const rotResult = await sql`
        INSERT INTO city_fact_rotations (city_key, current_index, last_rotated_at)
        VALUES (${cityKey}, 1, NOW())
        ON CONFLICT (city_key)
        DO UPDATE SET current_index = city_fact_rotations.current_index + 1, last_rotated_at = NOW()
        RETURNING current_index
      `;
      if (rotResult.rows.length > 0) {
        turnIndex = rotResult.rows[0].current_index;
      }
    } catch (rotErr) {
      console.warn("Fact rotation counter warning:", rotErr);
    }

    // 6. Select Featured Fact for this Global Turn
    const selectedIdx = (turnIndex - 1 + facts.length) % facts.length;
    const featuredFact = {
      ...facts[selectedIdx],
      factNumber: selectedIdx + 1,
      totalFacts: facts.length,
      scope: currentScope,
      cityName,
      stateName
    };

    return NextResponse.json({
      ok: true,
      cityName,
      stateName,
      featured: featuredFact,
      totalFacts: facts.length,
      allFacts: facts.map((f: any, idx: number) => ({
        ...f,
        factNumber: idx + 1
      }))
    });
  } catch (error: any) {
    console.error("Featured fact route error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to load fact" }, { status: 500 });
  }
}
