// src/lib/discovery/entity-resolver.ts
//
// Zero-cost ($0 Google Spend) multi-source entity resolver.
// Resolves missing official websites and calendar/tour URLs for venues, performers, and organizations
// without triggering paid Google Search Grounding ($35/1,000).
//
// Cascading Sources:
//   1. MusicBrainz API: Dedicated open music database (ideal for touring musical artists & bands)
//   2. Wikidata Entity API: Structured global knowledge graph (ideal for venues, civic centers, museums)
//   3. Gemini Parametric Memory: System training memory only, NO search tools ($0 spend, negligible tokens)
//   4. DuckDuckGo Instant Answers: Free web entity lookup fallback
//
// Option A Gatekeeper:
//   Every candidate domain is strictly verified via HTTP GET/HEAD (must return 200 OK).
//   The real page's HTML is inspected for authentic tour/events/calendar links (/tour, /events, /dates).
//   Never fabricates or guesses unverified URLs.

import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { isTicketBrokerUrl, isValidCalendarSourceUrl } from "../events/crawl/helpers";

export interface EntityLookupCandidate {
  id?: number;
  name: string;
  type: "performer" | "venue" | "organization" | string;
  city?: string | null;
  state?: string | null;
  sampleEventTitle?: string | null;
}

export interface VerifiedCalendarResult {
  ok: boolean;
  rootUrl?: string;
  calendarUrl?: string;
  title?: string;
  status?: number;
  error?: string;
}

export interface ResolutionResult {
  candidate: EntityLookupCandidate;
  foundUrl?: string;
  verifiedUrl?: string;
  calendarUrl?: string;
  method?: "musicbrainz" | "wikidata" | "gemini_parametric" | "duckduckgo";
  confidence: "high" | "medium" | "low" | "none";
  ok: boolean;
  reason?: string;
}

const GENERIC_NAMES = new Set([
  "organization", "venue", "performer", "event", "tbd", "tba", "unknown",
  "various", "various artists", "n/a", "none", "community", "null", "undefined"
]);

/** Returns true if entity name is clean and non-generic */
export function isResolvableEntity(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const clean = name.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 120) return false;
  if (GENERIC_NAMES.has(clean)) return false;
  // Reject pure numbers or weird symbols
  if (/^[0-9\W]+$/.test(clean)) return false;
  return true;
}

