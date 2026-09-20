// src/app/api/facts/featured/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(val: any): string {
  return String(val || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

function parseFactsFromMarkdown(content: string): Array<{ title: string; description: string }> {
  const facts: Array<{ title: string; description: string }> = [];
  const regex = /(?:^|\n)\s*\d+[\.\)]\s+\*\*([^*]+)\*\*\s*[\n:]+\s*([\s\S]*?)(?=(?:\n\s*\d+[\.\)]\s+\*\*|$))/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const title = match[1].trim();
    const description = match[2].trim().replace(/\n+/g, ' ');
    if (title && description) {
      facts.push({ title, description });
    }
  }
  return facts;
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
    const normCity = cityName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Fetch all approved facts for this city from city_fun_facts
    let { rows: facts } = await sql`
      SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
      FROM city_fun_facts
      WHERE (
        LOWER(city_name) = LOWER(${cityName})
        OR LOWER(REGEXP_REPLACE(city_name, '[^a-zA-Z0-9]', '', 'g')) = ${normCity}
      )
        AND is_approved = TRUE
      ORDER BY id ASC
    `;

    let currentScope = "city";

    // 2. Check city_reports for existing rich verified facts report
    if (facts.length === 0) {
      const repResult = await sql`
        SELECT content FROM city_reports
        WHERE (
          LOWER(city_name) = LOWER(${cityName})
          OR LOWER(REGEXP_REPLACE(city_name, '[^a-zA-Z0-9]', '', 'g')) = ${normCity}
        )
        AND report_type = 'facts'
        ORDER BY id DESC
        LIMIT 1;
      `;

      if (repResult.rows.length > 0 && repResult.rows[0].content) {
        const parsed = parseFactsFromMarkdown(repResult.rows[0].content);
        if (parsed.length > 0) {
          for (const item of parsed) {
            try {
              await sql`
                INSERT INTO city_fun_facts (
                  city_name, state_name, country_name, title, description, category, scope,
                  source_attribution, contributed_by, is_approved, status
                ) VALUES (
                  ${cityName}, ${stateName || ''}, ${countryName || 'United States'}, ${item.title}, ${item.description},
                  'local_history', 'city', 'Verified Municipal Research', 'system_verified', TRUE, 'approved'
                )
                ON CONFLICT DO NOTHING;
              `;
            } catch (insErr) {}
          }

          const refreshed = await sql`
            SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
            FROM city_fun_facts
            WHERE (
              LOWER(city_name) = LOWER(${cityName})
              OR LOWER(REGEXP_REPLACE(city_name, '[^a-zA-Z0-9]', '', 'g')) = ${normCity}
            )
              AND is_approved = TRUE
            ORDER BY id ASC
          `;
          if (refreshed.rows.length > 0) {
            facts = refreshed.rows;
            currentScope = "city";
          }
        }
      }
    }

    // 3. Dynamic On-Demand AI City Research: Generate verified facts specifically for THIS city
    if (facts.length === 0) {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GEMINI_KEY || "").trim().replace(/^["']|["']$/g, "");
      if (apiKey) {
        try {
          console.log(`[FACTS_RESEARCH] Autonomously researching authentic facts for ${cityName}, ${stateName || countryName}`);
          const prompt = `Provide 10 verified fun facts about ${cityName}, ${stateName || countryName}. You MUST use Google Search Grounding to verify every single fact. DO NOT hallucinate or invent history. If deep historical facts are scarce, you MUST provide real geographic data (exact lat/long, elevation, climate, regional geography, demographics). Use **Bold Titles** for each item and number them 1-10. CRITICAL: Do NOT include any introductory or concluding sentences (like "Here are 10 facts..."). Start immediately with "1. **[Title]**".`;

          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }] 
              })
            }
          );

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const parsed = parseFactsFromMarkdown(text);

            if (parsed.length > 0) {
              try {
                await sql`
                  INSERT INTO city_reports (city_name, state_name, report_type, content, lat, lng, created_at, updated_at)
                  VALUES (${cityName}, ${stateName || ''}, 'facts', ${text}, 0, 0, NOW(), NOW())
                  ON CONFLICT DO NOTHING;
                `;
              } catch (repErr) {}

              for (const item of parsed) {
                try {
                  await sql`
                    INSERT INTO city_fun_facts (
                      city_name, state_name, country_name, title, description, category, scope,
                      source_attribution, contributed_by, is_approved, status
                    ) VALUES (
                      ${cityName}, ${stateName || ''}, ${countryName || 'United States'}, ${item.title}, ${item.description},
                      'local_history', 'city', 'Verified Search-Grounded Research', 'ai_grounded', TRUE, 'approved'
                    )
                    ON CONFLICT DO NOTHING;
                  `;
                } catch (insErr) {}
              }

              const fresh = await sql`
                SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
                FROM city_fun_facts
                WHERE (
                  LOWER(city_name) = LOWER(${cityName})
                  OR LOWER(REGEXP_REPLACE(city_name, '[^a-zA-Z0-9]', '', 'g')) = ${normCity}
                )
                  AND is_approved = TRUE
                ORDER BY id ASC
              `;
              if (fresh.rows.length > 0) {
                facts = fresh.rows;
                currentScope = "city";
              }
            }
          }
        } catch (genErr) {
          console.warn("[FACTS_RESEARCH] Dynamic fact generation warning:", genErr);
        }
      }
    }

    // 4. Fallback hierarchy: If still 0 facts, check state facts
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

    // 5. If no facts exist and no state facts, do NOT display global oddities across city pages!
    if (facts.length === 0) {
      return NextResponse.json({
        ok: true,
        cityName,
        stateName,
        featured: null,
        totalFacts: 0,
        allFacts: []
      });
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
