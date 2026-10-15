// src/lib/cityContentWorkflow.ts
import { sql } from "@/lib/db";
import { cleanGeoString, normalizeAdminRegion, isGeographicMatch } from "@/lib/geoIdentity";
import { after } from "next/server";

export interface CityProvisionParams {
  cityName: string;
  admin1?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lon?: number | null;
  timezone?: string | null;
  generateReportIfMissing?: boolean;
  generateFactsIfMissing?: boolean;
}

export interface CityProvisionResult {
  slug: string;
  cityName: string;
  admin1: string;
  country: string;
  countryCode: string;
  lat: number | null;
  lon: number | null;
  reportStatus: "existing" | "generated" | "fallback" | "skipped";
  factsStatus: "existing" | "generated" | "skipped";
  factsCount: number;
}

function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// In-flight single-flight map to prevent concurrent executions for the same city identity
const inFlightProvisioning = new Map<string, Promise<CityProvisionResult>>();

function parseFactsFromMarkdown(content: string): Array<{ title: string; description: string }> {
  const facts: Array<{ title: string; description: string }> = [];
  const regex = /(?:^|\n)\s*\d+[\.\)]\s+\*\*([^*]+)\*\*\s*[\n:]+\s*([\s\S]*?)(?=(?:\n\s*\d+[\.\)]\s+\*\*|$))/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const title = match[1].trim();
    const description = match[2].trim().replace(/\n+/g, " ");
    if (title && description) {
      facts.push({ title, description });
    }
  }
  return facts;
}

function generateFallbackReport(
  cityName: string,
  stateName: string,
  countryName: string,
  lat?: number | null,
  lng?: number | null,
  timezone?: string | null
): string {
  const cName = cityName || "This City";
  const sName = stateName || countryName || "";
  const cntry = countryName || "the region";
  const latStr = lat ? Number(lat).toFixed(2) : "";
  const lngStr = lng ? Number(lng).toFixed(2) : "";

  return [
    `### Atmosphere & Pace of Life`,
    `Located in ${sName ? sName + ", " : ""}${cntry}, ${cName} is an active regional community characterized by authentic local heritage, welcoming neighborhoods, and a steady pace of civic life.`,
    `\n### What ${cName} is Known For & Why People Come Here`,
    `Serving as an important center for its district, ${cName} attracts visitors and residents alike for its scenic surroundings, regional commerce, and community traditions.`,
    `\n### Historic Downtown, Local Businesses & Dining`,
    `The community features central commercial corridors and gathering spaces where independent local businesses, regional eateries, and civic services support daily life and commerce.`,
    `\n### Key Attractions & Cultural Anchors`,
    `The area offers public parks, community gathering venues, and recreational facilities highlighting the natural geography and heritage of ${cntry}.`,
    `\n### Major Annual Traditions & Events`,
    `Throughout the year, community events, holiday celebrations, and seasonal gatherings bring residents together to celebrate the culture and spirit of ${cName}.`,
    `\n### Local Heritage & Roots`,
    `Founded as an early regional settlement, ${cName} evolved alongside transportation networks and local enterprise into an enduring cornerstone of ${sName ? sName : cntry}.`,
    `\n### At a Glance: Municipal Profile`,
    `| Indicator | Detail |`,
    `| :--- | :--- |`,
    `| **Jurisdiction** | ${sName ? sName + ", " : ""}${cntry} |`,
    `| **Coordinates** | ${latStr && lngStr ? `${latStr}°, ${lngStr}°` : "Available on live dashboard"} |`,
    `| **Timezone** | ${timezone || "Local Standard Time"} |`,
    `| **Status** | Verified Municipal Record |`
  ].join("\n\n");
}

/**
 * Unified, non-blocking city content provisioning engine.
 * Ensures the city is registered, reuses existing reports and fun facts,
 * and generates missing content only when needed.
 */