// --------------------------------------------------------------------------
// 1. MusicBrainz Resolver (Touring Artists / Bands / Performers)
// --------------------------------------------------------------------------
export async function resolveViaMusicBrainz(name: string): Promise<{ url: string; confidence: "high" | "medium" } | null> {
  try {
    const cleanName = name.replace(/^(Back to Events|presents|feat\.?|vs\.?)\s+/i, "").trim();
    const queryUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(cleanName)}&fmt=json&limit=3`;
    const res = await fetch(queryUrl, {
      headers: { "User-Agent": "LiveTimeDataSpider/1.0 ( contact@livetimedata.com )" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const artist = data.artists?.[0];
    if (!artist || (artist.score && artist.score < 80)) return null;

    // Fetch artist relation URLs (official homepage / tour dates)
    const relUrl = `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`;
    const relRes = await fetch(relUrl, {
      headers: { "User-Agent": "LiveTimeDataSpider/1.0 ( contact@livetimedata.com )" },
      signal: AbortSignal.timeout(6000),
    });
    if (!relRes.ok) return null;
    const relData = await relRes.json();

    const relations = (relData.relations || []) as Array<{ type: string; url?: { resource?: string } }>;
    // Prefer official homepage, then tour dates
    const homepage = relations.find((r) => r.type === "official homepage" && r.url?.resource)?.url?.resource;
    if (homepage && !isTicketBrokerUrl(homepage)) {
      return { url: homepage, confidence: "high" };
    }

    const tour = relations.find((r) => r.type === "tour dates" && r.url?.resource)?.url?.resource;
    if (tour && !isTicketBrokerUrl(tour)) {
      return { url: tour, confidence: "high" };
    }

    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// 2. Wikidata Resolver (Venues, Museums, Theatres, Organizations)
// --------------------------------------------------------------------------
export async function resolveViaWikidata(name: string, location?: string): Promise<{ url: string; confidence: "high" | "medium" } | null> {
  try {
    const query = location ? `${name} ${location}` : name;
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=3`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "LiveTimeDataSpider/1.0 ( contact@livetimedata.com )" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.search?.[0];
    if (!item?.id) return null;

    // Fetch claim P856 (official website)
    const entUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${item.id}&props=claims&languages=en&format=json`;
    const entRes = await fetch(entUrl, {
      headers: { "User-Agent": "LiveTimeDataSpider/1.0 ( contact@livetimedata.com )" },
      signal: AbortSignal.timeout(6000),
    });
    if (!entRes.ok) return null;
    const entData = await entRes.json();
    const p856 = entData.entities?.[item.id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (p856 && typeof p856 === "string" && p856.startsWith("http") && !isTicketBrokerUrl(p856)) {
      return { url: p856, confidence: "high" };
    }
    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// 3. Gemini Parametric Memory Resolver ($0 Google Spend, strictly NO search tools)
// --------------------------------------------------------------------------
export async function resolveBatchViaGemini(
  items: EntityLookupCandidate[]
): Promise<Map<number | string, { url: string; confidence: "high" | "medium" }>> {
  const results = new Map<number | string, { url: string; confidence: "high" | "medium" }>();
  if (items.length === 0) return results;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return results;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const payload = items.map((it, idx) => ({
      key: it.id ?? idx,
      name: it.name,
      type: it.type,
      location: [it.city, it.state].filter(Boolean).join(", "),
      sampleEvent: it.sampleEventTitle || undefined,
    }));

    const prompt = `Based ONLY on your internal system memory / pre-training knowledge (do NOT use any web search tools):
For each entity in the list below, output its official website root URL (e.g. "https://www.billieeilish.com", "https://www.browardcenter.org").
If the entity is a sports matchup (e.g. "Bruins vs. Canadiens"), return the home team's official schedule/website.
If you know the official domain with high confidence, provide it. If you do not know or are unsure, provide null.

Entities:
${JSON.stringify(payload, null, 2)}

Respond ONLY with a JSON array:
[
  { "key": <same key as input>, "url": "https://..." or null, "confidence": "high" | "medium" | "none" }
]
No explanation, no markdown text outside the JSON array.`;

    // Notice: STRICTLY NO tools config -> pure parametric memory, $0 Google Search spend!
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.1 },
    });

    const text = (res.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (row.url && typeof row.url === "string" && row.url.startsWith("http") && !isTicketBrokerUrl(row.url)) {
          if (row.confidence === "high" || row.confidence === "medium") {
            results.set(row.key, { url: row.url.trim(), confidence: row.confidence });
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[resolveBatchViaGemini error]: ${err?.message || err}`);
  }

  return results;
}

