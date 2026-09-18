// src/app/api/cron/facts-research/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { researchCityFactsWithAI } from "@/lib/facts/factVerifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 60-Day City Facts Research & Curation Worker
 * 
 * CORE RESPONSIBILITIES:
 * 1. 6-Month Legal/Pattern Retention Hygiene:
 *    Automatically purges declined facts older than 6 months.
 * 2. 60-Day City Discovery:
 *    Finds searched cities due for factual research.
 * 3. AI 3-Way Curation Triage:
 *    - APPROVED: Verified factual by search grounding -> Auto-approved into live rotation.
 *    - REJECTED: False / Policy violation -> Logged in declined database for 6 months.
 *    - NEEDS_HUMAN_CURATION: Inconclusive -> Held over for human curation.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "3", 10);

    // 1. Purge expired declined records (older than 6 months)
    const purgeResult = await sql`
      DELETE FROM city_fun_facts_declined 
      WHERE expires_at <= NOW()
      RETURNING id
    `;
    const purgedCount = purgeResult.rows.length;

    // 2. Find cities due for 60-day research cycle
    const { rows: dueCities } = await sql`
      SELECT city_key, last_researched_at, last_searched_at
      FROM city_fact_rotations
      WHERE last_researched_at IS NULL 
         OR last_researched_at < NOW() - INTERVAL '60 days'
      ORDER BY last_searched_at DESC NULLS LAST
      LIMIT ${limit}
    `;

    if (dueCities.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `Retention purge cleaned ${purgedCount} expired records. No cities currently due for 60-day research.`,
        purgedDeclinedRecords: purgedCount,
        processed: 0
      });
    }

    const report: any[] = [];

    for (const cityRow of dueCities) {
      const parts = cityRow.city_key.split("_");
      const cityName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "";
      const stateName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";
      const countryName = "United States";

      if (!cityName) continue;

      let approvedCount = 0;
      let rejectedCount = 0;
      let humanHoldCount = 0;

      // 3. Research candidate facts with search-grounded AI
      const candidates = await researchCityFactsWithAI(cityName, stateName, countryName);

      for (const item of candidates) {
        const { verdict } = item;

        if (verdict.verdict === 'APPROVED') {
          // AI directly approves what it finds to be verified factual
          const existing = await sql`
            SELECT id FROM city_fun_facts 
            WHERE LOWER(city_name) = LOWER(${cityName}) 
              AND LOWER(title) = LOWER(${item.title})
            LIMIT 1
          `;

          if (existing.rows.length === 0) {
            await sql`
              INSERT INTO city_fun_facts (
                city_name, state_name, country_name, title, description, category, scope,
                source_attribution, contributed_by, is_approved, status,
                ai_verification_notes, ai_grounded_sources
              ) VALUES (
                ${cityName}, ${stateName}, ${countryName}, ${item.title}, ${item.description},
                ${verdict.category}, 'city', ${verdict.sources[0] || 'AI Grounded Search'},
                'ai_verified', TRUE, 'approved',
                ${verdict.reason}, ${JSON.stringify(verdict.sources)}
              )
            `;
            approvedCount++;
          }
        } else if (verdict.verdict === 'REJECTED') {
          // AI declines what it finds to be false or against policy -> Log to declined DB (6-month hold)
          await sql`
            INSERT INTO city_fun_facts_declined (
              city_name, state_name, country_name, title, description, category,
              source_attribution, contributed_by, rejection_reason, ai_confidence, ai_notes
            ) VALUES (
              ${cityName}, ${stateName}, ${countryName}, ${item.title}, ${item.description},
              ${verdict.category}, ${verdict.sources[0] || 'AI Audit'}, 'ai_researcher',
              ${verdict.reason}, ${verdict.confidence}, ${JSON.stringify(verdict.sources)}
            )
          `;
          rejectedCount++;
        } else {
          // Inconclusive -> Held over for human curation
          const existing = await sql`
            SELECT id FROM city_fun_facts 
            WHERE LOWER(city_name) = LOWER(${cityName}) 
              AND LOWER(title) = LOWER(${item.title})
            LIMIT 1
          `;

          if (existing.rows.length === 0) {
            await sql`
              INSERT INTO city_fun_facts (
                city_name, state_name, country_name, title, description, category, scope,
                source_attribution, contributed_by, is_approved, status,
                ai_verification_notes, ai_grounded_sources
              ) VALUES (
                ${cityName}, ${stateName}, ${countryName}, ${item.title}, ${item.description},
                ${verdict.category}, 'city', ${verdict.sources[0] || 'Pending Verification'},
                'ai_inconclusive', FALSE, 'needs_human_curation',
                ${verdict.reason}, ${JSON.stringify(verdict.sources)}
              )
            `;
            humanHoldCount++;
          }
        }
      }

      // 4. Update last_researched_at to start the next 60-day cycle
      await sql`
        UPDATE city_fact_rotations 
        SET last_researched_at = NOW() 
        WHERE city_key = ${cityRow.city_key}
      `;

      report.push({
        city: cityName,
        aiApproved: approvedCount,
        aiRejectedToDeclinedDB: rejectedCount,
        heldForHumanCuration: humanHoldCount
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${dueCities.length} cities. Purged ${purgedCount} expired declined records.`,
      purgedDeclinedRecords: purgedCount,
      report
    });

  } catch (error: any) {
    console.error("Facts research cron error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
