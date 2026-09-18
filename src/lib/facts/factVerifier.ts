// src/lib/facts/factVerifier.ts

export interface VerificationVerdict {
  verdict: 'APPROVED' | 'REJECTED' | 'NEEDS_HUMAN_CURATION';
  confidence: number; // 0 to 100
  reason: string;
  category: 'oddity' | 'forgotten_history' | 'discovery' | 'world_record' | 'quirk';
  sources: string[];
  cleanTitle?: string;
  cleanDescription?: string;
}

/**
 * Evaluates a candidate fact against live Google Search Grounding and policy rules.
 * Tripartite output:
 * 1. APPROVED: Proven true by real records, safe, unique oddity.
 * 2. REJECTED: False, fabricated, spam, scam, or policy violation. Kept in 6-month legal hold.
 * 3. NEEDS_HUMAN_CURATION: Inconclusive (cannot definitively prove or disprove).
 */
export async function verifyFactWithAI(
  cityName: string,
  stateName: string,
  countryName: string,
  candidateTitle: string,
  candidateDescription: string
): Promise<VerificationVerdict> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    // If no API key, fail safe to human curation
    return {
      verdict: 'NEEDS_HUMAN_CURATION',
      confidence: 0,
      reason: 'AI Verification engine offline; routed to human curation.',
      category: 'oddity',
      sources: []
    };
  }

  const prompt = `You are a strict, forensic municipal fact-checker for a digital almanac.
Your mission is to rigorously evaluate whether a proposed "Fun Fact / Local Oddity" about ${cityName}, ${stateName} (${countryName}) is authentic, historically factual, or fabricated.

PROPOSED FACT TO AUDIT:
Title: "${candidateTitle}"
Description: "${candidateDescription}"

POLICY GUIDELINES:
1. TRUTHFULNESS & VERIFICATION:
   - Use Google Search Grounding to verify this claim against authoritative historical archives, municipal records, news articles, or established encyclopedias.
   - If the claim is proven TRUE by historical or scientific evidence -> VERDICT: "APPROVED"
   - If the claim is demonstrably FALSE, fabricated, made-up by AI, a scam, commercial advertising, spam, or violates safety guidelines -> VERDICT: "REJECTED"
   - If search results are INCONCLUSIVE (e.g. obscure unverified local legend or family lore that can neither be confirmed nor disproven) -> VERDICT: "NEEDS_HUMAN_CURATION"

2. STYLE & VALUE:
   - We seek bizarre oddities, forgotten history, world records, curious discoveries, strange landmarks, or unique municipal lore.
   - Reject bland commercial promotion (e.g. "Joe's Diner has great burgers").

OUTPUT FORMAT:
Respond with ONLY a valid JSON object matching this schema:
{
  "verdict": "APPROVED" | "REJECTED" | "NEEDS_HUMAN_CURATION",
  "confidence": 0-100,
  "reason": "Clear explanation citing why it was approved, rejected, or held for human review",
  "category": "oddity" | "forgotten_history" | "discovery" | "world_record" | "quirk",
  "sources": ["list of source URLs or citations found"],
  "cleanTitle": "Refined factual title if approved",
  "cleanDescription": "Polished, engaging 2-3 sentence description if approved"
}`;

  try {
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.1 // Ultra-low temperature for strict factual accuracy
          }
        })
      }
    );

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.warn(`Fact verifier gateway returned status ${aiRes.status}: ${errBody}`);
      return {
        verdict: 'NEEDS_HUMAN_CURATION',
        confidence: 0,
        reason: `AI gateway status ${aiRes.status}; held for human review.`,
        category: 'oddity',
        sources: []
      };
    }

    const data = await aiRes.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);

    const verdict = (parsed.verdict === 'APPROVED' || parsed.verdict === 'REJECTED' || parsed.verdict === 'NEEDS_HUMAN_CURATION')
      ? parsed.verdict
      : 'NEEDS_HUMAN_CURATION';

    return {
      verdict,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
      reason: parsed.reason || 'Evaluation completed.',
      category: parsed.category || 'oddity',
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      cleanTitle: parsed.cleanTitle || candidateTitle,
      cleanDescription: parsed.cleanDescription || candidateDescription
    };
  } catch (err: any) {
    console.error("Fact verification exception:", err);
    return {
      verdict: 'NEEDS_HUMAN_CURATION',
      confidence: 0,
      reason: `Verification error: ${err.message}. Routed to human curation.`,
      category: 'oddity',
      sources: []
    };
  }
}

/**
 * Researches authentic candidate facts for a city using Search Grounding
 * and returns evaluated items.
 */
export async function researchCityFactsWithAI(
  cityName: string,
  stateName: string,
  countryName: string
): Promise<Array<{ title: string; description: string; verdict: VerificationVerdict }>> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return [];

  const prompt = `Research verified municipal oddities, forgotten history, strange discoveries, unique local records, or Ripley's Believe-It-Or-Not style facts about ${cityName}, ${stateName} (${countryName}).
CRITICAL REQUIREMENTS:
- You MUST use Google Search Grounding to verify every candidate fact against real historical archives, news records, or encyclopedias.
- DO NOT hallucinate or fabricate events, people, or landmarks.
- Find 3 real candidates.
Output ONLY a JSON array of objects:
[
  {
    "title": "Title of the fact",
    "description": "2-3 sentences explaining the fact and its historical or factual basis.",
    "category": "oddity" | "forgotten_history" | "discovery" | "world_record" | "quirk",
    "sources": ["source url or archive name"]
  }
]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.2
          }
        })
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const candidates = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);

    const verifiedResults = [];
    for (const c of candidates) {
      if (c.title && c.description) {
        const audit = await verifyFactWithAI(cityName, stateName, countryName, c.title, c.description);
        verifiedResults.push({
          title: audit.cleanTitle || c.title,
          description: audit.cleanDescription || c.description,
          verdict: audit
        });
      }
    }

    return verifiedResults;
  } catch (err) {
    console.error("Research city facts error:", err);
    return [];
  }
}