// --------------------------------------------------------------------------
// 4. DuckDuckGo Instant Answer Resolver ($0 fallback)
// --------------------------------------------------------------------------
export async function resolveViaDuckDuckGo(name: string, location?: string): Promise<{ url: string; confidence: "medium" | "low" } | null> {
  try {
    const q = location ? `${name} ${location}` : name;
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const firstUrl = data.Results?.[0]?.FirstURL;
    if (firstUrl && firstUrl.startsWith("http") && !isTicketBrokerUrl(firstUrl)) {
      return { url: firstUrl, confidence: "medium" };
    }
    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// 5. Option A Verification & Calendar Discovery
// --------------------------------------------------------------------------
export async function verifyAndDiscoverCalendar(rootUrl: string): Promise<VerifiedCalendarResult> {
  try {
    const res = await fetch(rootUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    const finalUrl = res.url;
    const html = await res.text();
    if (!html || html.length < 200) {
      return { ok: false, error: "Empty HTML response" };
    }

    const $ = cheerio.load(html);
    const pageTitle = $("title").text().trim();

    // Check if domain is a domain-for-sale / parked page
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes("domain has expired") ||
      lowerHtml.includes("buy this domain") ||
      lowerHtml.includes("parkingcrew") ||
      lowerHtml.includes("sedoparking") ||
      lowerHtml.includes("domain is for sale")
    ) {
      return { ok: false, error: "Parked / expired domain" };
    }

    // Search for official calendar / tour navigation links on the real page
    let bestCalendarUrl: string | undefined;
    const linkMatches: Array<{ score: number; url: string }> = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase().trim();
      if (!href) return;

      try {
        const resolved = new URL(href, finalUrl).toString();
        const parsed = new URL(resolved);
        const path = parsed.pathname.toLowerCase();

        // Must be on the same domain or legitimate ticketing subdomain
        if (parsed.hostname !== new URL(finalUrl).hostname && !parsed.hostname.endsWith("." + new URL(finalUrl).hostname.replace(/^www\./, ""))) {
          return;
        }

        if (resolved.includes("#") && !path) return;
        if (!isValidCalendarSourceUrl(resolved)) return;

        let score = 0;
        // Priority high: explicit tour/events keywords in pathname
        if (/\/(?:tour|tour-dates|dates|shows|concerts|upcoming-shows)\b/i.test(path)) score += 10;
        else if (/\/(?:events|calendar|schedule|programmation)\b/i.test(path)) score += 8;
        else if (/\/(?:tickets|lineup|performances)\b/i.test(path)) score += 5;

        // Check link anchor text
        if (/\b(tour|tour dates|upcoming shows|live dates)\b/i.test(text)) score += 6;
        else if (/\b(events|calendar|schedule|all events|buy tickets)\b/i.test(text)) score += 4;

        if (score > 0) {
          linkMatches.push({ score, url: resolved });
        }
      } catch {
        // Ignore invalid URLs
      }
    });

    if (linkMatches.length > 0) {
      linkMatches.sort((a, b) => b.score - a.score);
      bestCalendarUrl = linkMatches[0].url;
    }

    return {
      ok: true,
      rootUrl: finalUrl,
      calendarUrl: bestCalendarUrl || finalUrl, // if no explicit calendar link, root homepage is the verified entrance
      title: pageTitle,
      status: res.status,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// --------------------------------------------------------------------------
// 6. High-Level Cascading Resolver for a Single Candidate
// --------------------------------------------------------------------------
export async function resolveCandidate(candidate: EntityLookupCandidate): Promise<ResolutionResult> {
  const locStr = [candidate.city, candidate.state].filter(Boolean).join(", ");
  let candidateUrl: string | undefined;
  let method: ResolutionResult["method"];
  let confidence: ResolutionResult["confidence"] = "none";

  // Step 1: For performers, try MusicBrainz first
  if (candidate.type === "performer") {
    const mb = await resolveViaMusicBrainz(candidate.name);
    if (mb?.url) {
      candidateUrl = mb.url;
      method = "musicbrainz";
      confidence = mb.confidence;
    }
  }

  // Step 2: Try Gemini Parametric Memory if not yet found
  if (!candidateUrl) {
    const gpMap = await resolveBatchViaGemini([candidate]);
    const gp = gpMap.get(candidate.id ?? 0);
    if (gp?.url) {
      candidateUrl = gp.url;
      method = "gemini_parametric";
      confidence = gp.confidence;
    }
  }

  // Step 3: For venues or unfound entities, try Wikidata
  if (!candidateUrl) {
    const wd = await resolveViaWikidata(candidate.name, locStr);
    if (wd?.url) {
      candidateUrl = wd.url;
      method = "wikidata";
      confidence = wd.confidence;
    }
  }

  // Step 4: Fallback to DuckDuckGo Instant Answer
  if (!candidateUrl) {
    const ddg = await resolveViaDuckDuckGo(candidate.name, locStr);
    if (ddg?.url) {
      candidateUrl = ddg.url;
      method = "duckduckgo";
      confidence = ddg.confidence;
    }
  }

  if (!candidateUrl) {
    return { candidate, confidence: "none", ok: false, reason: "No candidate URL found across any $0 source" };
  }

  // Step 5: Option A Verification
  const verification = await verifyAndDiscoverCalendar(candidateUrl);
  if (!verification.ok) {
    return {
      candidate,
      foundUrl: candidateUrl,
      method,
      confidence,
      ok: false,
      reason: `Verification failed: ${verification.error || "HTTP error"}`,
    };
  }

  return {
    candidate,
    foundUrl: candidateUrl,
    verifiedUrl: verification.rootUrl,
    calendarUrl: verification.calendarUrl,
    method,
    confidence,
    ok: true,
  };
}
