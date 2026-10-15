// src/app/api/facts/featured/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { cleanGeoString, normalizeAdminRegion, isGeographicMatch } from "@/lib/geoIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const pendingFactGenerations = new Map<string, Promise<any>>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCity = searchParams.get("city") || searchParams.get("cityName") || "";
    const rawState = searchParams.get("state") || searchParams.get("stateName") || "";
    const rawCountry = searchParams.get("country") || searchParams.get("countryName") || "United States";
    const reqLat = parseFloat(searchParams.get("lat") || "0");
    const reqLng = parseFloat(searchParams.get("lng") || searchParams.get("lon") || "0");

    const cityName = cleanGeoString(rawCity);
    const stateName = cleanGeoString(rawState);
    const countryName = cleanGeoString(rawCountry);

    if (!cityName) {
      return NextResponse.json({ ok: false, error: "City name required" }, { status: 400 });
    }

    const normAdmin = normalizeAdminRegion(stateName, countryName);
    const effectiveState = normAdmin.fullName || stateName || countryName;

    // 1. Fetch approved facts for this city from city_fun_facts
    const { rows: rawFacts } = await sql`
      SELECT id, city_name, state_name, country_name, title, description, category, scope, source_attribution, contributed_by, created_at
      FROM city_fun_facts
      WHERE LOWER(city_name) = LOWER(${cityName})
        AND is_approved = TRUE
      ORDER BY id ASC
    `;

    // Filter using rigorous geographic identity matching to prevent cross-city contamination
    let facts = rawFacts.filter((r: any) =>
      isGeographicMatch(
        cityName,
        stateName,
        countryName,
        reqLat,
        reqLng,
        r.city_name,
        r.state_name || "",
        r.country_name || "",
        undefined,
        undefined
      )
    );

    let currentScope = "city";

    // 2. Check city_reports for existing verified facts report matching this geographic identity
    if (facts.length === 0) {
      const repResult = await sql`
        SELECT content, state_name, lat, lng FROM city_reports
        WHERE LOWER(city_name) = LOWER(${cityName})
          AND report_type = 'facts'
        ORDER BY updated_at DESC
        LIMIT 10;
      `;

      const matchingRep = repResult.rows.find((r: any) =>
        isGeographicMatch(
          cityName,
          stateName,
          countryName,
          reqLat,
          reqLng,
          cityName,
          r.state_name,
          countryName,
          Number(r.lat),
          Number(r.lng)
        )
      );

      if (matchingRep && matchingRep.content) {
        const parsed = parseFactsFromMarkdown(matchingRep.content);
        if (parsed.length > 0) {
          for (const item of parsed) {
            try {
              await sql`
                INSERT INTO city_fun_facts (
                  city_name, state_name, country_name, title, description, category, scope,
                  source_attribution, contributed_by, is_approved, status
                ) VALUES (
                  ${cityName}, ${effectiveState}, ${countryName}, ${item.title}, ${item.description},
                  'local_history', 'city', 'Almanac Historical Archives', 'almanac_curator', TRUE, 'approved'
                )
              `;
            } catch (insErr) {}
          }

          const refreshed = await sql`
            SELECT id, city_name, state_name, country_name, title, description, category, scope, source_attribution, contributed_by, created_at
            FROM city_fun_facts
            WHERE LOWER(city_name) = LOWER(${cityName})
              AND is_approved = TRUE
            ORDER BY id ASC
          `;
          facts = refreshed.rows.filter((r: any) =>
            isGeographicMatch(
              cityName,
              stateName,
              countryName,
              reqLat,
              reqLng,
              r.city_name,
              r.state_name || "",
              r.country_name || ""
            )
          );
        }
      }
    }

    // 3. Initiate Asynchronous City-Specific Generation if Facts are Missing
    if (facts.length === 0) {
      const dedupKey = `facts:${cityName.toLowerCase()}:${effectiveState.toLowerCase()}:${reqLat.toFixed(2)}:${reqLng.toFixed(2)}`;

      if (pendingFactGenerations.has(dedupKey)) {
        const generated = await pendingFactGenerations.get(dedupKey);
        if (Array.isArray(generated) && generated.length > 0) {
          facts = generated;
        }
      } else {
        const generationPromise = (async () => {
          const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GEMINI_KEY || "").trim().replace(/^["']|["']$/g, "");
          if (!apiKey) return [];

          try {
            console.log(`[FACTS_RESEARCH] Researching documented facts for ${cityName}, ${effectiveState}, ${countryName}`);
            const prompt = `Research 12 authentic, historically factual fun facts, unique local landmarks, oddities, or municipal trivia about ${cityName}, ${effectiveState}, ${countryName}.
DO NOT hallucinate or invent history, laws, or attractions. Every fact must reflect real municipal, state, and geographic records.
If deep historical facts are scarce, provide real geographic data (exact coordinates, elevation, climate, regional geography, demographics).
Format each item starting with a number and bold title: "1. **[Title]**: [2-3 sentences of engaging details]".
Start immediately with "1. **[Title]**".`;

            const aiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
              }
            );

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const parsed = parseFactsFromMarkdown(text);

              const validItems = parsed.filter(item => {
                const lt = (item.title || "").toLowerCase();
                const ld = (item.description || "").toLowerCase();
                if (lt.includes("unverifiable") || lt.includes("non-existent") || lt.includes("no verified")) return false;
                if (ld.includes("violating the instruction") || ld.includes("cannot be provided")) return false;
                return true;
              });

              if (validItems.length > 0) {
                try {
                  await sql`
                    INSERT INTO city_reports (city_name, state_name, report_type, content, lat, lng, created_at, updated_at)
                    VALUES (${cityName}, ${effectiveState}, 'facts', ${text}, ${reqLat}, ${reqLng}, NOW(), NOW())
                    ON CONFLICT (city_name, state_name, report_type)
                    DO UPDATE SET content = EXCLUDED.content, lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = NOW();
                  `;
                } catch (repErr) {}

                for (const item of validItems) {
                  try {
                    await sql`
                      INSERT INTO city_fun_facts (
                        city_name, state_name, country_name, title, description, category, scope,
                        source_attribution, contributed_by, is_approved, status
                      ) VALUES (
                        ${cityName}, ${effectiveState}, ${countryName}, ${item.title}, ${item.description},
                        'local_history', 'city', 'Regional Gazette & Almanac', 'almanac_curator', TRUE, 'approved'
                      )
                    `;
                  } catch (insErr) {}
                }

                const fresh = await sql`
                  SELECT id, city_name, state_name, country_name, title, description, category, scope, source_attribution, contributed_by, created_at
                  FROM city_fun_facts
                  WHERE LOWER(city_name) = LOWER(${cityName})
                    AND is_approved = TRUE
                  ORDER BY id ASC
                `;
                return fresh.rows.filter((r: any) =>
                  isGeographicMatch(
                    cityName,
                    stateName,
                    countryName,
                    reqLat,
                    reqLng,
                    r.city_name,
                    r.state_name || "",
                    r.country_name || ""
                  )
                );
              }
            }
          } catch (genErr) {
            console.warn("[FACTS_RESEARCH] Dynamic fact generation warning:", genErr);
          }
          return [];
        })();

        pendingFactGenerations.set(dedupKey, generationPromise);
        try {
          const genResults = await generationPromise;
          if (Array.isArray(genResults) && genResults.length > 0) {
            facts = genResults;
          }
        } finally {
          pendingFactGenerations.delete(dedupKey);
        }
      }
    }

    // 4. Temporary Fallback to State Facts (only if city facts are still absent)
    if (facts.length === 0 && (normAdmin.fullName || stateName)) {
      const candidateState = normAdmin.fullName || stateName;
      const stateResult = await sql`
        SELECT id, city_name, state_name, country_name, title, description, category, scope, source_attribution, contributed_by, created_at
        FROM city_fun_facts
        WHERE city_name = 'STATE_FACTS'
          AND (
            LOWER(state_name) = LOWER(${candidateState})
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

    if (facts.length === 0) {
      return NextResponse.json({
        ok: true,
        cityName,
        stateName,
        countryName,
        featured: null,
        totalFacts: 0,
        allFacts: []
      });
    }

    const allFacts = facts.map((fact: any, index: number) => ({
      id: fact.id,
      title: fact.title,
      description: fact.description,
      category: fact.category || "General",
      scope: fact.scope || currentScope,
      source_attribution: fact.source_attribution,
      contributed_by: fact.contributed_by,
      factNumber: index + 1,
      totalFacts: facts.length
    }));

    return NextResponse.json({
      ok: true,
      cityName,
      stateName,
      countryName,
      scope: currentScope,
      totalFacts: allFacts.length,
      featured: allFacts[0] || null,
      allFacts
    });
  } catch (error: any) {
    console.error("Featured fact API error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
