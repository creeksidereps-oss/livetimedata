// src/app/api/news/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(val: any): string {
  return String(val || "").replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

function timeAgo(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    if (isNaN(diffMs) || diffMs < 0) return "Just now";

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) {
      return diffMins <= 1 ? "Just now" : `${diffMins} mins ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 3) return `${diffDays} days ago`;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(past);
  } catch {
    return "Recently";
  }
}

const OBITUARY_KEYWORDS = [
  "obituary", "obituaries", "funeral", "passed away", "in memory of",
  "memorial service", "celebration of life", "death notice", "resting in peace",
  "legacy.com", "dignity memorial", "tribute archive", "cremation"
];

const REAL_ESTATE_KEYWORDS = [
  "realtor.com", "zillow", "redfin", "homes.com", "trulia", "real estate",
  "home for sale", "homes for sale", "house for sale", "houses for sale",
  "condo for sale", "for rent", "sqft", "sq. ft.", "bed,", "bath,", "mls#",
  "property for sale", "mls-listing"
];

function isJunkNews(title: string, source: string, snippet: string): boolean {
  const combined = `${title} ${source} ${snippet}`.toLowerCase();
  for (const kw of OBITUARY_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  for (const kw of REAL_ESTATE_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  pubDate: string;
  timestamp: number;
  timeAgo: string;
  snippet: string;
  link: string;
}

async function fetchGoogleNews(query: string, cityName: string): Promise<NewsItem[]> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!res.ok) return [];

    const xmlText = await res.text();
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];

    return itemMatches.map((itemXml, index) => {
      const rawTitle = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Local News Update";
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
      const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Local News";
      const descHtml = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";

      // Clean headline: Google News RSS appends "- Source" at the end of titles
      let cleanHeadline = rawTitle.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (source && cleanHeadline.endsWith(` - ${source}`)) {
        cleanHeadline = cleanHeadline.slice(0, cleanHeadline.lastIndexOf(` - ${source}`)).trim();
      }

      // Clean description snippet
      const cleanSnippet = descHtml
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const timestamp = pubDate ? new Date(pubDate).getTime() : 0;

      return {
        id: `news-${index}-${Buffer.from(cleanHeadline).toString("base64").slice(0, 8)}`,
        title: cleanHeadline,
        source: source.trim(),
        pubDate,
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        timeAgo: timeAgo(pubDate),
        snippet: cleanSnippet || `Latest regional coverage and breaking headlines for ${cityName}.`,
        link: link.trim()
      };
    });
  } catch (err) {
    console.error("fetchGoogleNews error:", err);
    return [];
  }
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

    const excludeQuery = '-obituary -obituaries -funeral -realtor -zillow -redfin -homes.com -trulia -"real estate"';
    const primaryQuery = `"${cityName}" "${stateName || countryName}" when:3d ${excludeQuery}`.trim();

    const rawStories = await fetchGoogleNews(primaryQuery, cityName);

    const now = Date.now();
    const maxAgeMs = 3 * 24 * 60 * 60 * 1000; // Strictly max 3 days (72 hours)

    let filtered = rawStories.filter(item => {
      if (isJunkNews(item.title, item.source, item.snippet)) return false;
      if (!item.timestamp || isNaN(item.timestamp)) return false;
      const age = now - item.timestamp;
      return age <= maxAgeMs && age >= -3600000; // Within 3 days
    });

    // If a smaller town doesn't have enough stories from the last 3 days,
    // supplement with fresh regional/state-level breaking news from the past 24 hours.
    if (filtered.length < 4 && stateName) {
      const regionalQuery = `"${stateName}" news when:1d ${excludeQuery}`.trim();
      const regionalRaw = await fetchGoogleNews(regionalQuery, cityName);
      const existingTitles = new Set(filtered.map(f => f.title.toLowerCase()));

      for (const reg of regionalRaw) {
        if (isJunkNews(reg.title, reg.source, reg.snippet)) continue;
        const age = now - reg.timestamp;
        if (age <= 24 * 60 * 60 * 1000 && age >= -3600000) {
          if (!existingTitles.has(reg.title.toLowerCase())) {
            existingTitles.add(reg.title.toLowerCase());
            filtered.push(reg);
            if (filtered.length >= 12) break;
          }
        }
      }
    }

    // Sort strictly in chronological order: newest first
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const stories = filtered.slice(0, 15);

    return NextResponse.json({
      ok: true,
      cityName,
      stateName,
      stories
    });
  } catch (error: any) {
    console.error("News API error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to load news" }, { status: 500 });
  }
}
