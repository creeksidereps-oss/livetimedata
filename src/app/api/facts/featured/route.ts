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

function computeFactPriority(fact: { title?: string; description?: string; category?: string }): number {
  const t = (fact.title || "").toLowerCase();
  const d = (fact.description || "").toLowerCase();
  const c = (fact.category || "").toLowerCase();

  // Tier 0: Dry fallback facts (coordinates, elevation, climate, population numbers)
  if (
    t.includes("coordinate") ||
    t.includes("elevation") ||
    t.includes("climate") ||
    t.includes("latitude") ||
    t.includes("longitude") ||
    t.includes("demographic") ||
    t.includes("subtropical") ||
    d.includes("above sea level") ||
    d.includes("climate (cfa)") ||
    d.includes("latitude and")
  ) {
    return 0;
  }

  // Tier 2: Top high-engagement themes (Laws, Records, Inventions, Presidents/Celebrity, Oddities/Ghosts)
  if (
    t.includes("law") ||
    t.includes("illegal") ||
    t.includes("ordinance") ||
    t.includes("record") ||
    t.includes("guinness") ||
    t.includes("invent") ||
    t.includes("president") ||
    t.includes("ghost") ||
    t.includes("haunt") ||
    t.includes("weird") ||
    t.includes("bizarre") ||
    t.includes("first") ||
    t.includes("largest") ||
    t.includes("smallest") ||
    t.includes("underwear") ||
    t.includes("legend") ||
    t.includes("scandal") ||
    c.includes("oddity") ||
    c.includes("world_record") ||
    c.includes("discovery") ||
    c.includes("quirk") ||
    c.includes("roadside_oddity") ||
    c.includes("product_birthplace") ||
    c.includes("historical_first") ||
    c.includes("strange_but_true") ||
    c.includes("notable_origin")
  ) {
    return 2;
  }

  // Tier 1: General local history & milestones
  return 1;
}