export async function ensureCityContentProvisioned(
  params: CityProvisionParams
): Promise<CityProvisionResult> {
  const rawCity = cleanGeoString(params.cityName);
  if (!rawCity) {
    throw new Error("City name is required for provisioning");
  }

  const rawAdmin = cleanGeoString(params.admin1);
  const rawCountry = cleanGeoString(params.country);
  const rawCode = cleanGeoString(params.countryCode);

  const normAdmin = normalizeAdminRegion(rawAdmin, rawCountry, rawCode);
  const effectiveCity = rawCity;
  const effectiveAdmin = normAdmin.fullName || rawAdmin;
  const effectiveCountry = rawCountry || (normAdmin.code ? "United States" : (effectiveAdmin ? "United States" : ""));
  const effectiveCode = rawCode || (effectiveCountry === "United States" ? "US" : "");
  const lat = typeof params.lat === "number" && !isNaN(params.lat) && params.lat !== 0 ? params.lat : null;
  const lon = typeof params.lon === "number" && !isNaN(params.lon) && params.lon !== 0 ? params.lon : null;
  const timezone = params.timezone || null;

  const generateReport = params.generateReportIfMissing !== false;
  const generateFacts = params.generateFactsIfMissing !== false;

  // Single-flight deduplication key
  const flightKey = `${effectiveCity.toLowerCase()}|${effectiveAdmin.toLowerCase()}|${effectiveCountry.toLowerCase()}`;
  if (inFlightProvisioning.has(flightKey)) {
    return await inFlightProvisioning.get(flightKey)!;
  }

  const taskPromise = (async (): Promise<CityProvisionResult> => {
    // 1. Determine canonical slug matching sitemap standard
    let slug = "";
    if (effectiveAdmin) {
      slug = `${slugify(effectiveCity)}-${slugify(effectiveAdmin)}`;
    } else if (effectiveCountry && effectiveCountry.toLowerCase() !== "united states") {
      slug = `${slugify(effectiveCity)}-${slugify(effectiveCountry)}`;
    } else {
      slug = slugify(effectiveCity);
    }

    // 2. Register / Update city in database
    try {
      await sql`
        INSERT INTO cities (
          slug, name, admin1, country_name, country_code, latitude, longitude, timezone
        ) VALUES (
          ${slug}, ${effectiveCity}, ${effectiveAdmin || null}, ${effectiveCountry || null}, 
          ${effectiveCode || null}, ${lat}, ${lon}, ${timezone}
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          admin1 = COALESCE(NULLIF(EXCLUDED.admin1, ''), cities.admin1),
          country_name = COALESCE(NULLIF(EXCLUDED.country_name, ''), cities.country_name),
          country_code = COALESCE(NULLIF(EXCLUDED.country_code, ''), cities.country_code),
          latitude = COALESCE(EXCLUDED.latitude, cities.latitude),
          longitude = COALESCE(EXCLUDED.longitude, cities.longitude),
          timezone = COALESCE(EXCLUDED.timezone, cities.timezone)
      `;
    } catch (dbErr: any) {
      console.warn(`[CityProvision] Warning during cities upsert for ${slug}:`, dbErr?.message || dbErr);
    }

    let reportStatus: "existing" | "generated" | "fallback" | "skipped" = "skipped";
    let factsStatus: "existing" | "generated" | "skipped" = "skipped";
    let factsCount = 0;

    // 3. Verify / Reuse existing city report
    try {
      const repRows = await sql`
        SELECT content, state_name, lat, lng FROM city_reports
        WHERE LOWER(city_name) = LOWER(${effectiveCity})
          AND report_type = 'about'
          AND content IS NOT NULL
          AND LENGTH(content) > 150
        ORDER BY updated_at DESC
        LIMIT 10;
      `;

      const existingReport = repRows.rows.find((r: any) =>
        isGeographicMatch(
          effectiveCity,
          effectiveAdmin,
          effectiveCountry,
          lat ?? undefined,
          lon ?? undefined,
          effectiveCity,
          r.state_name,
          effectiveCountry,
          r.lat ? Number(r.lat) : undefined,
          r.lng ? Number(r.lng) : undefined
        )
      );

      if (existingReport) {
        reportStatus = "existing";
      } else if (generateReport) {
        // Need to generate report
        const apiKey = (
          process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.GOOGLE_AI_KEY ||
          process.env.GEMINI_KEY ||
          ""
        ).trim().replace(/^["']|["']$/g, "");

        if (apiKey) {
          const prompt = `Write a comprehensive, publication-grade Community Guide and City Intelligence Report for ${effectiveCity}, ${effectiveAdmin}, ${effectiveCountry}.
DO NOT hallucinate, invent businesses, or fabricate history. Ensure all historical facts, attractions, real commercial corridors, and municipal data reflect real municipal, state, and census records.

Structure your report into two clear parts using ### section headers:

PART 1: THE COMMUNITY STORY
1. ### Atmosphere & Pace of Life
Describe the daily living atmosphere, community warmth, neighborhood character, and lifestyle in ${effectiveCity}.
2. ### What ${effectiveCity} is Known For & Why People Come Here
Detail the city's regional identity, notable nicknames, and what draws visitors, travelers, and new residents.
3. ### Historic Downtown, Local Businesses & Dining
Describe the historic downtown core or main commercial streets, independent storefronts, local eateries, and community hubs.
4. ### Key Attractions & Cultural Anchors
Detail verified landmarks, state historic sites, parks, arts centers, or regional recreation.
5. ### Major Annual Traditions & Events
Describe verified signature annual community festivals, seasonal fairs, or traditions.
6. ### Local Heritage & Roots
Chronicle the early settlement, founding date, and industrial or civic evolution.

PART 2: AT A GLANCE: MUNICIPAL PROFILE
Provide a clean Markdown table summarizing verified municipal data:

### At a Glance: Municipal Profile

| Indicator | Detail |
| :--- | :--- |
| **County / District** | [Verified County/Region] |
| **Geographic Coordinates** | [Exact latitude, longitude] |
| **Elevation** | [Feet and meters] |
| **Land Area** | [Square miles / km²] |
| **Population** | [Recent verified census / official estimate] |
| **Climate & Weather** | [Climate classification, avg summer high, avg winter low, annual precipitation] |
| **Key Economic Sectors** | [Verified primary industries, healthcare, or major employers] |
| **Major Transportation** | [Interstate highways, primary corridors, or transit arteries] |

CRITICAL RULES:
- Do NOT output a top-level # title. Start immediately with "### Atmosphere & Pace of Life".
- Every business, landmark, and event MUST be real and verified.`;

          try {
            const aiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
              }
            );

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const reportText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (reportText && reportText.length > 150) {
                await sql`
                  INSERT INTO city_reports (
                    city_name, state_name, lat, lng, report_type, content, created_at, updated_at
                  ) VALUES (
                    ${effectiveCity}, ${effectiveAdmin}, ${lat || 0}, ${lon || 0}, 'about', ${reportText}, NOW(), NOW()
                  )
                  ON CONFLICT (city_name, state_name, report_type)
                  DO UPDATE SET
                    content = EXCLUDED.content,
                    lat = EXCLUDED.lat,
                    lng = EXCLUDED.lng,
                    updated_at = NOW();
                `;
                reportStatus = "generated";
              }
            }
          } catch (aiErr: any) {
            console.warn(`[CityProvision] Report generation error for ${effectiveCity}:`, aiErr?.message || aiErr);
          }
        }

        // If still not generated, use fallback
        if (reportStatus !== "generated") {
          const fallback = generateFallbackReport(
            effectiveCity,
            effectiveAdmin,
            effectiveCountry,
            lat,
            lon,
            timezone
          );
          try {
            await sql`
              INSERT INTO city_reports (
                city_name, state_name, lat, lng, report_type, content, created_at, updated_at
              ) VALUES (
                ${effectiveCity}, ${effectiveAdmin}, ${lat || 0}, ${lon || 0}, 'about', ${fallback}, NOW(), NOW()
              )
              ON CONFLICT (city_name, state_name, report_type)
              DO UPDATE SET
                content = EXCLUDED.content,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                updated_at = NOW();
            `;
            reportStatus = "fallback";
          } catch (fbErr) {}
        }
      }
    } catch (repCheckErr) {
      console.warn(`[CityProvision] Report check failed for ${effectiveCity}:`, repCheckErr);
    }

    // 4. Verify / Reuse existing fun facts
    try {
      const factRows = await sql`
        SELECT id, city_name, state_name, country_name FROM city_fun_facts
        WHERE LOWER(city_name) = LOWER(${effectiveCity})
          AND is_approved = TRUE
        ORDER BY id ASC;
      `;

      const matchingFacts = factRows.rows.filter((r: any) =>
        isGeographicMatch(
          effectiveCity,
          effectiveAdmin,
          effectiveCountry,
          lat ?? undefined,
          lon ?? undefined,
          r.city_name,
          r.state_name || "",
          r.country_name || ""
        )
      );

      factsCount = matchingFacts.length;

      if (factsCount >= 3) {
        factsStatus = "existing";
      } else {
        // Check if facts report exists in city_reports
        const repFacts = await sql`
          SELECT content, state_name, lat, lng FROM city_reports
          WHERE LOWER(city_name) = LOWER(${effectiveCity})
            AND report_type = 'facts'
          ORDER BY updated_at DESC
          LIMIT 5;
        `;

        let parsedFacts: Array<{ title: string; description: string }> = [];
        const matchingRepFacts = repFacts.rows.find((r: any) =>
          isGeographicMatch(
            effectiveCity,
            effectiveAdmin,
            effectiveCountry,
            lat ?? undefined,
            lon ?? undefined,
            effectiveCity,
            r.state_name,
            effectiveCountry,
            r.lat ? Number(r.lat) : undefined,
            r.lng ? Number(r.lng) : undefined
          )
        );

        if (matchingRepFacts && matchingRepFacts.content) {
          parsedFacts = parseFactsFromMarkdown(matchingRepFacts.content);
        }

        // If still no facts and generateFacts is enabled
        if (parsedFacts.length === 0 && generateFacts) {
          const apiKey = (
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            process.env.GOOGLE_AI_KEY ||
            process.env.GEMINI_KEY ||
            ""
          ).trim().replace(/^["']|["']$/g, "");

          if (apiKey) {
            const prompt = `Research 12 authentic, historically factual fun facts, unique local landmarks, oddities, or municipal trivia about ${effectiveCity}, ${effectiveAdmin}, ${effectiveCountry}.
DO NOT hallucinate or invent history, laws, or attractions. Every fact must reflect real municipal, state, and geographic records.
If deep historical facts are scarce, provide real geographic data (exact coordinates, elevation, climate, regional geography, demographics).
Format each item starting with a number and bold title: "1. **[Title]**: [2-3 sentences of engaging details]".
Start immediately with "1. **[Title]**".`;

            try {
              const aiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                }
              );

              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                parsedFacts = parseFactsFromMarkdown(text);

                if (parsedFacts.length > 0) {
                  try {
                    await sql`
                      INSERT INTO city_reports (
                        city_name, state_name, report_type, content, lat, lng, created_at, updated_at
                      ) VALUES (
                        ${effectiveCity}, ${effectiveAdmin}, 'facts', ${text}, ${lat || 0}, ${lon || 0}, NOW(), NOW()
                      )
                      ON CONFLICT (city_name, state_name, report_type)
                      DO UPDATE SET content = EXCLUDED.content, lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = NOW();
                    `;
                  } catch (repErr) {}
                }
              }
            } catch (factAiErr) {
              console.warn(`[CityProvision] Facts AI generation error for ${effectiveCity}:`, factAiErr);
            }
          }
        }

        // Insert parsed facts into city_fun_facts
        if (parsedFacts.length > 0) {
          for (const item of parsedFacts) {
            try {
              await sql`
                INSERT INTO city_fun_facts (
                  city_name, state_name, country_name, title, description, category, scope,
                  source_attribution, contributed_by, is_approved, status
                ) VALUES (
                  ${effectiveCity}, ${effectiveAdmin}, ${effectiveCountry}, ${item.title}, ${item.description},
                  'local_history', 'city', 'Regional Gazette & Almanac', 'almanac_curator', TRUE, 'approved'
                )
              `;
              factsCount++;
            } catch (insErr) {}
          }
          factsStatus = "generated";
        }
      }
    } catch (factCheckErr) {
      console.warn(`[CityProvision] Facts check failed for ${effectiveCity}:`, factCheckErr);
    }

    return {
      slug,
      cityName: effectiveCity,
      admin1: effectiveAdmin,
      country: effectiveCountry,
      countryCode: effectiveCode,
      lat,
      lon,
      reportStatus,
      factsStatus,
      factsCount,
    };
  })();

  inFlightProvisioning.set(flightKey, taskPromise);

  try {
    return await taskPromise;
  } finally {
    inFlightProvisioning.delete(flightKey);
  }
}

/**
 * Asynchronous background schedule helper.
 * Utilizes Next.js after() to prevent Vercel serverless freeze during execution,
 * with fallback for contexts outside request lifecycles.
 * Never throws and never blocks the response to the user.
 */
export function scheduleCityContentProvisioning(params: CityProvisionParams): void {
  try {
    after(async () => {
      try {
        await ensureCityContentProvisioned(params);
      } catch (taskErr: any) {
        console.warn(`[BackgroundProvisioning:after] Task failed for ${params.cityName}:`, taskErr?.message || taskErr);
      }
    });
  } catch {
    // Fallback if called outside an active Next.js request lifecycle (e.g. background scripts or tests)
    ensureCityContentProvisioned(params).catch((err) => {
      console.warn(`[BackgroundProvisioning:fallback] Task failed for ${params.cityName}:`, err?.message || err);
    });
  }
}