const US_STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia"
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = searchParams.get("city") || "";
    const rawState = searchParams.get("state") || "";
    const rawCountry = searchParams.get("country") || "United States";

    const cityName = clean(rawCity);
    const stateName = clean(rawState);
    const fullStateName = (stateName.length === 2 ? US_STATE_MAP[stateName.toUpperCase()] : "") || stateName;
    const countryName = clean(rawCountry);

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "City name required" }, { status: 400 });
    }

    const cityKey = `${cityName.toLowerCase()}_${(fullStateName || stateName).toLowerCase()}`;
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
                  'local_history', 'city', 'Almanac Historical Archives', 'almanac_curator', TRUE, 'approved'
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

    // 3. Fallback hierarchy: If 0 city facts exist, check curated state oddities FIRST
    const stateCandidate = fullStateName || stateName;
    if (facts.length === 0 && stateCandidate) {
      const stateResult = await sql`
        SELECT id, title, description, category, scope, source_attribution, contributed_by, created_at
        FROM city_fun_facts
        WHERE city_name = 'STATE_FACTS'
          AND (
            LOWER(state_name) = LOWER(${stateCandidate})
            OR LOWER(state_name) = LOWER(${stateName})
          )
          AND is_approved = TRUE
        ORDER BY id ASC
      `;
      if (stateResult.rows.length > 0) {
        facts = stateResult.rows;
        currentScope = "state";
      }
    }

    // 4. Dynamic On-Demand AI City Research: Only if both city and state facts are absent
    if (facts.length === 0) {
      const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GEMINI_KEY || "").trim().replace(/^["']|["']$/g, "");
      if (apiKey) {
        try {
          console.log(`[FACTS_RESEARCH] Researching documented oddities for ${cityName}, ${stateName || countryName}`);
          const prompt = `Research high-interest local oddities, strange trivia, roadside attractions, and municipal history about ${cityName}, ${stateName || countryName}.
PRIORITIZE THESE HIGH-ENGAGEMENT THEMES FIRST (inspired by Weird America, Guinness World Records, Ripley's Believe It or Not, Famous Inventions, and Notable American Lore):
1. Bizarre Local Laws, Quirky Ordinances & Strange Legal History
2. Famous Inventions, Food Origins & American Firsts
3. World Records, Massive Objects, Roadside Curiosities & Feats
4. Notable Historical Figure Oddities, Scandals & Local Folklore
5. Ghost Legends, Eccentric Landmarks & Folklore

CRITICAL INSTRUCTIONS:
- Every fact must be grounded in real-world public records, local history archives, or published encyclopedias. DO NOT invent, hallucinate, or make up people, dates, or events.
- If this is a very small town without documented oddities, only provide factual geographical milestones. Do NOT invent oddities.
- Never output meta-commentary like "Location Unverifiable" or "Non-Existent Location" or "No facts found".
- Format each item starting with a number and bold title: "1. **[Punchy Title]**: [2-3 sentences of engaging details]".
- Start immediately with "1. **[Title]**".`;

          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }]
              })
            }
          );

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const parsed = parseFactsFromMarkdown(text);

            // Filter out any meta-commentary or refusal responses
            const validItems = parsed.filter(item => {
              const lt = (item.title || "").toLowerCase();
              const ld = (item.description || "").toLowerCase();
              if (lt.includes("unverifiable") || lt.includes("non-existent") || lt.includes("lack of documented") || lt.includes("no verified") || lt.includes("not a recognized")) return false;
              if (ld.includes("violating the instruction") || ld.includes("as per strict") || ld.includes("cannot be provided") || ld.includes("no such facts can be")) return false;
              return true;
            });

            if (validItems.length > 0) {
              try {
                await sql`
                  INSERT INTO city_reports (city_name, state_name, report_type, content, lat, lng, created_at, updated_at)
                  VALUES (${cityName}, ${stateName || ''}, 'facts', ${text}, 0, 0, NOW(), NOW())
                  ON CONFLICT DO NOTHING;
                `;
              } catch (repErr) {}

              for (const item of validItems) {
                try {
                  await sql`
                    INSERT INTO city_fun_facts (
                      city_name, state_name, country_name, title, description, category, scope,
                      source_attribution, contributed_by, is_approved, status
                    ) VALUES (
                      ${cityName}, ${stateName || ''}, ${countryName || 'United States'}, ${item.title}, ${item.description},
                      'local_history', 'city', 'Regional Gazette & Almanac', 'almanac_curator', TRUE, 'approved'
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

    // 5. If no facts exist and no state facts, return empty
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

    // 6. Strict Priority Sorting:
    // Tier 2 (Juicy oddities, weird laws, inventions, records, presidents/scandals) -> AT TOP
    // Tier 1 (General history & landmarks) -> IN MIDDLE
    // Tier 0 (Dry fallback: coordinates, elevation, climate, population) -> CACHED AT VERY BOTTOM
    facts.sort((a: any, b: any) => {
      const pA = computeFactPriority(a);
      const pB = computeFactPriority(b);
      if (pA !== pB) return pB - pA;
      return (a.id || 0) - (b.id || 0);
    });

    // 7. Atomic Global Turn Increment Across All Users
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

    // 8. Select Featured Fact:
    // Biased towards Tier 2 & Tier 1 facts so dry items only appear if nothing else exists!
    const primeFacts = facts.filter((f: any) => computeFactPriority(f) > 0);
    const rotationPool = primeFacts.length > 0 ? primeFacts : facts;

    const selectedIdx = (turnIndex - 1 + rotationPool.length) % rotationPool.length;
    const featuredFactItem = rotationPool[selectedIdx];
    const originalFactNumber = facts.findIndex((f: any) => f.id === featuredFactItem.id) + 1;

    const featuredFact = {
      ...featuredFactItem,
      factNumber: originalFactNumber > 0 ? originalFactNumber : selectedIdx + 1,
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
